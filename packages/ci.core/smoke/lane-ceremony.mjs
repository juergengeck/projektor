// packages/ci.core/smoke/lane-ceremony.mjs
/**
 * The shared smoke ceremony for every browser lane: boot the four-column
 * lane through its entry with a silent console, walk the appointment chain,
 * publish, share down, buy, and hold the confirmed purchase. Role actions
 * run inside the lane-app iframes (frameLocator); column chrome (roles) is
 * read from the host shell. Throws a lane-tagged error on the first
 * deviation.
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
  const frames = page.frameLocator("section.lab-column iframe");
  const [admin, manager, seller, customer] = [0, 1, 2, 3].map(n => frames.nth(n));

  await expect(manager.getByRole("button", { name: `Appoint ${lane.roleLabels.seller}` })).toBeDisabled();
  await expect(manager.getByRole("button", { name: "+ Offer (100.00€)" })).toBeDisabled();

  await admin.getByRole("button", { name: `Appoint ${lane.roleLabels.manager}` }).click();
  // The appointment replicates over the mesh and the host re-snapshots the
  // column through its transition observer.
  await expect(columns.nth(1).locator(".badge-accent")).toBeVisible({ timeout: 60_000 });
  await expect(manager.getByRole("button", { name: `Appoint ${lane.roleLabels.seller}` })).toBeEnabled();
  await expect(manager.getByRole("button", { name: "+ Offer (100.00€)" })).toBeEnabled();

  await manager.getByRole("button", { name: `Appoint ${lane.roleLabels.seller}` }).click();
  await expect(columns.nth(2).locator(".badge-info")).toBeVisible({ timeout: 60_000 });

  await seller.getByRole("button", { name: `Appoint ${lane.roleLabels.customer}` }).click();
  await expect(columns.nth(3).locator(".badge-success")).toBeVisible({ timeout: 60_000 });
  // No opening stock exists: purchasing (admin) receives goods before
  // anything is offered, shared, or sold.
  await admin.getByLabel("Receipt ID").fill(`${lane.id}-ceremony-receipt-1`);
  await admin.getByRole("button", { name: "Receive stock" }).click();
  await manager.getByRole("button", { name: "+ Offer (100.00€)" }).click();
  // Publishing discloses nothing: the manager shares the offer down with
  // the chosen seller first, the seller then with the customer.
  await manager.getByRole("button", { name: `Share ${lane.offerId} with ${lane.shareRecipient}` }).click();
  await seller.getByRole("button", { name: `Share ${lane.offerId} down` }).click();
  await customer.getByRole("button", { name: /Buy 1x/ }).click();

  await expect(customer.getByRole("button", { name: `${lane.ordersTab} (1)` })).toBeVisible({ timeout: 60_000 });
  await expect(customer.getByRole("region", { name: "Purchase history" }).getByText("Confirmed", { exact: true }))
    .toBeVisible({ timeout: 60_000 });

  if (errors.length) {
    throw new Error(`${tag}: console/page errors:\n${errors.slice(0, 5).map(line => `  ${line.slice(0, 250)}`).join("\n")}`);
  }
}
