// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/lab/theme.test.ts (5e0370c5b); replace with the shared lane-shell package in Phase 4.
import test from "node:test";
import assert from "node:assert/strict";
import { nextLabThemeMode, parseLabThemeMode, resolveLabEffectiveTheme } from "./theme.ts";

test("cycles light -> dark -> system -> light through one toggle", () => {
  assert.equal(nextLabThemeMode("light"), "dark");
  assert.equal(nextLabThemeMode("dark"), "system");
  assert.equal(nextLabThemeMode("system"), "light");
});

test("resolves system from the OS scheme and keeps explicit modes", () => {
  assert.equal(resolveLabEffectiveTheme("system", true), "dark");
  assert.equal(resolveLabEffectiveTheme("system", false), "light");
  assert.equal(resolveLabEffectiveTheme("dark", false), "dark");
  assert.equal(resolveLabEffectiveTheme("light", true), "light");
});

test("reads stored preferences including legacy light/dark values", () => {
  assert.equal(parseLabThemeMode("system"), "system");
  assert.equal(parseLabThemeMode("dark"), "dark");
  assert.equal(parseLabThemeMode("light"), "light");
  assert.equal(parseLabThemeMode("sepia"), null);
  assert.equal(parseLabThemeMode(null), null);
});
