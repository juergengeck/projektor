import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const COMM_SERVER_PORT = 18342;
let commserver: ChildProcess | undefined;

test.beforeAll(async () => {
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

/**
 * EK lane contact chat icon: every third-party directory contact carries
 * an "Open chat with …" icon button (the owner's own contact has none), and
 * clicking it opens the 1:1 chat panel and delivers messages both ways over
 * the topic channel.
 */
test("ek lane contact chat icon opens 1:1 chat", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(String(error)));

  await page.goto(`/browser/eklab/?commServer=${encodeURIComponent(`ws://127.0.0.1:${COMM_SERVER_PORT}`)}`);
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  const columns = page.locator("section.lab-column");
  await expect(columns).toHaveCount(4);
  const [admin, manager, seller, customer] = [0, 1, 2, 3].map(n => columns.nth(n));

  // A contact needs its worker's role before its audience can be resolved.
  for (const column of [manager, seller, customer]) {
    await expect(column.getByLabel("Contact name")).toBeDisabled();
  }

  // No generic pairing section: invites live only as QR codes under the apps.
  await expect(page.getByText("Device pairing")).toHaveCount(0);

  // Fixed-size apps: every column keeps its height and scrolls vertically.
  const columnHeight = await columns.nth(0).evaluate(el => getComputedStyle(el).height);
  expect(columnHeight).toBe("720px");
  const bodyOverflow = await columns.nth(0).locator(".lab-column-body").evaluate(el => getComputedStyle(el).overflowY);
  expect(bodyOverflow).toBe("auto");

  // Automatically generated IoM QRs remain below the fixed app frames.
  for (const key of ["Klein", "Bauleiter", "Vorarbeiter", "Werker"]) {
    await expect(page.getByRole("img", { name: `Device invitation QR for ${key}`, exact: true })).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.locator(".lab-column-body .lab-device-invite")).toHaveCount(0);

  await admin.getByRole("button", { name: "Appoint Bauleiter" }).click();
  await expect(manager.locator(".badge-accent").first()).toBeVisible({ timeout: 90_000 });
  await manager.getByRole("button", { name: "Appoint Vorarbeiter" }).click();
  await expect(seller.locator(".badge-info").first()).toBeVisible({ timeout: 90_000 });
  await seller.getByRole("button", { name: "Appoint Werker" }).click();

  await seller.getByLabel("Contact name").fill("Seller One");
  await seller.getByRole("button", { name: "Publish Contact" }).click();
  await customer.getByLabel("Contact name").fill("Customer One");
  await customer.getByRole("button", { name: "Publish Contact" }).click();
  await expect(seller.getByText("Customer One").first()).toBeVisible({ timeout: 90_000 });
  await expect(customer.getByText("Seller One").first()).toBeVisible({ timeout: 90_000 });

  // The icon opens the chat; the owner's own contact carries no icon.
  await expect(seller.getByRole("button", { name: "Open chat with Customer One" })).toBeVisible();
  await expect(seller.getByRole("button", { name: "Open chat with Seller One" })).toHaveCount(0);
  await seller.getByRole("button", { name: "Open chat with Customer One" }).click();
  const sellerChat = seller.locator('.lab-chat[aria-label="Chat with Customer One"]');
  await expect(sellerChat).toBeVisible({ timeout: 30_000 });

  await sellerChat.getByLabel("Message Customer One").fill("icon hello");
  await sellerChat.getByRole("button", { name: "Send" }).click();
  await expect(sellerChat.getByText("icon hello")).toBeVisible({ timeout: 30_000 });

  // The customer's closed chat raises an unread notification badge …
  await expect(customer.locator(".lab-chat-badge").first()).toBeVisible({ timeout: 60_000 });

  await customer.getByRole("button", { name: "Open chat with Seller One" }).click();
  const customerChat = customer.locator('.lab-chat[aria-label="Chat with Seller One"]');
  // … which clears the moment the chat opens.
  await expect(customer.locator(".lab-chat-badge")).toHaveCount(0, { timeout: 30_000 });
  await expect(customerChat.getByText("icon hello")).toBeVisible({ timeout: 90_000 });

  // The seller's address book stays with the seller: staff never sees it,
  // even after a full chat round-trip synced across the mesh.
  await expect(manager.getByText("Customer One")).toHaveCount(0);
  await expect(admin.getByText("Customer One")).toHaveCount(0);

  if (errors.length) {
    throw new Error(`console/page errors:\n${errors.slice(0, 5).map(line => `  ${line.slice(0, 250)}`).join("\n")}`);
  }
});
