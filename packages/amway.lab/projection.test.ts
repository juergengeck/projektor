// packages/amway.lab/projection.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { audience, canPublish, projectDepartment, rolesOf } from "./projection.ts";
import type { AmwayDepartment, AmwayOffer, AmwayOrder, AmwayRoleAssignment } from "./recipes.ts";

const P = (ch: string): string => ch.repeat(64);
const ADMIN = P("a"), MANAGER = P("b"), SELLER = P("c"), CUSTOMER = P("d"), DEPT = P("e");
const department: AmwayDepartment = { $type$: "AmwayDepartment", department: "demo-de", name: "Demo DE", admin: ADMIN };
const assign = (subject: string, role: string, issuer: string): AmwayRoleAssignment =>
  ({ $type$: "AmwayRoleAssignment", department: DEPT, subject, role, issuer, validFrom: 1 });
const assignments = [assign(MANAGER, "manager", ADMIN), assign(SELLER, "seller", MANAGER), assign(CUSTOMER, "customer", MANAGER)];

test("roles derive from the department admin chain", () => {
  assert.deepEqual([...rolesOf({ department, assignments, subject: ADMIN, atTime: 5 })], ["admin"]);
  assert.deepEqual([...rolesOf({ department, assignments, subject: SELLER, atTime: 5 })], ["seller"]);
  assert.equal(rolesOf({ department, assignments, subject: SELLER, atTime: 0 }).size, 0);
  const forged = [...assignments, assign(CUSTOMER, "manager", SELLER)];
  assert.deepEqual([...rolesOf({ department, assignments: forged, subject: CUSTOMER, atTime: 5 })], ["customer"]);
});

test("publish authority per kind", () => {
  const ctx = { department, assignments, atTime: 5 };
  assert.equal(canPublish("offer", { ...ctx, author: MANAGER }), true);
  assert.equal(canPublish("offer", { ...ctx, author: SELLER }), false);
  assert.equal(canPublish("order", { ...ctx, author: SELLER }), true);
  assert.equal(canPublish("order", { ...ctx, author: CUSTOMER }), false);
  assert.equal(canPublish("order", { ...ctx, author: CUSTOMER, subject: CUSTOMER }), true);
  assert.equal(canPublish("order", { ...ctx, author: CUSTOMER, subject: P("f") }), false);
  assert.equal(canPublish("contact", { ...ctx, author: CUSTOMER, subject: CUSTOMER }), true);
  assert.equal(canPublish("contact", { ...ctx, author: SELLER, subject: CUSTOMER }), false);
});

test("orders reach staff and their customer only", () => {
  const row = { customer: CUSTOMER };
  assert.deepEqual(audience("order", { department, assignments, row }), [ADMIN, MANAGER, SELLER, CUSTOMER].sort());
  const other = P("f");
  assert.deepEqual(audience("order", { department, assignments: [...assignments, assign(other, "customer", MANAGER)], row }),
    [ADMIN, MANAGER, SELLER, CUSTOMER].sort());
});

test("placed orders pend until the seller admits them", () => {
  const placed: AmwayOrder = { $type$: "AmwayOrder", department: DEPT, idempotencyKey: "p1", customer: CUSTOMER, seller: CUSTOMER, offer: "o1", quantity: 2, lot: "demo-lot-a", facility: "demo-facility", admittedAt: 0 };
  const customerView = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [placed], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(customerView.orders, [], "placing alone buys nothing");
  assert.deepEqual(customerView.pendingOrders.map(entry => entry.idempotencyKey), ["p1"]);
  assert.equal(customerView.availability.available, 10, "unadmitted stock is untouched");
  const sellerView = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [placed], viewer: SELLER, atTime: 5 });
  assert.deepEqual(sellerView.pendingOrders.map(entry => entry.idempotencyKey), ["p1"], "the seller sees what to admit");
  const admitted: AmwayOrder = { ...placed, seller: SELLER, admittedAt: 9 };
  const after = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [admitted], viewer: CUSTOMER, atTime: 10 });
  assert.deepEqual(after.orders.map(entry => entry.idempotencyKey), ["p1"]);
  assert.deepEqual(after.pendingOrders, [], "admitting clears the pending order");
  assert.equal(after.availability.available, 8);
});

test("projection rejects unauthorized rows and scopes customer reads", () => {
  const order: AmwayOrder = { $type$: "AmwayOrder", department: DEPT, idempotencyKey: "k1", customer: CUSTOMER, seller: SELLER, offer: "o1", quantity: 3, lot: "demo-lot-a", facility: "demo-facility", admittedAt: 2 };
  const forgedOffer: AmwayOffer = { $type$: "AmwayOffer", department: DEPT, offerId: "bad", item: "x", priceList: "p", channel: "facility", unitAmount: 1, currency: "EUR", publishedBy: SELLER };
  const view = projectDepartment({ department, assignments, contacts: [], offers: [forgedOffer], orders: [order], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(view.offers, []);
  assert.deepEqual(view.rejected, [{ type: "AmwayOffer", id: "bad", reason: "publisher-not-authorized" }]);
  assert.equal(view.orders.length, 1);
  assert.equal(view.availability.available, 7);
  const stranger = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [{ ...order, customer: P("f") }], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(stranger.orders, []);
});
