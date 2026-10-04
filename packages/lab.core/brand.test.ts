// packages/lab.core/brand.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK, IGM, LAB_BRANDS, brandById } from "./brand.ts";
import { commServerPortFor } from "./test/brand.ts";

test("brands keep today's stored and wire identifiers", () => {
  assert.equal(AMWAY.typePrefix, "Amway");
  assert.equal(EK.typePrefix, "Ek");
  assert.deepEqual(AMWAY.stock, { lot: "demo-lot-a", facility: "demo-facility" });
  assert.deepEqual(EK.stock, { lot: "ek-lot-a", facility: "ek-facility" });
  assert.equal(AMWAY.emailDomain, "lab.local");
  assert.equal(EK.emailDomain, "ek.local");
  assert.equal(IGM.typePrefix, "Igm");
  assert.deepEqual(IGM.stock, { lot: "igm-lot-a", facility: "igm-facility" });
  assert.equal(IGM.emailDomain, "igm.local");
});

test("lane identities and test ports are isolated", () => {
  for (const field of ["id", "typePrefix", "emailDomain", "orderKeyPrefix", "lane"] as const) {
    assert.equal(new Set(LAB_BRANDS.map(brand => brand[field])).size, LAB_BRANDS.length, field);
  }
  for (const values of [LAB_BRANDS.map(brand => brand.department.id), LAB_BRANDS.map(brand => brand.stock.lot), LAB_BRANDS.map(brand => brand.stock.facility), LAB_BRANDS.map(commServerPortFor)]) {
    assert.equal(new Set(values).size, LAB_BRANDS.length);
  }
  assert.equal(IGM.appointmentAuthority, "admin");
  assert.equal(EK.appointmentAuthority, "admin");
  assert.equal(AMWAY.appointmentAuthority, "chain");
});

test("storage prefixes are unique per brand on a shared origin", () => {
  // Both lanes are served from one origin; a shared IndexedDB prefix lets one
  // lane's session pruning delete the other lane's live databases.
  const prefixes = LAB_BRANDS.map(brand => brand.storagePrefix);
  assert.equal(new Set(prefixes).size, prefixes.length);
});

test("brandById rejects unknown brands", () => {
  assert.equal(brandById("ek"), EK);
  assert.equal(brandById("igm"), IGM);
  assert.throws(() => brandById("flexibel"), /unknown brand "flexibel"/);
});
