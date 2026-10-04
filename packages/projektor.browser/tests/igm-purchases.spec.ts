import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Locator } from "@playwright/test";

const COMM_SERVER_PORT = 18348;
let commserver: ChildProcess | undefined;

test.use({ viewport: { width: 1600, height: 900 } });

test.beforeAll(async () => {
  if (process.env.IGM_DEMO_URL) return;
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

test("handoff acceptances reach upstream orders without consuming stock; Monteur acceptance settles inventory", async ({ page, browser }, testInfo) => {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(String(error)));

  await page.goto(process.env.IGM_DEMO_URL ?? `/igm/lab?commServer=${encodeURIComponent(`ws://127.0.0.1:${COMM_SERVER_PORT}`)}`);
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  const header = page.locator("header.lab-header");
  await expect(header.getByText("IGM lab", { exact: true })).toBeVisible();

  await expect(page).toHaveURL(/\/lab\/igm\?/);
  await expect(header.getByAltText("IGM", { exact: true })).toBeVisible();
  await expect(header.getByText("VISIONÄRE FASSADEN", { exact: true })).toBeVisible();
  expect(await page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--igm-red").trim())).toBe("#8d1d2c");
  const columns = page.locator("section.lab-column");
  await expect(columns).toHaveCount(4);
  const frames = page.frameLocator("section.lab-column iframe");
  const [admin, manager, seller, customer] = [0, 1, 2, 3].map(n => frames.nth(n));

  await expect(admin.getByRole("heading", { name: "Verwaltung", exact: true })).toBeVisible();
  await expect(manager.getByText("Noch nicht zugewiesen", { exact: true })).toBeVisible();
  await expect(manager.getByRole("button", { name: "+ Facade element (100.00€)", exact: true })).toBeDisabled();
  // Verwaltung assigns every IGM role directly.
  await admin.getByRole("button", { name: "Bauleiter zuweisen", exact: true }).click();
  await expect(admin.getByRole("button", { name: "Bauleiter zugewiesen", exact: true })).toBeDisabled();
  await expect(admin.getByRole("status")).toHaveText("Bauleiter zugewiesen. Berechtigungen sind freigeschaltet.");
  await expect(manager.getByText("Rolle aktiv", { exact: true })).toBeVisible();
  await expect(columns.nth(1).locator(".lab-role-tags .badge-accent")).toHaveText("Bauleiter");
  const appointSeller = admin.getByRole("button", { name: "Vorarbeiter zuweisen", exact: true });
  await expect(appointSeller).toBeEnabled({ timeout: 90_000 });
  await appointSeller.click();
  await expect(admin.getByRole("button", { name: "Vorarbeiter zugewiesen", exact: true })).toBeDisabled();
  await expect(seller.getByText("Rolle aktiv", { exact: true })).toBeVisible();
  await expect(columns.nth(2).locator(".lab-role-tags .badge-info")).toHaveText("Vorarbeiter");
  const appointCustomer = admin.getByRole("button", { name: "Monteur zuweisen", exact: true });
  await expect(appointCustomer).toBeEnabled({ timeout: 90_000 });
  await appointCustomer.click();
  await expect(admin.getByRole("button", { name: "Monteur zugewiesen", exact: true })).toBeDisabled();
  await expect(customer.getByText("Rolle aktiv", { exact: true })).toBeVisible();
  await expect(columns.nth(3).locator(".lab-role-tags .badge-success")).toHaveText("Monteur");
  await expect(customer.getByLabel("Display name")).toBeEnabled({ timeout: 90_000 });

  // Admission consumes real stock, so establish it through the admin app.
  await admin.getByLabel("Receipt ID").fill("igm-purchases-receipt-1");
  await admin.getByLabel("Quantity").fill("2");
  await admin.getByRole("button", { name: "Receive stock", exact: true }).click();
  await expect(manager.getByText("2 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });

  // Verwaltung publishes; the Bauleiter explicitly accepts responsibility.
  await admin.getByRole("button", { name: "+ Facade element (100.00€)", exact: true }).click();
  const managerAccept = manager.getByRole("button", { name: "Accept (offer-igm-1)", exact: true });
  await expect(managerAccept).toBeEnabled({ timeout: 90_000 });
  const adminOrders = admin.getByRole("region", { name: "Orders & Reservations", exact: true });
  const managerOrders = manager.getByRole("region", { name: "Orders & Reservations", exact: true });
  const sellerAccept = seller.getByRole("button", { name: "Accept (offer-igm-1)", exact: true });
  const invitedContext = await browser.newContext();
  try {
    const invitedManager = await invitedContext.newPage();
    const invitation = await page.locator(".lab-device").nth(1).getByLabel("Device invitation URL").inputValue();
    const joinUrl = new URL(invitation);
    const commServer = new URL(page.url()).searchParams.get("commServer");
    if (commServer) joinUrl.searchParams.set("commServer", commServer);
    await invitedManager.goto(joinUrl.toString());
    await invitedManager.getByRole("button", { name: "Join", exact: true }).click();
    await expect(invitedManager.locator(".invited-role-app")).toHaveAttribute("data-paired", "true", { timeout: 120_000 });
    const app = invitedManager.frameLocator("iframe");
    await expect(app.getByRole("button", { name: "Accept (offer-igm-1)", exact: true })).toBeEnabled({ timeout: 90_000 });
    await app.getByLabel("Acceptance quantity (offer-igm-1)", { exact: true }).fill("2");
    await app.getByRole("button", { name: "Accept (offer-igm-1)", exact: true }).click();
    await expect(manager.getByRole("button", { name: "Accepted (offer-igm-1)", exact: true })).toBeDisabled({ timeout: 90_000 });
    await expect(adminOrders.locator(".lab-handoff-card")).toHaveCount(1, { timeout: 90_000 });
    await expect(adminOrders.locator(".lab-handoff-card").getByText("Qty: 2", { exact: true })).toBeVisible();
    await expect(admin.getByRole("button", { name: "Orders (1)", exact: true })).toBeVisible();
    await expect(manager.getByText("2 / 2 units", { exact: true })).toBeVisible();
    // Sharing exclusively on B must forward both offer and typed handoff via A.
    await app.getByRole("button", { name: "Share offer-igm-1 with Vorarbeiter", exact: true }).click();
    await expect(sellerAccept).toBeEnabled({ timeout: 90_000 });
  } finally {
    await invitedContext.close();
  }
  await seller.getByLabel("Acceptance quantity (offer-igm-1)", { exact: true }).fill("2");
  await sellerAccept.click();
  await expect(seller.getByRole("button", { name: "Accepted (offer-igm-1)", exact: true })).toBeDisabled({ timeout: 90_000 });
  await expect(managerOrders.locator(".lab-handoff-card")).toHaveCount(2, { timeout: 90_000 });
  await expect(adminOrders.locator(".lab-handoff-card")).toHaveCount(2, { timeout: 90_000 });
  await expect(manager.getByRole("button", { name: "Orders (2)", exact: true })).toBeVisible();
  await expect(manager.getByText("2 / 2 units", { exact: true })).toBeVisible();
  const shareWithCustomer = seller.getByRole("button", { name: "Share offer-igm-1 down", exact: true });
  await expect(shareWithCustomer).toBeEnabled({ timeout: 90_000 });
  await shareWithCustomer.click();

  const buy = customer.getByRole("button", { name: "Accept 1x (offer-igm-1)", exact: true });
  await expect(buy).toBeEnabled({ timeout: 90_000 });
  const history = customer.getByRole("region", { name: "Acceptance history", exact: true });

  // Buying needs no separate action from the seller. Every instance projects
  // the same confirmed purchase and both stock meters drop immediately.
  await buy.click();
  await expect(history.getByText("Accepted", { exact: true })).toHaveCount(1, { timeout: 90_000 });
  await expect(admin.getByText("1 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(manager.getByText("1 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(seller.getByRole("button", { name: /^Admit / })).toHaveCount(0);
  const firstIds = await purchaseIds(history);
  expect(firstIds).toHaveLength(1);

  await buy.click();
  await expect(history.getByText("Accepted", { exact: true })).toHaveCount(2, { timeout: 90_000 });
  await expect(admin.getByText("0 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(manager.getByText("0 / 2 units", { exact: true })).toBeVisible({ timeout: 90_000 });
  const cards = history.locator(".lab-purchase-card");
  await expect(cards).toHaveCount(2);
  await expect(history.getByText("Processing acceptance", { exact: true })).toHaveCount(0);
  await expect(customer.getByRole("button", { name: "Acceptance history (2)", exact: true })).toBeVisible();
  const purchaseMetric = customer.locator(".lab-metric-mini").filter({ hasText: "Acceptances" });
  await expect(purchaseMetric.locator(".lab-metric-mini-val")).toHaveText("2");
  const confirmedIds = await purchaseIds(history);
  expect(new Set(confirmedIds).size).toBe(2);
  expect(confirmedIds).toContain(firstIds[0]);

  await buy.click();
  await expect(history.getByText("Out of stock", { exact: true })).toBeVisible({ timeout: 90_000 });
  await expect(buy).toBeEnabled();
  await expect(history.getByText("Processing acceptance", { exact: true })).toHaveCount(0);
  await expect(history.getByText("Accepted", { exact: true })).toHaveCount(2);
  await expect(admin.getByText("0 / 2 units", { exact: true })).toBeVisible();
  await expect(manager.getByText("0 / 2 units", { exact: true })).toBeVisible();

  await expect(columns.nth(2).locator(".lab-role-tags .badge-info")).toBeVisible({ timeout: 10_000 });
  await page.screenshot({ path: testInfo.outputPath("demo-workspace.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await header.screenshot({ path: testInfo.outputPath("demo-workspace-mobile-header.png") });

  if (errors.length) {
    throw new Error(`console/page errors:\n${errors.slice(0, 5).map(line => `  ${line.slice(0, 250)}`).join("\n")}`);
  }
});
