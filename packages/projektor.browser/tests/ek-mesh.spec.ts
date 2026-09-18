import { test, expect } from "@playwright/test";

/**
 * EK lane smoke: the Elektro Klein lane boots the same four-column mesh
 * through its own entry and honors the same ceremony order. Mirrors
 * lab-mesh.spec.ts; the ek.lab worker suite owns the deep assertions.
 */
test("ek lane boots four live columns with a silent console", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", error => errors.push(String(error)));

  await page.goto("/browser/eklab/");
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText("EK lab")).toBeVisible();
  await expect(page.locator("section.lab-column")).toHaveCount(4);
  expect(errors).toEqual([]);
});

test("ek appointments unlock capabilities in ceremony order", async ({ page }) => {
  await page.goto("/browser/eklab/");
  await expect(page.getByText("Mesh: 4/4 Nodes Online")).toBeVisible({ timeout: 180_000 });

  const columns = page.locator("section.lab-column");
  const managerColumn = columns.nth(1);
  const sellerColumn = columns.nth(2);

  await expect(managerColumn.locator(".badge-accent")).toHaveCount(0);
  await expect(managerColumn.getByRole("button", { name: "Appoint Seller" })).toBeDisabled();
  await expect(managerColumn.getByRole("button", { name: "+ Offer (100.00€)" })).toBeDisabled();

  await columns.nth(0).getByRole("button", { name: "Appoint Manager" }).click();
  await expect(managerColumn.locator(".badge-accent")).toBeVisible({ timeout: 60_000 });
  await expect(managerColumn.getByRole("button", { name: "Appoint Seller" })).toBeEnabled();

  await managerColumn.getByRole("button", { name: "Appoint Seller" }).click();
  await expect(sellerColumn.locator(".badge-info")).toBeVisible({ timeout: 60_000 });
});
