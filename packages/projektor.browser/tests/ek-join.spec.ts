import { spawn, type ChildProcess } from "node:child_process";
import { connect } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

/**
 * EK lane invitation link: the QR-encoded lane URL opens the join banner
 * and pairs a same-person second device through the commserver.
 */
const COMM_SERVER_PORT = 18344;
const commServerUrl = process.env.LAB_COMM_SERVER_URL || `ws://127.0.0.1:${COMM_SERVER_PORT}`;
let commserver: ChildProcess | undefined;

test.beforeAll(async () => {
  if (process.env.LAB_COMM_SERVER_URL) return;
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

for (const entry of ["/browser/eklab/", "/browser/#/eklab"]) {
test(`ek lane invitation from ${entry} pairs a second device`, async ({ page, browser }) => {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(String(error)));

  const entryUrl = new URL(entry, "http://127.0.0.1:4276");
  entryUrl.searchParams.set("commServer", commServerUrl);
  await page.goto(entryUrl.toString());
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  const columns = page.locator(".lab-device");
  const seller = columns.nth(2);

  // Each role gets a real invite without clicking or scrolling its app body.
  for (const key of ["Klein", "Bauleiter", "Vorarbeiter", "Werker"]) {
    await expect(page.getByRole("img", { name: `Device invitation QR for ${key}`, exact: true })).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.locator(".lab-column-body .lab-device-invite")).toHaveCount(0);
  const appBounds = await seller.locator(".lab-column").boundingBox();
  const inviteBounds = await seller.locator(".lab-device-invite").boundingBox();
  expect(inviteBounds!.y).toBeGreaterThanOrEqual(appBounds!.y + appBounds!.height);

  await expect(seller.getByRole("img", { name: "Device invitation QR for Vorarbeiter" })).toBeVisible({ timeout: 60_000 });
  const invitationUrl = await seller.getByLabel("Device invitation URL").inputValue();
  const invitation = JSON.parse(decodeURIComponent(new URL(invitationUrl).hash.slice(1)));
  expect(invitation.mode).toBe("IoM");
  expect(invitation.identityRelation).toBe("same-person");
  await seller.getByRole("button", { name: "Enlarge device invitation QR for Vorarbeiter" }).click();
  await expect(seller.getByRole("dialog", { name: "Device invitation for Vorarbeiter" })).toBeVisible();
  await seller.getByRole("button", { name: "Close QR" }).click();


  // Opening the QR link on a second device offers the join while the
  // inviting tab stays alive holding the pairing listener. A separate
  // browser context keeps the two devices' storage isolated.
  const joinUrl = invitationUrl.replace("#", `&commServer=${encodeURIComponent(commServerUrl)}#`);
  const joinContext = await browser.newContext();
  const joinPage = await joinContext.newPage();
  joinPage.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  joinPage.on("pageerror", error => errors.push(String(error)));
  await joinPage.goto(joinUrl);
  await expect(joinPage.getByRole("dialog", { name: "Join with device invitation" })).toBeVisible({ timeout: 60_000 });
  await joinPage.getByRole("button", { name: "Join", exact: true }).click();
  await expect(joinPage.getByText("device paired ✓")).toBeVisible({ timeout: 120_000 });
  await expect(seller.getByText("device paired ✓")).toBeVisible({ timeout: 30_000 });
  await joinContext.close();

  if (errors.length) {
    throw new Error(`console/page errors:\n${errors.slice(0, 5).map(line => `  ${line.slice(0, 250)}`).join("\n")}`);
  }
});
}
