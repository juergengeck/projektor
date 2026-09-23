import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

const COMM_SERVER_PORT = 18342;
let commserver: ChildProcess | undefined;

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

/**
 * EK lane contact chat icon: every third-party directory contact carries
 * an "Open chat with …" icon button (the owner's own contact has none), and
 * clicking it opens the 1:1 chat panel and delivers messages both ways over
 * the topic channel. Role actions run inside the lane-app iframes; the host
 * shell only carries the column chrome and the IoM invitations.
 */
test("ek lane contact chat icon opens 1:1 chat", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(String(error)));

  await page.goto(process.env.EK_DEMO_URL ?? `/lab/ek?commServer=${encodeURIComponent(`ws://127.0.0.1:${COMM_SERVER_PORT}`)}`);
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  const columns = page.locator("section.lab-column");
  await expect(columns).toHaveCount(4);
  const frames = page.frameLocator("section.lab-column iframe");
  const [admin, manager, seller, customer] = [0, 1, 2, 3].map(n => frames.nth(n));

  // A contact needs its instance's role before its audience can be resolved.
  for (const frame of [manager, seller, customer]) {
    await expect(frame.getByLabel("Display name")).toBeDisabled();
  }

  // No generic pairing section: invites live only as QR codes under the apps.
  await expect(page.getByText("Device pairing")).toHaveCount(0);

  // App frames keep their height; columns grow with the content and only the page scrolls.
  const frameHeight = await columns.nth(0).locator("iframe").evaluate(el => getComputedStyle(el).height);
  expect(frameHeight).toBe("720px");
  const bodyOverflow = await frames.nth(0).locator(".lane-app-body").evaluate(el => getComputedStyle(el).overflowY);
  expect(bodyOverflow).toBe("visible");
  // Lane apps never pan horizontally inside their iframes.
  const lanePan = await frames.nth(0).locator("body").evaluate(el => {
    const lane = el.ownerDocument.querySelector(".amway-lane, .ek-lane");
    return { overflowX: getComputedStyle(el).overflowX, touchAction: lane ? getComputedStyle(lane).touchAction : "missing" };
  });
  expect(lanePan).toEqual({ overflowX: "hidden", touchAction: "pan-y" });

  // Automatically generated IoM QRs remain below the app frames.
  for (const key of ["Klein", "Bauleiter", "Vorarbeiter", "Werker"]) {
    await expect(page.getByRole("img", { name: `Device invitation QR for ${key}`, exact: true })).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.locator(".lab-column-frame .lab-device-invite")).toHaveCount(0);

  await admin.getByRole("button", { name: "Appoint Bauleiter" }).click();
  await expect(columns.nth(1).locator(".badge-accent").first()).toBeVisible({ timeout: 90_000 });
  await manager.getByRole("button", { name: "Appoint Vorarbeiter" }).click();
  await expect(columns.nth(2).locator(".badge-info").first()).toBeVisible({ timeout: 90_000 });
  await seller.getByRole("button", { name: "Appoint Werker" }).click();

  await seller.getByLabel("Display name").fill("Seller One");
  await seller.getByRole("button", { name: "Save name" }).click();
  await customer.getByLabel("Display name").fill("Customer One");
  await customer.getByRole("button", { name: "Save name" }).click();
  await expect(seller.getByText("Customer One").first()).toBeVisible({ timeout: 90_000 });
  await expect(customer.getByText("Seller One").first()).toBeVisible({ timeout: 90_000 });

  // The icon opens the chat; the owner's own contact carries no icon.
  await expect(seller.locator('button[aria-label="Open chat with Customer One"]')).toBeVisible();
  await expect(seller.locator('button[aria-label="Open chat with Seller One"]')).toHaveCount(0);
  await seller.locator('button[aria-label="Open chat with Customer One"]').click();
  const sellerChat = seller.locator('.lab-chat[aria-label="Chat with Customer One"]');
  await expect(sellerChat).toBeVisible({ timeout: 30_000 });

  await sellerChat.getByLabel("Message Customer One").fill("icon hello");
  await sellerChat.getByRole("button", { name: "Send" }).click();
  await expect(sellerChat.getByText("icon hello")).toBeVisible({ timeout: 30_000 });

  // The customer's closed chat raises an unread notification badge …
  await expect(customer.locator(".lab-chat-badge")).toHaveText("1", { timeout: 60_000 });

  // Repeated text is a separate message; one send must add exactly one unread.
  await sellerChat.getByLabel("Message Customer One").fill("icon hello");
  await sellerChat.getByRole("button", { name: "Send" }).click();
  await expect(sellerChat.getByText("icon hello", { exact: true })).toHaveCount(2);
  await expect(customer.locator(".lab-chat-badge")).toHaveText("2", { timeout: 60_000 });
  await expect(seller.locator(".lab-chat-badge")).toHaveCount(0);

  await customer.locator('button[aria-label="Open chat with Seller One"]').click();
  const customerChat = customer.locator('.lab-chat[aria-label="Chat with Seller One"]');
  // … which clears the moment the chat opens.
  await expect(customer.locator(".lab-chat-badge")).toHaveCount(0, { timeout: 30_000 });
  await expect(customerChat.getByText("icon hello", { exact: true })).toHaveCount(2, { timeout: 90_000 });

  await customerChat.getByRole("button", { name: "Close chat" }).click();
  await sellerChat.getByLabel("Message Customer One").fill("one more");
  await sellerChat.getByRole("button", { name: "Send" }).click();
  await expect(customer.locator(".lab-chat-badge")).toHaveText("1", { timeout: 60_000 });

  // The seller's address book stays with the seller: staff never sees it,
  // even after a full chat round-trip synced across the mesh.
  await expect(manager.getByText("Customer One")).toHaveCount(0);
  await expect(admin.getByText("Customer One")).toHaveCount(0);

  if (errors.length) {
    throw new Error(`console/page errors:\n${errors.slice(0, 5).map(line => `  ${line.slice(0, 250)}`).join("\n")}`);
  }
});
