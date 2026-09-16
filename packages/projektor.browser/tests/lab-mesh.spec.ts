import { expect, test } from "@playwright/test";

/**
 * Lab mesh smoke test. Boots the real #/lab shell (four Web Workers,
 * invite pairing, CHUM sync) and requires two things: all four role
 * columns reach the live mesh badge, and the console stays silent.
 * Pairing races that only appear across real workers — never under the
 * node fake-port harness — fail this test instead of hiding in logs.
 */
test("lab mesh boots four live columns with a silent console", async ({ page }) => {
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

  await page.goto("/browser/#/lab");

  // Mesh badge only reads 4/4 once boot is live and every column is online.
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  await expect(page.locator("section.lab-column")).toHaveCount(4);

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
