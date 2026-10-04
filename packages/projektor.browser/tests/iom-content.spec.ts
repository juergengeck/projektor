import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { LANES } from "../../ci.core/lanes.mjs";
import { runLaneCeremony } from "../../ci.core/smoke/lane-ceremony.mjs";

const port = 18449;
const commServer = process.env.LAB_COMM_SERVER_URL ?? `ws://127.0.0.1:${port}`;
let server: ChildProcess;

test.beforeAll(async () => {
  if (process.env.LAB_COMM_SERVER_URL) return;
  const bundle = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../one/packages/one.models/comm_server.bundle.js");
  server = spawn(process.execPath, [bundle, "-h", "127.0.0.1", "-p", String(port)], { stdio: "ignore" });
  const deadline = Date.now() + 30_000;
  for (;;) {
    const ready = await new Promise<boolean>(resolve => {
      const socket = connect(port, "127.0.0.1");
      socket.on("connect", () => { socket.end(); resolve(true); });
      socket.on("error", () => resolve(false));
    });
    if (ready) return;
    if (Date.now() >= deadline) throw new Error("IoM test commserver failed to start");
    await new Promise(resolve => setTimeout(resolve, 100));
  }
});

test.afterAll(() => server?.kill());

for (const lane of LANES) {
  test(`${lane.id} joined device displays received content and resolves its owner and recipients`, async ({ page, browser }) => {
    const entry = new URL(lane.entry, process.env.LAB_DEMO_ORIGIN ?? "http://127.0.0.1:4276");
    entry.searchParams.set("commServer", commServer);
    await page.goto(entry.toString());
    await runLaneCeremony(page, lane, expect);
    const seller = page.frameLocator("section.lab-column iframe").nth(2);
    const invitation = await page.locator(".lab-device").nth(2).getByLabel("Device invitation URL").inputValue();
    const joinUrl = new URL(invitation);
    joinUrl.searchParams.set("commServer", commServer);
    const context = await browser.newContext();
    try {
      const joined = await context.newPage();
      await joined.goto(joinUrl.toString());
      await expect(joined.locator(".lab-header")).toHaveCount(0);
      await joined.getByRole("button", { name: "Join", exact: true }).click();
      await expect(joined.locator(".invited-role-app")).toHaveAttribute("data-paired", "true", { timeout: 120_000 });
      await expect(joined.locator(".lab-header")).toHaveCount(0);
      await expect(joined.getByRole("dialog")).toHaveCount(0);
      await expect(joined.locator("iframe")).toHaveCount(1);
      const app = joined.frameLocator("iframe");
      await expect(app.getByRole("heading", { name: lane.roleLabels.seller, exact: true })).toBeVisible();
      const bounds = await joined.locator("iframe").boundingBox();
      expect(bounds?.height).toBe(joined.viewportSize()!.height);
      expect(bounds?.width).toBe(joined.viewportSize()!.width);
      if (lane.id === "igm") {
        // Accept on device B: the saved handoff must reach A and its upstream Bauleiter.
        const accept = app.getByRole("button", { name: `Accept (${lane.offerId})`, exact: true });
        await expect(accept).toBeEnabled({ timeout: 60_000 });
        await app.getByLabel(`Acceptance quantity (${lane.offerId})`, { exact: true }).fill("3");
        await accept.click();
        await expect(app.getByRole("button", { name: `Accepted (${lane.offerId})`, exact: true })).toBeDisabled({ timeout: 60_000 });
        const upstream = page.frameLocator("section.lab-column iframe").nth(1);
        await expect(upstream.locator(".lab-handoff-card")).toHaveCount(1, { timeout: 60_000 });
        await expect(upstream.locator(".lab-handoff-card").getByText("Qty: 3", { exact: true })).toBeVisible();
        await expect(seller.locator(".lab-handoff-card")).toHaveCount(1, { timeout: 60_000 });
        await expect(seller.getByRole("button", { name: `Accepted (${lane.offerId})`, exact: true })).toBeDisabled();
      }
      // These rows were received from other mesh lanes, not created by the inviter.
      await expect(app.getByRole("button", { name: `Share ${lane.offerId} down`, exact: true })).toBeEnabled({ timeout: 60_000 });
      await expect(app.locator(".lab-purchase-card").first()).toBeVisible({ timeout: 60_000 });
      // The owner is discovered from its instance even without ui.setLanePeers.
      await app.getByLabel("Display name", { exact: true }).fill("Joined device seller");
      await app.getByRole("button", { name: "Save name", exact: true }).click();
      await expect(seller.getByText("Joined device seller", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
      const manager = page.frameLocator("section.lab-column iframe").nth(1);
      await expect(manager.getByText("Joined device seller", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
      // Share a new offer exclusively from B; an already shared offer would
      // hide the missing second-hop grant on the inviting device.
      const newOffer = lane.offerId.replace(/-1$/, "-2");
      await manager.getByRole("button", { name: lane.offerButton, exact: true }).click();
      await manager.getByRole("button", { name: `Share ${newOffer} with ${lane.shareRecipient}`, exact: true }).click();
      const share = app.getByRole("button", { name: `Share ${newOffer} down`, exact: true });
      await expect(share).toBeEnabled({ timeout: 60_000 });
      const customer = page.frameLocator("section.lab-column iframe").nth(3);
      await expect(customer.getByText(`🏷️ ${newOffer}`, { exact: true })).toHaveCount(0);
      await share.click();
      await expect(customer.getByText(`🏷️ ${newOffer}`, { exact: true }).first()).toBeVisible({ timeout: 60_000 });

      const customerInvite = await page.locator(".lab-device").nth(3).getByLabel("Device invitation URL").inputValue();
      const customerUrl = new URL(customerInvite);
      customerUrl.searchParams.set("commServer", commServer);
      const customerContext = await browser.newContext();
      try {
        const customerDevice = await customerContext.newPage();
        await customerDevice.goto(customerUrl.toString());
        await customerDevice.getByRole("button", { name: "Join", exact: true }).click();
        await expect(customerDevice.locator(".invited-role-app")).toHaveAttribute("data-paired", "true", { timeout: 120_000 });
        await expect(customerDevice.locator(".lab-header")).toHaveCount(0);
        await expect(customerDevice.getByRole("dialog")).toHaveCount(0);
        const customerApp = customerDevice.frameLocator("iframe");
        await expect(customerApp.getByRole("heading", { name: lane.roleLabels.customer, exact: true })).toBeVisible();
        const buy = customerApp.getByRole("button", { name: new RegExp(`${lane.customerAction ?? "Buy"} 1x`) });
        await expect(buy).toBeEnabled({ timeout: 60_000 });
        await buy.click();
        await expect(customer.getByRole("button", { name: `${lane.ordersTab} (2)`, exact: true })).toBeVisible({ timeout: 60_000 });
        await expect(customerApp.getByRole("button", { name: `${lane.ordersTab} (2)`, exact: true })).toBeVisible({ timeout: 60_000 });
      } finally {
        await customerContext.close();
      }
    } finally {
      await context.close();
    }
  });
}
