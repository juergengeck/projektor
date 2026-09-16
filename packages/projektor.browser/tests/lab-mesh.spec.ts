import { expect, test, type Page } from "@playwright/test";

/**
 * Lab mesh smoke test. Boots the real #/lab shell (four Web Workers,
 * invite pairing, CHUM sync) and requires two things: all four role
 * columns reach the live mesh badge, and the console stays silent.
 * Pairing races that only appear across real workers — never under the
 * node fake-port harness — fail this test instead of hiding in logs.
 */
async function collectErrors(page: Page): Promise<{ consoleErrors: string[]; pageErrors: string[] }> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const recordError = (source: string) => (message: { text(): string }) => {
    consoleErrors.push(`${source} ${message.text()}`);
  };
  page.on("console", message => {
    if (message.type() === "error") recordError("[page]")(message);
  });
  page.on("pageerror", error => pageErrors.push(`[page] ${error.message}`));
  page.on("worker", worker => {
    worker.on("console", message => {
      if (message.type() === "error") recordError("[worker]")(message);
    });
    worker.on("pageerror", error => pageErrors.push(`[worker] ${error.message}`));
  });
  return { consoleErrors, pageErrors };
}

test("lab mesh boots four live columns with a silent console", async ({ page }) => {
  const { consoleErrors, pageErrors } = await collectErrors(page);

  await page.goto("/browser/#/lab");

  // Mesh badge only reads 4/4 once boot is live and every column is online.
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  await expect(page.locator("section.lab-column")).toHaveCount(4);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

/**
 * Appointment ceremony: boot seeds pairing and the department only, so no
 * column holds a role and the manager's Appoint Seller and offer buttons
 * start disabled. Clicking Appoint Manager unlocks the manager column;
 * clicking Appoint Seller then projects the seller role. Each step stays
 * silent on page and worker consoles.
 */
test("appointments unlock capabilities in ceremony order", async ({ page }) => {
  const { consoleErrors, pageErrors } = await collectErrors(page);

  await page.goto("/browser/#/lab");
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  // Column order follows LAB_KEYS: admin, manager, seller, customer.
  const columns = page.locator("section.lab-column");
  const adminColumn = columns.nth(0);
  const managerColumn = columns.nth(1);
  const sellerColumn = columns.nth(2);

  await expect(managerColumn.locator(".badge-accent")).toHaveCount(0);
  await expect(managerColumn.getByRole("button", { name: "Appoint Seller" })).toBeDisabled();
  await expect(managerColumn.getByRole("button", { name: "+ Offer (100.00€)" })).toBeDisabled();

  await adminColumn.getByRole("button", { name: "Appoint Manager" }).click();
  await expect(managerColumn.locator(".badge-accent")).toBeVisible({ timeout: 60_000 });
  await expect(managerColumn.getByRole("button", { name: "Appoint Seller" })).toBeEnabled();

  await managerColumn.getByRole("button", { name: "Appoint Seller" }).click();
  await expect(sellerColumn.locator(".badge-info")).toBeVisible({ timeout: 60_000 });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
