// packages/lab.core/brand.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK, LAB_BRANDS, brandById } from "./brand.ts";

test("brands keep today's stored and wire identifiers", () => {
  assert.equal(AMWAY.typePrefix, "Amway");
  assert.equal(EK.typePrefix, "Ek");
  assert.deepEqual(AMWAY.stock, { lot: "demo-lot-a", facility: "demo-facility" });
  assert.deepEqual(EK.stock, { lot: "ek-lot-a", facility: "ek-facility" });
  assert.equal(AMWAY.emailDomain, "lab.local");
  assert.equal(EK.emailDomain, "ek.local");
});

test("storage prefixes are unique per brand on a shared origin", () => {
  // Both lanes are served from one origin; a shared IndexedDB prefix lets one
  // lane's session pruning delete the other lane's live databases.
  const prefixes = LAB_BRANDS.map(brand => brand.storagePrefix);
  assert.equal(new Set(prefixes).size, prefixes.length);
});

test("brandById rejects unknown brands", () => {
  assert.equal(brandById("ek"), EK);
  assert.throws(() => brandById("flexibel"), /unknown brand "flexibel"/);
});
