// packages/amway.lab/projection.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { audience, canPublish, projectDepartment, rolesOf } from "./projection.ts";
import type { AmwayContact, AmwayDepartment, AmwayOffer, AmwayOrder, AmwayRoleAssignment, AmwayStockReceipt } from "./recipes.ts";

const P = (ch: string): string => ch.repeat(64);
const ADMIN = P("a"), MANAGER = P("b"), SELLER = P("c"), CUSTOMER = P("d"), DEPT = P("e");
const department: AmwayDepartment = { $type$: "AmwayDepartment", department: "demo-de", name: "Demo DE", admin: ADMIN };
const assign = (subject: string, role: string, issuer: string): AmwayRoleAssignment =>
  ({ $type$: "AmwayRoleAssignment", department: DEPT, subject, role, issuer, validFrom: 1 });
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

test("publishing discloses offers to managers only, receipts to staff and sellers", () => {
  const offer: AmwayOffer = { $type$: "AmwayOffer", department: DEPT, offerId: "o1", item: "x", priceList: "p", channel: "facility", unitAmount: 1, currency: "EUR", publishedBy: MANAGER };
  assert.deepEqual(audience("offer", { department, assignments, row: offer }), [ADMIN, MANAGER].sort(),
    "appointment alone delivers no inventory");
  const receipt = { department: DEPT, receiptId: "r1" };
  assert.deepEqual(audience("stock", { department, assignments, row: receipt }), [ADMIN, MANAGER, SELLER].sort(),
    "sellers replicate receipts so admissions settle; customers never hold inventory rows");
});

test("placed orders pend until the seller admits them", () => {
  const placed: AmwayOrder = { $type$: "AmwayOrder", department: DEPT, idempotencyKey: "p1", customer: CUSTOMER, seller: CUSTOMER, offer: "o1", quantity: 2, lot: "demo-lot-a", facility: "demo-facility", currency: "EUR", unitAmount: 10000, admittedAt: 0 };
  const customerView = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [placed], stock: [], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(customerView.orders, [], "placing alone buys nothing");
  assert.deepEqual(customerView.pendingOrders.map(entry => entry.idempotencyKey), ["p1"]);
  assert.equal(customerView.availability, null, "customers never see stock");
  const managerEmpty = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [placed], stock: [], viewer: MANAGER, atTime: 5 });
  assert.equal(managerEmpty.availability?.available, 0, "unadmitted stock is untouched");
  const sellerView = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [placed], stock: [], viewer: SELLER, atTime: 5 });
  assert.deepEqual(sellerView.pendingOrders.map(entry => entry.idempotencyKey), ["p1"], "the seller sees what to admit");
  const admitted: AmwayOrder = { ...placed, seller: SELLER, admittedAt: 9 };
  const stocked: AmwayStockReceipt[] = [{ $type$: "AmwayStockReceipt", department: DEPT, receiptId: "r1", lot: "demo-lot-a", facility: "demo-facility", quantity: 2, receivedBy: ADMIN, receivedAt: 1 }];
  const after = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [admitted], stock: stocked, viewer: CUSTOMER, atTime: 10 });
  assert.deepEqual(after.orders.map(entry => entry.idempotencyKey), ["p1"]);
  assert.deepEqual(after.pendingOrders, [], "admitting clears the pending order");
  assert.equal(after.availability, null, "customers never see stock");
  const managerAfter = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [admitted], stock: stocked, viewer: MANAGER, atTime: 10 });
  assert.equal(managerAfter.availability?.available, 0, "a fitting admission settles against the receipts");
  // Nothing was ever stocked: the same admission settles nothing and is
  // rejected instead of driving availability to −2.
  const unstocked = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [admitted], stock: [], viewer: MANAGER, atTime: 10 });
  assert.deepEqual(unstocked.orders, [], "an admission without stock settles nothing");
  assert.deepEqual(unstocked.rejected, [{ type: "AmwayOrder", id: "p1", reason: "oversold" }]);
  assert.equal(unstocked.availability?.available, 0, "availability never goes negative");
});

test("admission accrues receivables and payables per role", () => {
  const placed: AmwayOrder = { $type$: "AmwayOrder", department: DEPT, idempotencyKey: "m1", customer: CUSTOMER, seller: CUSTOMER, offer: "o1", quantity: 2, lot: "demo-lot-a", facility: "demo-facility", currency: "EUR", unitAmount: 10000, admittedAt: 0 };
  const pending = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [placed], stock: [], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(pending.balances, [], "placing alone moves no money");
  const admitted: AmwayOrder = { ...placed, seller: SELLER, admittedAt: 9 };
  const stocked: AmwayStockReceipt[] = [{ $type$: "AmwayStockReceipt", department: DEPT, receiptId: "r1", lot: "demo-lot-a", facility: "demo-facility", quantity: 2, receivedBy: ADMIN, receivedAt: 1 }];
  const staff = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [admitted], stock: stocked, viewer: SELLER, atTime: 10 });
  assert.deepEqual(staff.balances, [
    { party: ADMIN, role: "org", receivable: 20000, payable: 0, currency: "EUR" },
    { party: SELLER, role: "seller", receivable: 20000, payable: 20000, currency: "EUR" },
    { party: CUSTOMER, role: "customer", receivable: 0, payable: 20000, currency: "EUR" },
  ]);
  const mine = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [admitted], stock: stocked, viewer: CUSTOMER, atTime: 10 });
  assert.deepEqual(mine.balances, [
    { party: CUSTOMER, role: "customer", receivable: 0, payable: 20000, currency: "EUR" },
  ], "customers see only their own row");
});

test("projection rejects unauthorized rows and scopes customer reads", () => {
  const order: AmwayOrder = { $type$: "AmwayOrder", department: DEPT, idempotencyKey: "k1", customer: CUSTOMER, seller: SELLER, offer: "o1", quantity: 3, lot: "demo-lot-a", facility: "demo-facility", currency: "EUR", unitAmount: 10000, admittedAt: 2 };
  const stock: AmwayStockReceipt[] = [{ $type$: "AmwayStockReceipt", department: DEPT, receiptId: "r1", lot: "demo-lot-a", facility: "demo-facility", quantity: 3, receivedBy: ADMIN, receivedAt: 1 }];
  const forgedOffer: AmwayOffer = { $type$: "AmwayOffer", department: DEPT, offerId: "bad", item: "x", priceList: "p", channel: "facility", unitAmount: 1, currency: "EUR", publishedBy: SELLER };
  const view = projectDepartment({ department, assignments, contacts: [], offers: [forgedOffer], orders: [order], stock, viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(view.offers, []);
  assert.deepEqual(view.rejected, [{ type: "AmwayOffer", id: "bad", reason: "publisher-not-authorized" }]);
  assert.equal(view.orders.length, 1);
  assert.equal(view.availability, null, "customers never see stock");
  const stranger = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [{ ...order, customer: P("f") }], stock: [], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(stranger.orders, []);
});

test("admin authority is never delegated down the chain", () => {
  const ctx = { department, atTime: 5 };
  const managerIssued = [...assignments, assign(CUSTOMER, "admin", MANAGER)];
  assert.deepEqual([...rolesOf({ ...ctx, assignments: managerIssued, subject: CUSTOMER })], ["customer"],
    "a manager-issued admin assignment confers nothing");
  const sellerIssued = [...assignments, assign(P("f"), "admin", SELLER)];
  assert.deepEqual([...rolesOf({ ...ctx, assignments: sellerIssued, subject: P("f") })], [],
    "a seller-issued admin assignment confers nothing");
  const rootIssued = [...assignments, assign(P("f"), "admin", ADMIN)];
  assert.deepEqual([...rolesOf({ ...ctx, assignments: rootIssued, subject: P("f") })], ["admin"],
    "only the root admin appoints admins");
  // The promoted customer from the defect report stays unable to publish:
  // their offer row is rejected everywhere it replicates.
  assert.equal(canPublish("offer", { ...ctx, assignments: managerIssued, author: CUSTOMER }), false);
  const forgedOffer: AmwayOffer = { $type$: "AmwayOffer", department: DEPT, offerId: "coup", item: "x", priceList: "p", channel: "facility", unitAmount: 1, currency: "EUR", publishedBy: CUSTOMER };
  const view = projectDepartment({ department, assignments: managerIssued, contacts: [], offers: [forgedOffer], orders: [], stock: [], viewer: MANAGER, atTime: 5 });
  assert.deepEqual(view.offers, []);
  assert.deepEqual(view.rejected, [{ type: "AmwayOffer", id: "coup", reason: "publisher-not-authorized" }]);
});

test("concurrent admissions settle deterministically, never negative", () => {
  const stock: AmwayStockReceipt[] = [{ $type$: "AmwayStockReceipt", department: DEPT, receiptId: "r1", lot: "demo-lot-a", facility: "demo-facility", quantity: 1, receivedBy: ADMIN, receivedAt: 1 }];
  const first: AmwayOrder = { $type$: "AmwayOrder", department: DEPT, idempotencyKey: "race-a", customer: CUSTOMER, seller: SELLER, offer: "o1", quantity: 1, lot: "demo-lot-a", facility: "demo-facility", currency: "EUR", unitAmount: 10000, admittedAt: 9 };
  const second: AmwayOrder = { ...first, idempotencyKey: "race-b", admittedAt: 10 };
  const view = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [second, first], stock, viewer: MANAGER, atTime: 11 });
  // Input order is irrelevant: the earliest admission wins on every worker.
  assert.deepEqual(view.orders.map(entry => entry.idempotencyKey), ["race-a"]);
  assert.deepEqual(view.rejected, [{ type: "AmwayOrder", id: "race-b", reason: "oversold" }]);
  assert.equal(view.availability?.available, 0, "one unit stocked, two admitted: availability 0, never −1");
  assert.deepEqual(view.balances, [
    { party: ADMIN, role: "org", receivable: 10000, payable: 0, currency: "EUR" },
    { party: SELLER, role: "seller", receivable: 10000, payable: 10000, currency: "EUR" },
    { party: CUSTOMER, role: "customer", receivable: 0, payable: 10000, currency: "EUR" },
  ], "only the settled purchase accrues money");
});

test("customer contacts stay with their seller", () => {
  const sellerContact: AmwayContact = { $type$: "AmwayContact", department: DEPT, person: SELLER, name: "Seller", role: "seller", publishedBy: SELLER, publishedAt: 2 };
  const customerContact: AmwayContact = { $type$: "AmwayContact", department: DEPT, person: CUSTOMER, name: "Customer", role: "customer", publishedBy: CUSTOMER, publishedAt: 2 };
  const contacts = [sellerContact, customerContact];
  const names = (viewer: string): string[] =>
    projectDepartment({ department, assignments, contacts, offers: [], orders: [], stock: [], viewer, atTime: 5 })
      .contacts.map(entry => entry.name);
  assert.deepEqual(names(SELLER), ["Seller", "Customer"], "the appointing seller keeps the address book");
  assert.deepEqual(names(CUSTOMER), ["Seller", "Customer"], "customers see team contacts and their own");
  assert.deepEqual(names(MANAGER), ["Seller"], "managers never see customer contacts");
  assert.deepEqual(names(ADMIN), ["Seller"], "even the org admin never sees customer contacts");
  assert.deepEqual(audience("contact", { department, assignments, row: customerContact }), [CUSTOMER, SELLER].sort(),
    "customer contacts replicate only to the customer and their seller");
  assert.deepEqual(audience("contact", { department, assignments, row: sellerContact }),
    [ADMIN, MANAGER, SELLER, CUSTOMER].sort(), "other contacts still reach the whole team");
});

test("customers project their own admissions without the receipts", () => {
  const admitted: AmwayOrder = { $type$: "AmwayOrder", department: DEPT, idempotencyKey: "mine", customer: CUSTOMER, seller: SELLER, offer: "o1", quantity: 1, lot: "demo-lot-a", facility: "demo-facility", currency: "EUR", unitAmount: 10000, admittedAt: 9 };
  // Customers replicate neither receipts nor competing admissions, so the
  // global settlement is unknowable there: no phantom oversell rejection.
  const view = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [admitted], stock: [], viewer: CUSTOMER, atTime: 10 });
  assert.deepEqual(view.orders.map(entry => entry.idempotencyKey), ["mine"]);
  assert.deepEqual(view.rejected, []);
  assert.equal(view.availability, null, "customers never see stock");
});
