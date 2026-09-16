import assert from "node:assert/strict";
import { test } from "node:test";
import { AmwayDirectory } from "./departments.js";
import { AmwayPhoneBook } from "./phonebook.js";
import { AmwayShop } from "../shop.amway/shop.js";
import { AmwayLifecycle } from "../shop.amway/lifecycle.js";
import { AmwaySubscriptions } from "../shop.amway/subscriptions.js";
import { buildDemoDepartment } from "./demo.js";
import { createAmwayDepartmentRoot, buildDepartmentSnapshot } from "./publication.js";

function demoed() {
  const directory = new AmwayDirectory({ bootstrapIssuers: [], now: () => 1_000 });
  const phonebook = new AmwayPhoneBook({ directory, now: () => 1_000 });
  const shop = new AmwayShop({ now: () => 1_000 });
  const lifecycle = new AmwayLifecycle({ shop, now: () => 1_000 });
  const subscriptions = new AmwaySubscriptions({ shop, now: () => 1_000 });
  const modules = { directory, phonebook, shop, lifecycle, subscriptions };
  buildDemoDepartment(modules, { atTime: 1_000 });
  return modules;
}

test("department snapshots are canonical and stable for identical state", () => {
  const source = demoed();
  const a = buildDepartmentSnapshot(source, "demo-de", { exportedAt: 2_000 });
  const b = buildDepartmentSnapshot(source, "demo-de", { exportedAt: 2_000 });
  assert.deepEqual(a, b);
  assert.equal(a.counts.items, 34);
  assert.ok(a.counts.members >= 6);
  assert.equal(a.counts.orders, 2);
  const catalog = JSON.parse(a.root.catalog);
  assert.equal(catalog.items[0].itemNumber, "AMWAY-HOME-DISH-DROPS-1L");
  assert.ok(catalog.items.every(entry => typeof entry.name === "string"));
  const members = JSON.parse(a.root.members);
  assert.ok(members.some(entry => entry.subject === "person:demo-manager" && entry.role === "manager"));
});

test("snapshot builder rejects unknown departments and bad roots", () => {
  const source = demoed();
  assert.throws(() => buildDepartmentSnapshot(source, "west", { exportedAt: 1 }), /unknown department/);
  assert.throws(() => createAmwayDepartmentRoot({
    department: "", exportedAt: 1, catalog: "[]", members: "[]", orders: "[]",
  }), /required/);
  assert.throws(() => createAmwayDepartmentRoot({
    department: "demo-de", exportedAt: -1, catalog: "[]", members: "[]", orders: "[]",
  }), /exportedAt/);
});
