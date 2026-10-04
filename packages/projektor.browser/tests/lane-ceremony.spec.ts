import { test, expect } from "@playwright/test";
import { runLaneCeremony } from "../../ci.core/smoke/lane-ceremony.mjs";
import { LANES } from "../../ci.core/lanes.mjs";

for (const lane of LANES) {
  test(`${lane.id} lane ceremony`, async ({ page }) => {
    await runLaneCeremony(page, lane, expect);
  });
}

/**
 * D4 reload wedge guard on the iframe path: two reloads reboot fresh twice,
 * and the third boot still seeds and replicates — a manager's offer reaches
 * the seller. (Persistence itself waits for a root cause; see the plan.)
 */
for (const lane of LANES) {
  test(`${lane.id} lane reboots fresh and replicates after two reloads`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", error => errors.push(String(error)));

    await page.goto(lane.entry);
    await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
    await page.reload();
    await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
    await page.reload();
    await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });

    const frames = page.frameLocator("section.lab-column iframe");
    const [admin, manager, seller] = [0, 1, 2].map(n => frames.nth(n));

    await admin.getByRole("button", { name: lane.appointmentButtons?.manager ?? `Appoint ${lane.roleLabels.manager}` }).click();
    const appointSeller = (lane.appointmentAuthority === "admin" ? admin : manager).getByRole("button", { name: lane.appointmentButtons?.seller ?? `Appoint ${lane.roleLabels.seller}` });
    await expect(appointSeller).toBeEnabled({ timeout: 90_000 });
    await appointSeller.click();
    const appointCustomer = (lane.appointmentAuthority === "admin" ? admin : seller).getByRole("button", { name: lane.appointmentButtons?.customer ?? `Appoint ${lane.roleLabels.customer}` });
    await expect(appointCustomer).toBeEnabled({ timeout: 90_000 });
    await appointCustomer.click();
    await admin.getByLabel("Receipt ID").fill(`${lane.id}-reload-receipt-1`);
    await admin.getByRole("button", { name: "Receive stock" }).click();
    await manager.getByRole("button", { name: lane.offerButton }).click();
    const share = manager.getByRole("button", { name: `Share ${lane.offerId} with ${lane.shareRecipient}` });
    await expect(share).toBeEnabled({ timeout: 90_000 });
    await share.click();
    // The manager's offer reaches the seller on the third fresh boot.
    await expect(seller.getByRole("button", { name: `Share ${lane.offerId} down` })).toBeEnabled({ timeout: 90_000 });

    if (errors.length) {
      throw new Error(`console/page errors:\n${errors.slice(0, 5).map(line => `  ${line.slice(0, 250)}`).join("\n")}`);
    }
  });
}
