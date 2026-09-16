import assert from "node:assert/strict";
import { test } from "node:test";
import { AmwayDirectory, AMWAY_ROLES, departmentScope } from "./departments.js";

const root = "person:root";
const admin = "person:admin";
const manager = "person:manager";
const seller = "person:seller";
const customer = "person:customer";
const outsider = "person:outsider";

function setup() {
  const directory = new AmwayDirectory({ bootstrapIssuers: [root], now: () => 1_000 });
  directory.createDepartment({ id: "nord", name: "Nord", manager, createdBy: root, createdAt: 1_000 });
  return directory;
}

function staffed() {
  const directory = setup();
  directory.assignRole({ issuer: root, subject: admin, role: "admin", department: "nord", validFrom: 1_000 });
  directory.assignRole({ issuer: manager, subject: seller, role: "seller", department: "nord", validFrom: 1_000 });
  directory.assignRole({ issuer: manager, subject: customer, role: "customer", department: "nord", validFrom: 1_000 });
  return directory;
}

test("department scope binds the department into the identity", () => {
  assert.equal(departmentScope("nord"), "amway.department:nord");
  assert.throws(() => departmentScope(""), /department id is required/);
});

test("every department has a manager enrolled by the country organisation manager", () => {
  const directory = new AmwayDirectory({ bootstrapIssuers: [root], now: () => 1_000 });
  assert.throws(
    () => directory.createDepartment({ id: "nord", name: "Nord", createdBy: root, createdAt: 1_000 }),
    /manager/,
  );
  const department = directory.createDepartment({
    id: "nord", name: "Nord", manager, createdBy: root, createdAt: 1_000,
  });
  assert.equal(department.manager, manager);
  assert.ok(directory.effectiveRoles({ subject: manager, department: "nord", atTime: 1_500 }).has("manager"));
  const enrollment = [...directory.assignments.values()].find(entry => entry.subject === manager);
  assert.equal(enrollment.issuer, root);
  assert.deepEqual(enrollment.issuerRoles, ["organization-manager"]);
});

test("succession transfers the manager and revokes the predecessor", () => {
  const directory = staffed();
  const next = "person:manager-2";
  assert.throws(
    () => directory.setDepartmentManager({ issuer: seller, department: "nord", manager: next, atTime: 2_000 }),
    /may not transfer/,
  );
  const transferred = directory.setDepartmentManager({
    issuer: admin, department: "nord", manager: next, atTime: 2_000,
  });
  assert.equal(transferred.manager, next);
  assert.ok(!directory.effectiveRoles({ subject: manager, department: "nord", atTime: 2_000 }).has("manager"));
  assert.ok(directory.effectiveRoles({ subject: next, department: "nord", atTime: 2_000 }).has("manager"));
  assert.ok(directory.events.some(event => event.type === "department.manager-transferred"));
});

test("only bootstrap issuers create departments; only admins assign roles", () => {
  const directory = setup();
  assert.throws(
    () => directory.createDepartment({ id: "sued", name: "Süd", manager, createdBy: outsider }),
    /country organisation manager/,
  );
  assert.throws(
    () => directory.assignRole({ issuer: seller, subject: outsider, role: "seller", department: "nord", validFrom: 1_000 }),
    /may not assign role seller/,
  );
  assert.throws(
    () => directory.assignRole({ issuer: root, subject: outsider, role: "owner", department: "nord", validFrom: 1_000 }),
    /unknown role owner/,
  );
  assert.deepEqual([...AMWAY_ROLES].sort(), ["admin", "customer", "manager", "seller"]);
});

test("issuance follows Flexibel-style edges: managers bring sellers, nothing else issues", () => {
  const directory = staffed();
  directory.assignRole({ issuer: manager, subject: outsider, role: "seller", department: "nord", validFrom: 1_000 });
  assert.ok(directory.effectiveRoles({ subject: outsider, department: "nord", atTime: 1_500 }).has("seller"));
  assert.throws(
    () => directory.assignRole({ issuer: manager, subject: "person:other", role: "manager", department: "nord", validFrom: 1_000 }),
    /may not assign role manager/,
  );
  assert.throws(
    () => directory.assignRole({ issuer: manager, subject: "person:other", role: "admin", department: "nord", validFrom: 1_000 }),
    /may not assign role admin/,
  );
  assert.throws(
    () => directory.assignRole({ issuer: customer, subject: "person:other", role: "customer", department: "nord", validFrom: 1_000 }),
    /may not assign role customer/,
  );
});

test("invalid windows and unknown departments fail fast", () => {
  const directory = setup();
  assert.throws(
    () => directory.assignRole({ issuer: root, subject: seller, role: "seller", department: "nord", validFrom: 2_000, validUntil: 2_000 }),
    /validUntil must be after validFrom/,
  );
  assert.throws(
    () => directory.assignRole({ issuer: root, subject: seller, role: "seller", department: "sued", validFrom: 1_000 }),
    /unknown department sued/,
  );
});

test("revocation ends future authority but preserves history", () => {
  const directory = staffed();
  const assignment = [...directory.assignments.values()].find(entry => entry.subject === seller);
  directory.revokeRole({ issuer: admin, assignment: assignment.id, reason: "left the team", atTime: 2_000 });
  assert.ok(!directory.effectiveRoles({ subject: seller, department: "nord", atTime: 2_000 }).has("seller"));
  assert.ok(directory.effectiveRoles({ subject: seller, department: "nord", atTime: 1_500 }).has("seller"));
  assert.throws(
    () => directory.authorize({ subject: seller, action: "goods.sell", department: "nord", atTime: 2_000 }),
    /may not sell/,
  );
  assert.ok(directory.events.some(event => event.type === "assignment.revoked" && event.assignment === assignment.id));
  assert.throws(
    () => directory.revokeRole({ issuer: admin, assignment: assignment.id, reason: "again", atTime: 3_000 }),
    /already revoked/,
  );
});

test("expired assignments deny at action time", () => {
  const directory = setup();
  directory.assignRole({
    issuer: manager, subject: seller, role: "seller", department: "nord",
    validFrom: 1_000, validUntil: 2_000,
  });
  assert.throws(
    () => directory.authorize({ subject: seller, action: "goods.sell", department: "nord", atTime: 2_000 }),
    /may not sell/,
  );
});

test("customer directory shows only their shared relationships", () => {
  const directory = staffed();
  directory.grantContract({
    issuer: manager, holder: customer, contact: seller,
    purpose: "order-support", department: "nord", validFrom: 1_000,
  });
  directory.grantContract({
    issuer: manager, holder: seller, contact: manager,
    purpose: "shift-coordination", department: "nord", validFrom: 1_000,
  });
  const customerView = directory.directoryFor({ viewer: customer, department: "nord", atTime: 1_500 });
  assert.equal(customerView.length, 1);
  assert.equal(customerView[0].person, seller);
  const adminView = directory.directoryFor({ viewer: admin, department: "nord", atTime: 1_500 });
  assert.equal(adminView.length, 2);
  const outsiderView = directory.directoryFor({ viewer: outsider, department: "nord", atTime: 1_500 });
  assert.equal(outsiderView.length, 0);
});

test("two departments under one owner keep separate phonebooks", () => {
  const directory = staffed();
  directory.createDepartment({ id: "sued", name: "Süd", manager, createdBy: root, createdAt: 1_000 });
  directory.assignRole({ issuer: root, subject: admin, role: "admin", department: "sued", validFrom: 1_000 });
  directory.assignRole({ issuer: manager, subject: customer, role: "customer", department: "sued", validFrom: 1_000 });
  directory.grantContract({
    issuer: root, holder: customer, contact: seller,
    purpose: "order-support", department: "nord", validFrom: 1_000,
  });
  assert.equal(directory.directoryFor({ viewer: customer, department: "nord", atTime: 1_500 }).length, 1);
  assert.equal(directory.directoryFor({ viewer: customer, department: "sued", atTime: 1_500 }).length, 0);
});

test("chat requires an effective contract; unpublishing is not revocation", () => {
  const directory = staffed();
  assert.throws(
    () => directory.authorize({ subject: seller, action: "chat.send", department: "nord", contact: customer, atTime: 1_500 }),
    /no effective contract/,
  );
  const contract = directory.grantContract({
    issuer: manager, holder: seller, contact: customer,
    purpose: "order-support", department: "nord", validFrom: 1_000,
  });
  assert.equal(
    directory.authorize({ subject: customer, action: "chat.send", department: "nord", contact: seller, atTime: 1_500 }),
    true,
  );
  directory.unpublishEntry({
    issuer: manager, department: "nord", person: customer, sharedWith: seller, atTime: 2_000,
  });
  // Directory hides the entry, but the existing pairing contract still authorizes chat.
  assert.equal(directory.directoryFor({ viewer: seller, department: "nord", atTime: 2_000 }).length, 0);
  assert.equal(
    directory.authorize({ subject: seller, action: "chat.send", department: "nord", contact: customer, atTime: 2_000 }),
    true,
  );
  directory.revokeContract({ issuer: manager, contract: contract.id, reason: "case closed", atTime: 3_000 });
  assert.throws(
    () => directory.authorize({ subject: seller, action: "chat.send", department: "nord", contact: customer, atTime: 3_000 }),
    /no effective contract/,
  );
});

test("facility operation respects facility-scoped grants", () => {
  const directory = staffed();
  directory.assignRole({
    issuer: admin, subject: manager, role: "manager", department: "nord",
    facility: "facility-a", validFrom: 1_000,
  });
  assert.equal(
    directory.authorize({ subject: manager, action: "facility.operate", department: "nord", facility: "facility-a", atTime: 1_500 }),
    true,
  );
  assert.throws(
    () => directory.authorize({ subject: seller, action: "facility.operate", department: "nord", atTime: 1_500 }),
    /may not operate facilities/,
  );
});
