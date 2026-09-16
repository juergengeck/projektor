import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import {
  AMWAY_LOGO_PATH,
  AMWAY_LOGO_ASPECT,
  AMWAY_PALETTE,
  AMWAY_FONT_STACK,
  AMWAY_FONT_LICENSED,
} from "./brand.js";
import { createAmwayConfig, requireDepartments, requireIssuers, requirePolicy } from "./config.js";

test("Amway brand tokens match the observed amway.de treatment", () => {
  assert.equal(AMWAY_PALETTE.surface, "#FFFFFF");
  assert.equal(AMWAY_PALETTE.ink, "#2C2C2C");
  assert.equal(AMWAY_PALETTE.neutral, "#F4F4F4");
  assert.equal(AMWAY_PALETTE.accent, "#38539A");
  assert.equal(AMWAY_PALETTE.category.nutrition, "#546223");
  assert.equal(AMWAY_PALETTE.category.beauty, "#7F3E3E");
  assert.equal(AMWAY_PALETTE.category.home, "#396E75");
  assert.ok(AMWAY_FONT_STACK.includes("system-ui"));
  assert.equal(AMWAY_FONT_LICENSED, false);
  assert.equal(AMWAY_LOGO_ASPECT.width / AMWAY_LOGO_ASPECT.height, 71 / 24);
});

test("Amway logo asset is bundled", async () => {
  await access(new URL(AMWAY_LOGO_PATH, import.meta.url));
});

test("Amway config fails fast without operator inputs", () => {
  const empty = createAmwayConfig();
  assert.throws(() => requireDepartments(empty), /department roster is missing/);
  assert.throws(() => requireIssuers(empty), /issuers are missing/);
  assert.throws(() => requirePolicy(empty, "revenue-recognition"), /policy version is missing/);
});

test("Amway config returns supplied roster and policy versions", () => {
  const config = createAmwayConfig({
    departments: [{ id: "dept-nord", name: "Nord" }],
    issuers: { admin: "person:admin-1" },
    policies: { "revenue-recognition": { version: "2026-09-01", basis: "delivery-acceptance" } },
  });
  assert.equal(requireDepartments(config).length, 1);
  assert.equal(requireIssuers(config).admin, "person:admin-1");
  assert.equal(requirePolicy(config, "revenue-recognition").version, "2026-09-01");
});
