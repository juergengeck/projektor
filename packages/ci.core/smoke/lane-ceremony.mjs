// packages/ci.core/smoke/lane-ceremony.mjs
/**
 * The shared smoke ceremony for every browser lane: boot the four-column
 * mesh through the lane entry with a silent console, walk the appointment
 * chain, publish, share down, buy, admit, and hold the purchase. Throws a
 * lane-tagged error on the first deviation.
 */
export async function runLaneCeremony(page, lane, expect) {
  const tag = `lane ${lane.id}`;
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(String(error)));

  await page.goto(lane.entry);
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText(lane.title)).toBeVisible();
  const columns = page.locator("section.lab-column");
  await expect(columns).toHaveCount(4);
  const [admin, manager, seller, customer] = [0, 1, 2, 3].map(n => columns.nth(n));

  await expect(manager.locator(".badge-accent")).toHaveCount(0);
  await expect(manager.getByRole("button", { name: "Appoint Seller" })).toBeDisabled();
  await expect(manager.getByRole("button", { name: "+ Offer (100.00€)" })).toBeDisabled();

  await admin.getByRole("button", { name: "Appoint Manager" }).click();
  await expect(manager.locator(".badge-accent")).toBeVisible({ timeout: 60_000 });
  await expect(manager.getByRole("button", { name: "Appoint Seller" })).toBeEnabled();

  await manager.getByRole("button", { name: "Appoint Seller" }).click();
  await expect(seller.locator(".badge-info")).toBeVisible({ timeout: 60_000 });

  await seller.getByRole("button", { name: "Appoint Customer" }).click();
  await manager.getByRole("button", { name: "+ Offer (100.00€)" }).click();
  await seller.getByRole("button", { name: `Share ${lane.offerId} down` }).click();
  await customer.getByRole("button", { name: /Buy 1x/ }).click();

  // The seller admits nothing invented: the button exists only for the placed order.
  const admit = seller.getByRole("button", { name: new RegExp(`Admit ${lane.offerId}`) });
  await admit.waitFor({ timeout: 60_000 });
  await admit.click();
  await expect(customer.getByRole("button", { name: "Orders (1)" })).toBeVisible({ timeout: 60_000 });

  if (errors.length) {
    throw new Error(`${tag}: console/page errors:\n${errors.slice(0, 5).map(line => `  ${line.slice(0, 250)}`).join("\n")}`);
  }
}
