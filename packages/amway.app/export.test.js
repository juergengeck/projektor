import assert from "node:assert/strict";
import { test } from "node:test";
import { AmwayDirectory } from "./departments.js";
import { AmwayPhoneBook } from "./phonebook.js";
import { AmwayShop } from "../shop.amway/shop.js";
import { AmwayLifecycle } from "../shop.amway/lifecycle.js";
import { AmwaySubscriptions } from "../shop.amway/subscriptions.js";
import { AmwayReturns } from "../shop.amway/returns.js";
import { AmwayReconciliation } from "../shop.amway/reconciliation.js";
import { exportDepartment, importDepartment, lifecycleFromExport } from "./export.js";
import { buildDemoDepartment } from "./demo.js";

function freshModules() {
  const directory = new AmwayDirectory({ bootstrapIssuers: [], now: () => 1_000 });
  const phonebook = new AmwayPhoneBook({ directory, now: () => 1_000 });
  const shop = new AmwayShop({ now: () => 1_000 });
  const lifecycle = new AmwayLifecycle({ shop, now: () => 1_000 });
  const subscriptions = new AmwaySubscriptions({ shop, now: () => 1_000 });
  const returns = new AmwayReturns({ shop, now: () => 1_000 });
  const reconciliation = new AmwayReconciliation({ shop, returns, now: () => 1_000 });
  return { directory, phonebook, shop, lifecycle, subscriptions, returns, reconciliation };
}

function demoed() {
  const modules = freshModules();
  const demo = buildDemoDepartment(modules, { atTime: 1_000 });
  assert.equal(demo.department, "demo-de");
  assert.equal(demo.replayed, false);
  assert.equal(buildDemoDepartment(modules, { atTime: 1_000 }).replayed, true);
  return modules;
}

test("demo builds a settled sale, certified contact, and subscription", () => {
  const modules = demoed();
  const view = modules.lifecycle.projection(
    [...modules.shop.transactions.values()][0].id,
  );
  assert.equal(view.recognized, 20000);
  assert.equal(view.cash, 20000);
  const contacts = modules.phonebook.contactsFor({
    viewer: "person:demo-customer", department: "demo-de", atTime: 1_500,
  });
  assert.equal(contacts.length, 2);
  assert.equal(modules.subscriptions.ordersFor("sub-1").length, 0);
});

test("export round-trips into fresh modules with identical state", () => {
  const source = demoed();
  const envelope = exportDepartment(source, "demo-de", { exportedBy: "person:amway-de", exportId: "export-test-1" });
  assert.equal(envelope.format, "amway.department-export");
  assert.equal(envelope.trust.status, "unverified");
  assert.equal(envelope.trust.signature, null);

  const target = freshModules();
  target.directory.bootstrapIssuers.add("person:amway-de");
  const result = importDepartment(target, envelope, { importedBy: "person:ops", imports: new Map() });
  assert.equal(result.department, "demo-de");
  assert.equal(result.trustStatus, "unverified");
  assert.equal(result.lifecycle, "restored");
  assert.ok(result.imported > 0);

  const tx = [...target.shop.transactions.values()][0];
  assert.deepEqual(target.lifecycle.projection(tx.id), source.lifecycle.projection(tx.id));
  assert.deepEqual(
    target.phonebook.contactsFor({ viewer: "person:demo-customer", department: "demo-de", atTime: 1_500 }),
    source.phonebook.contactsFor({ viewer: "person:demo-customer", department: "demo-de", atTime: 1_500 }),
  );
  // The envelope carries one department; assignments outside demo-de
  // (the demo ships a second department) never cross the export boundary.
  assert.deepEqual(
    [...target.directory.assignments.values()],
    [...source.directory.assignments.values()].filter(entry => entry.department === "demo-de"),
  );

  const replayed = importDepartment(target, envelope, { importedBy: "person:ops", imports: new Map([["export-test-1", result]]) });
  assert.equal(replayed.replayed, true);
});

test("elevated signers import as trusted; conflicts fail", () => {
  const source = demoed();
  const envelope = exportDepartment(source, "demo-de", { exportedBy: "person:amway-de", exportId: "export-test-2" });
  const target = freshModules();
  target.directory.bootstrapIssuers.add("person:amway-de");
  const elevated = importDepartment(target, envelope, {
    importedBy: "person:ops", elevate: true, imports: new Map(),
  });
  assert.equal(elevated.trustStatus, "trusted");
  const trusted = importDepartment(freshModulesWithRoot(), envelope, {
    importedBy: "person:ops", imports: new Map(), trustedSigners: new Set(["person:amway-de"]),
  });
  assert.equal(trusted.trustStatus, "trusted");

  function freshModulesWithRoot() {
    const modules = freshModules();
    modules.directory.bootstrapIssuers.add("person:amway-de");
    return modules;
  }

  // A conflicting envelope against already-imported state is rejected.
  const tampered = JSON.parse(JSON.stringify(envelope));
  tampered.exportId = "export-test-2b";
  tampered.data.assignments[0].role = "admin";
  assert.throws(() => importDepartment(target, tampered, {
    importedBy: "person:ops", imports: new Map(), elevate: true,
  }), /conflicting/);
});

test("lifecycle rebuilds from the exported log alone", () => {
  const source = demoed();
  const envelope = exportDepartment(source, "demo-de", { exportedBy: "person:amway-de", exportId: "export-test-3" });
  const target = freshModules();
  target.directory.bootstrapIssuers.add("person:amway-de");
  importDepartment(target, envelope, { importedBy: "person:ops", imports: new Map() });
  const rebuilt = lifecycleFromExport(target.shop, envelope, {});
  const tx = [...target.shop.transactions.values()][0].id;
  assert.deepEqual(rebuilt.projection(tx), target.lifecycle.projection(tx));
});
