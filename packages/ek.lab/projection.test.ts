// packages/ek.lab/projection.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { audience, canPublish, projectDepartment, rolesOf } from "./projection.ts";
import type { EkDepartment, EkOffer, EkOrder, EkRoleAssignment } from "./recipes.ts";

const P = (ch: string): string => ch.repeat(64);
const ADMIN = P("a"), MANAGER = P("b"), SELLER = P("c"), CUSTOMER = P("d"), DEPT = P("e");
const department: EkDepartment = { $type$: "EkDepartment", department: "ek-de", name: "Demo DE", admin: ADMIN };
const assign = (subject: string, role: string, issuer: string): EkRoleAssignment =>
  ({ $type$: "EkRoleAssignment", department: DEPT, subject, role, issuer, validFrom: 1 });
const assignments = [assign(MANAGER, "manager", ADMIN), assign(SELLER, "seller", MANAGER), assign(CUSTOMER, "customer", SELLER)];

test("roles derive from the department admin chain", () => {
  assert.deepEqual([...rolesOf({ department, assignments, subject: ADMIN, atTime: 5 })], ["admin"]);
  assert.deepEqual([...rolesOf({ department, assignments, subject: SELLER, atTime: 5 })], ["seller"]);
  assert.equal(rolesOf({ department, assignments, subject: SELLER, atTime: 0 }).size, 0);
  const forged = [...assignments, assign(CUSTOMER, "manager", SELLER)];
  assert.deepEqual([...rolesOf({ department, assignments: forged, subject: CUSTOMER, atTime: 5 })], ["customer"]);
});

test("appointment chain runs admin to manager to seller to customer", () => {
  const ctx = { department, atTime: 5 };
  assert.deepEqual([...rolesOf({ ...ctx, assignments, subject: SELLER })], ["seller"]);
  const sellerIssued = [...assignments, assign(P("f"), "customer", SELLER)];
  assert.deepEqual([...rolesOf({ ...ctx, assignments: sellerIssued, subject: P("f") })], ["customer"]);
  const managerIssued = [...assignments, assign(P("f"), "customer", MANAGER)];
  assert.deepEqual([...rolesOf({ ...ctx, assignments: managerIssued, subject: P("f") })], [], "managers cannot appoint customers");
  const sellerAppointsSeller = [...assignments, assign(P("f"), "seller", SELLER)];
  assert.deepEqual([...rolesOf({ ...ctx, assignments: sellerAppointsSeller, subject: P("f") })], [], "sellers cannot appoint sellers");
  assert.equal(canPublish("assignment", { department, assignments, author: SELLER, atTime: 5 }), true);
  assert.equal(canPublish("assignment", { department, assignments, author: CUSTOMER, atTime: 5 }), false);
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
  assert.deepEqual(audience("order", { department, assignments: [...assignments, assign(other, "customer", SELLER)], row }),
    [ADMIN, MANAGER, SELLER, CUSTOMER].sort());
  // Placed orders stay between the parties: managers see the admitted
  // purchase, never the pending intent.
  assert.deepEqual(audience("order", { department, assignments, row: { ...row, admittedAt: 0 } }),
    [ADMIN, SELLER, CUSTOMER].sort());
});

test("inventory stops at sellers until the seller shares it down", () => {
  const offer: EkOffer = { $type$: "EkOffer", department: DEPT, offerId: "o1", item: "x", priceList: "p", channel: "facility", unitAmount: 1, currency: "EUR", publishedBy: MANAGER };
  assert.deepEqual(audience("offer", { department, assignments, row: offer }), [ADMIN, MANAGER, SELLER].sort());
});

test("placed orders pend until the seller admits them", () => {
  const placed: EkOrder = { $type$: "EkOrder", department: DEPT, idempotencyKey: "p1", customer: CUSTOMER, seller: CUSTOMER, offer: "o1", quantity: 2, lot: "ek-lot-a", facility: "ek-facility", admittedAt: 0 };
  const customerView = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [placed], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(customerView.orders, [], "placing alone buys nothing");
  assert.deepEqual(customerView.pendingOrders.map(entry => entry.idempotencyKey), ["p1"]);
  assert.equal(customerView.availability.available, 10, "unadmitted stock is untouched");
  const sellerView = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [placed], viewer: SELLER, atTime: 5 });
  assert.deepEqual(sellerView.pendingOrders.map(entry => entry.idempotencyKey), ["p1"], "the seller sees what to admit");
  const admitted: EkOrder = { ...placed, seller: SELLER, admittedAt: 9 };
  const after = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [admitted], viewer: CUSTOMER, atTime: 10 });
  assert.deepEqual(after.orders.map(entry => entry.idempotencyKey), ["p1"]);
  assert.deepEqual(after.pendingOrders, [], "admitting clears the pending order");
  assert.equal(after.availability.available, 8);
});

test("projection rejects unauthorized rows and scopes customer reads", () => {
  const order: EkOrder = { $type$: "EkOrder", department: DEPT, idempotencyKey: "k1", customer: CUSTOMER, seller: SELLER, offer: "o1", quantity: 3, lot: "ek-lot-a", facility: "ek-facility", admittedAt: 2 };
  const forgedOffer: EkOffer = { $type$: "EkOffer", department: DEPT, offerId: "bad", item: "x", priceList: "p", channel: "facility", unitAmount: 1, currency: "EUR", publishedBy: SELLER };
  const view = projectDepartment({ department, assignments, contacts: [], offers: [forgedOffer], orders: [order], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(view.offers, []);
  assert.deepEqual(view.rejected, [{ type: "EkOffer", id: "bad", reason: "publisher-not-authorized" }]);
  assert.equal(view.orders.length, 1);
  assert.equal(view.availability.available, 7);
  const stranger = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [{ ...order, customer: P("f") }], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(stranger.orders, []);
});
