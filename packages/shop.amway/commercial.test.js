import assert from "node:assert/strict";
import { test } from "node:test";
import { AmwayDirectory } from "../amway.app/departments.js";
import { AmwayShop } from "./shop.js";
import { AmwaySubscriptions } from "./subscriptions.js";
import { AmwayReturns } from "./returns.js";
import { AmwayReconciliation } from "./reconciliation.js";
import { AmwayJournal } from "./journal.js";
import { AmwayChatActions } from "./chat.js";

function stockedShop() {
  const shop = new AmwayShop({ now: () => 1_000 });
  shop.catalog.registerItem(
    { itemNumber: "GLISTER-100", brand: "Glister", market: "DE", language: "de", unit: "piece", name: "Glister Multi-Action Zahncreme" },
    { version: "1" },
  );
  shop.catalog.publishPriceList({
    id: "retail-de", version: "2026-09", currency: "EUR", prices: { "GLISTER-100": 10000 },
  });
  shop.catalog.publishOffer({
    id: "offer-glister", item: "GLISTER-100@1", priceList: "retail-de@2026-09", channel: "facility",
  });
  return shop;
}

const orderParams = {
  channel: "facility", seller: "person:seller", customer: "person:customer",
  department: "nord", facility: "facility-a",
  lines: [{ offer: "offer-glister", quantity: 2 }],
  terms: { id: "terms-sale", version: "2026-09-01" },
  policy: { name: "recognition", version: "2026-09-01" },
};

function staffedDirectory() {
  const directory = new AmwayDirectory({ bootstrapIssuers: ["person:root"], now: () => 1_000 });
  directory.createDepartment({
    id: "nord", name: "Nord", manager: "person:manager",
    createdBy: "person:root", createdAt: 1_000,
  });
  directory.assignRole({ issuer: "person:root", subject: "person:admin", role: "admin", department: "nord", validFrom: 1_000 });
  directory.assignRole({ issuer: "person:manager", subject: "person:seller", role: "seller", department: "nord", validFrom: 1_000 });
  directory.assignRole({ issuer: "person:manager", subject: "person:customer", role: "customer", department: "nord", validFrom: 1_000 });
  return directory;
}

test("scheduled occurrences create no revenue; duplicates cannot duplicate orders", () => {
  const shop = stockedShop();
  const subscriptions = new AmwaySubscriptions({ shop, now: () => 1_000 });
  const sub = subscriptions.subscribe({
    customer: "person:customer", department: "nord",
    lines: [{ offer: "offer-glister", quantity: 2 }],
    schedule: { interval: "monthly" },
    authorization: { id: "auth-1", method: "sepa-mandate" },
    externalRef: "amway-sub-9",
    benefitPolicy: { version: "2026-09" },
  });
  assert.equal(sub.status, "active");
  const first = subscriptions.occur({ subscription: sub.id, occurrenceRef: "2026-10", order: orderParams });
  const replayed = subscriptions.occur({ subscription: sub.id, occurrenceRef: "2026-10", order: orderParams });
  assert.equal(replayed.transaction, first.transaction);
  assert.equal(replayed.replayed, true);
  assert.equal(shop.transactions.size, 1);
  subscriptions.cancel({ subscription: sub.id, atTime: 2_000 });
  assert.throws(() => subscriptions.occur({ subscription: sub.id, occurrenceRef: "2026-11", order: orderParams }), /not active/);
  // History survives cancellation.
  assert.equal(subscriptions.ordersFor(sub.id).length, 1);
});

test("returns route to the original seller and link evidence without rewriting the sale", () => {
  const shop = stockedShop();
  const tx = shop.admitTransaction({ ...orderParams, idempotencyKey: "order-ret-1" });
  const returns = new AmwayReturns({ shop, now: () => 1_000 });
  const kase = returns.open({ transaction: tx.id, returnRef: "ret-ext-1", reason: "damaged pack" });
  assert.equal(kase.responsibleSeller, "person:seller");
  // A request alone implies nothing: resolution before receipt fails.
  assert.throws(() => returns.resolve({
    kase: kase.id, decision: "refund",
    refundAmount: { amount: 10000, currency: "EUR" }, policy: { version: "returns-2026" },
  }), /not received/);
  returns.receive({
    kase: kase.id, tracking: "track-1", condition: "one unit damaged", componentsComplete: true,
  });
  assert.throws(() => returns.resolve({
    kase: kase.id, decision: "refund",
    refundAmount: { amount: 99999, currency: "EUR" }, policy: { version: "returns-2026" },
  }), /within the transaction total/);
  const { kase: resolved, correction } = returns.resolve({
    kase: kase.id, decision: "refund",
    refundAmount: { amount: 10000, currency: "EUR" }, policy: { version: "returns-2026" },
  });
  assert.equal(resolved.status, "resolved");
  assert.equal(correction.transaction, tx.id);
  assert.equal(returns.refundedTotal(tx.id), 10000);
  // The original transaction is untouched.
  assert.equal(shop.getTransaction(tx.id).total.amount, 20000);
});

test("reconciliation keeps points out of money and reports gaps", () => {
  const shop = stockedShop();
  const tx = shop.admitTransaction({ ...orderParams, idempotencyKey: "order-rec-1" });
  const reconciliation = new AmwayReconciliation({ shop, now: () => 1_000 });
  const statement = reconciliation.importStatement({
    beneficiary: "person:seller", period: { id: "2026-09" }, market: "DE",
    currency: "EUR", policyVersion: "core-plan-2026",
    lines: [
      { kind: "retail-margin", order: tx.id, amount: 4000, points: { pw: 100, unit: "PW" } },
      { kind: "team-total", amount: 9000, points: { gv: 500, unit: "GV" } },
      { kind: "retail-margin", order: "tx-missing", amount: 1000 },
    ],
    sourceRef: "stmt-ext-1",
  });
  const result = reconciliation.reconcile({ statement: statement.id });
  assert.equal(result.status, "partial");
  assert.equal(result.matched.length, 1);
  assert.equal(result.unexplained.length, 2);
  assert.equal(result.pointsAreNotMoney, true);
  // Payout is cash evidence, independent of the reported entitlement.
  const payout = reconciliation.matchPayout({ statement: statement.id, payoutRef: "payout-1", amount: 4000 });
  assert.equal(payout.amount, 4000);
  assert.equal(reconciliation.matchPayout({ statement: statement.id, payoutRef: "payout-1", amount: 4000 }).replayed, true);
});

test("journal stays incomplete until every producer reports", () => {
  const journal = new AmwayJournal({ expectedProducers: ["assignments", "shop"], now: () => 2_000 });
  assert.equal(journal.completeness().complete, false);
  assert.deepEqual(journal.completeness().missing, ["assignments", "shop"]);
  journal.ingest({
    producer: "assignments",
    events: [{ seq: 1, type: "assignment.issued", department: "nord", issuer: "person:root", atTime: 1_000 }],
  });
  const cut = journal.read({ department: "nord" });
  assert.equal(cut.occurrences.length, 1);
  assert.equal(cut.cut.complete, false);
  assert.throws(() => journal.ingest({ producer: "unknown", events: [] }), /does not expect/);
  journal.ingest({ producer: "shop", events: [] });
  assert.equal(journal.read({}).cut.complete, true);
  // Pagination advances without loss.
  journal.ingest({
    producer: "shop",
    events: [1, 2, 3].map(n => ({ seq: n, type: "order.accepted", department: "nord", atTime: 1_000 })),
  });
  const first = journal.read({ limit: 2 });
  assert.equal(first.occurrences.length, 2);
  assert.equal(first.nextCursor, 2);
  const rest = journal.read({ limit: 2, cursor: first.nextCursor });
  assert.equal(rest.occurrences.length, 2);
  assert.equal(rest.nextCursor, null);
});

test("chat starts from contracts and checks attachment audiences separately", () => {
  const directory = staffedDirectory();
  const chat = new AmwayChatActions({ directory, now: () => 1_500 });
  assert.throws(() => chat.startConversation({
    subject: "person:seller", contact: "person:customer", department: "nord", topic: "order-1",
  }), /no effective contract/);
  directory.grantContract({
    issuer: "person:manager", holder: "person:seller", contact: "person:customer",
    purpose: "order-support", department: "nord", validFrom: 1_000,
  });
  const conversation = chat.startConversation({
    subject: "person:seller", contact: "person:customer", department: "nord", topic: "order-1",
  });
  assert.equal(conversation.receipt, "pending-transport");
  // Topic membership alone cannot share an object: the audience check is separate.
  assert.throws(() => chat.shareObject({
    subject: "person:seller", contact: "person:customer", department: "nord",
    conversation: conversation.id, objectRef: "tx-1", audience: ["person:seller"],
  }), /recipient in the object audience/);
  const grant = chat.shareObject({
    subject: "person:seller", contact: "person:customer", department: "nord",
    conversation: conversation.id, objectRef: "tx-1",
    audience: ["person:seller", "person:customer"],
  });
  assert.equal(chat.grantsFor(conversation.id).length, 1);
  assert.deepEqual(grant.audience, ["person:seller", "person:customer"]);
});
