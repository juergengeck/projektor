// packages/lab.core/storage.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK } from "./brand.ts";
import { resolveStorageDirectory, staleSessionDirectories } from "./storage.ts";

test("per-brand, per-role, per-session directories", () => {
  assert.equal(resolveStorageDirectory(AMWAY, "?labInstance=seller&labSession=0a1b2c3d"), "amway-lab-seller-0a1b2c3d");
  assert.equal(resolveStorageDirectory(EK, "?lane=ek&labInstance=seller&labSession=0a1b2c3d"), "ek-lab-seller-0a1b2c3d");
});

test("rejects missing or unsafe instance and session names", () => {
  assert.throws(() => resolveStorageDirectory(AMWAY, "?labSession=0a1b2c3d"), /labInstance must match/);
  assert.throws(() => resolveStorageDirectory(AMWAY, "?labInstance=../x&labSession=0a1b2c3d"), /labInstance must match/);
  assert.throws(() => resolveStorageDirectory(AMWAY, "?labInstance=seller"), /labSession must be 8 hex/);
});

test("prunes only this brand's earlier sessions of this role", () => {
  const names = ["amway-lab-seller-11111111", "amway-lab-seller-22222222", "amway-lab-sellerx-33333333", "ek-lab-seller-44444444", "amway-lab-manager-55555555"];
  assert.deepEqual(staleSessionDirectories(AMWAY, "seller", "amway-lab-seller-22222222", names), ["amway-lab-seller-11111111"]);
});
