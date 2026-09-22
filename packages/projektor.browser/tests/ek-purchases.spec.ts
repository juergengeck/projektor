import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Locator } from "@playwright/test";

const COMM_SERVER_PORT = 18346;
let commserver: ChildProcess | undefined;

test.use({ viewport: { width: 1600, height: 900 } });

test.beforeAll(async () => {
  if (process.env.EK_DEMO_URL) return;
  const bundle = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../one/packages/one.models/comm_server.bundle.js",
  );
  commserver = spawn(process.execPath, [bundle, "-h", "127.0.0.1", "-p", String(COMM_SERVER_PORT)], { stdio: "ignore" });
  const deadline = Date.now() + 30_000;
  for (;;) {
    const reachable = await new Promise<boolean>(resolve => {
      const socket = connect(COMM_SERVER_PORT, "127.0.0.1");
      socket.on("connect", () => { socket.end(); resolve(true); });
      socket.on("error", () => resolve(false));
    });
    if (reachable) break;
    if (Date.now() > deadline) throw new Error("local commserver never came up");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
});

test.afterAll(() => {
  commserver?.kill();
});

async function purchaseIds(history: Locator): Promise<string[]> {
  return history.locator(".lab-purchase-card").evaluateAll(cards => cards.map(card => card.getAttribute("data-order-id")!));
}

test("buy confirms automatically, decrements inventory, and refuses overselling", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(String(error)));

  await page.goto(process.env.EK_DEMO_URL ?? `/browser/eklab/?commServer=${encodeURIComponent(`ws://127.0.0.1:${COMM_SERVER_PORT}`)}`);
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByRole("button", { name: /pause|resume/i })).toHaveCount(0);

  const header = page.locator("header.lab-header");
  await expect(header.getByText("EK lab", { exact: true })).toBeVisible();

  const columns = page.locator("section.lab-column");
  await expect(columns).toHaveCount(4);
  const [admin, manager, seller, customer] = [0, 1, 2, 3].map(index => columns.nth(index));

  // Build the real authority chain. The test does not rely on seeded manager,
  // seller, or customer assignments.
  await admin.getByRole("button", { name: "Appoint Bauleiter", exact: true }).click();
  const appointSeller = manager.getByRole("button", { name: "Appoint Vorarbeiter", exact: true });
  await expect(appointSeller).toBeEnabled({ timeout: 90_000 });
  await appointSeller.click();
  const appointCustomer = seller.getByRole("button", { name: "Appoint Werker", exact: true });
  await expect(appointCustomer).toBeEnabled({ timeout: 90_000 });
  await appointCustomer.click();
  await expect(customer.getByLabel("Contact name")).toBeEnabled({ timeout: 90_000 });

  // Admission consumes real stock, so establish it through the admin worker.
  await admin.getByLabel("Stock quantity").fill("2");
  await admin.getByRole("button", { name: "Stock Up", exact: true }).click();
  await expect(manager.getByText("2 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });

  // The offer traverses manager -> seller -> customer through the worker mesh.
  await manager.getByRole("button", { name: "+ Offer (100.00€)", exact: true }).click();
  const shareWithSeller = manager.getByRole("button", { name: "Share offer-ek-1 with Vorarbeiter", exact: true });
  await expect(shareWithSeller).toBeEnabled({ timeout: 90_000 });
  await shareWithSeller.click();
  const shareWithCustomer = seller.getByRole("button", { name: "Share offer-ek-1 down", exact: true });
  await expect(shareWithCustomer).toBeEnabled({ timeout: 90_000 });
  await shareWithCustomer.click();

  const buy = customer.getByRole("button", { name: "Buy 1x (offer-ek-1)", exact: true });
  await expect(buy).toBeEnabled({ timeout: 90_000 });
  const history = customer.getByRole("region", { name: "Purchase history", exact: true });

  // Buying needs no separate action from the seller. Every worker projects
  // the same confirmed purchase and both stock meters drop immediately.
  await buy.click();
  await expect(history.getByText("Confirmed", { exact: true })).toHaveCount(1, { timeout: 90_000 });
  await expect(admin.getByText("1 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(manager.getByText("1 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(seller.getByRole("button", { name: /^Admit / })).toHaveCount(0);
  const firstIds = await purchaseIds(history);
  expect(firstIds).toHaveLength(1);

  await buy.click();
  await expect(history.getByText("Confirmed", { exact: true })).toHaveCount(2, { timeout: 90_000 });
  await expect(admin.getByText("0 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(manager.getByText("0 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });
  const cards = history.locator(".lab-purchase-card");
  await expect(cards).toHaveCount(2);
  await expect(history.getByText("Processing purchase", { exact: true })).toHaveCount(0);
  await expect(customer.getByRole("button", { name: "Purchase history (2)", exact: true })).toBeVisible();
  const purchaseMetric = customer.locator(".lab-metric-mini").filter({ hasText: "Purchases" });
  await expect(purchaseMetric.locator(".lab-metric-mini-val")).toHaveText("2");
  const confirmedIds = await purchaseIds(history);
  expect(new Set(confirmedIds).size).toBe(2);
  expect(confirmedIds).toContain(firstIds[0]);

  await buy.click();
  await expect(history.getByText("Out of stock", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(buy).toBeEnabled();
  await expect(history.getByText("Processing purchase", { exact: true })).toHaveCount(0);
  await expect(history.getByText("Confirmed", { exact: true })).toHaveCount(2);
  await expect(admin.getByText("0 / 2 units", { exact: true })).toBeVisible();
  await expect(manager.getByText("0 / 2 units", { exact: true })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("demo-workspace.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await header.screenshot({ path: testInfo.outputPath("demo-workspace-mobile-header.png") });

  if (errors.length) {
    throw new Error(`console/page errors:\n${errors.slice(0, 5).map(line => `  ${line.slice(0, 250)}`).join("\n")}`);
  }
});
