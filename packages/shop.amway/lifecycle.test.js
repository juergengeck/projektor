import assert from "node:assert/strict";
import { test } from "node:test";
import { AmwayShop } from "./shop.js";
import { AmwayLifecycle } from "./lifecycle.js";

function fullStack() {
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
  shop.catalog.publishOffer({
    id: "offer-direct", item: "GLISTER-100@1", priceList: "retail-de@2026-09", channel: "direct",
  });
  const lifecycle = new AmwayLifecycle({ shop, now: () => 1_000 });
  const projection = [{ lot: "lot-a", location: "facility-a", quantity: 10 }];
  return { shop, lifecycle, projection };
}

function admitFacility(shop, key, quantity = 2) {
  return shop.admitTransaction({
    channel: "facility", seller: "person:seller", customer: "person:customer",
    department: "nord", facility: "facility-a",
    lines: [{ offer: "offer-glister", quantity }],
    terms: { id: "terms-sale", version: "2026-09-01" },
    policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: key,
  });
}

test("two sellers cannot reserve the same last unit", () => {
  const { lifecycle, projection } = fullStack();
  const first = admitFacility(lifecycle.shop, "order-1", 10);
  const second = admitFacility(lifecycle.shop, "order-2", 1);
  const reserved = lifecycle.reserve({
    expectedVersion: 0, transactionId: first.id, lot: "lot-a",
    quantity: 10, facility: "facility-a", stockProjection: projection,
  });
  assert.equal(lifecycle.netAvailability(projection, "lot-a"), 0);
  // Same stale version and no available stock: the second seller fails.
  assert.throws(() => lifecycle.reserve({
    expectedVersion: 0, transactionId: second.id, lot: "lot-a",
    quantity: 1, facility: "facility-a", stockProjection: projection,
  }), /changed|insufficient/);
  assert.equal(lifecycle.version, 1);
  assert.equal(reserved.status, "held");
});

test("release restores availability; stale versions fail", () => {
  const { lifecycle, projection } = fullStack();
  const tx = admitFacility(lifecycle.shop, "order-3", 4);
  const reservation = lifecycle.reserve({
    expectedVersion: 0, transactionId: tx.id, lot: "lot-a",
    quantity: 4, facility: "facility-a", stockProjection: projection,
  });
  assert.equal(lifecycle.netAvailability(projection, "lot-a"), 6);
  assert.throws(() => lifecycle.release({ expectedVersion: 0, reservation: reservation.id }), /changed/);
  lifecycle.release({ expectedVersion: 1, reservation: reservation.id });
  assert.equal(lifecycle.netAvailability(projection, "lot-a"), 10);
});

test("facility acceptance requires a reservation; direct orders do not", () => {
  const { shop, lifecycle } = fullStack();
  const tx = admitFacility(shop, "order-4", 1);
  assert.throws(() => lifecycle.accept({ expectedVersion: 0, transactionId: tx.id }), /no held reservation/);
  const direct = shop.admitTransaction({
    channel: "direct", seller: "person:seller", customer: "person:customer", department: "nord",
    lines: [{ offer: "offer-direct", quantity: 1 }],
    terms: { id: "terms-sale", version: "2026-09-01" },
    policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: "order-direct-1",
  });
  assert.equal(lifecycle.accept({ expectedVersion: 0, transactionId: direct.id }).status, "accepted");
  assert.throws(() => lifecycle.reserve({
    expectedVersion: 1, transactionId: direct.id, lot: "lot-a",
    quantity: 1, facility: "facility-a", stockProjection: [],
  }), /no facility stock/);
});

test("the 10-unit fixture recognizes 200 EUR once and keeps cash at zero", () => {
  const { lifecycle, projection } = fullStack();
  const tx = admitFacility(lifecycle.shop, "order-5", 2);
  lifecycle.reserve({
    expectedVersion: 0, transactionId: tx.id, lot: "lot-a",
    quantity: 2, facility: "facility-a", stockProjection: projection,
  });
  lifecycle.accept({ expectedVersion: 1, transactionId: tx.id });
  // Fulfilment without exact evidence refs fails; nothing is recorded.
  assert.throws(() => lifecycle.fulfil({
    expectedVersion: 2, transactionId: tx.id, movementRef: "move-1", titleRef: "", invoiceRef: "inv-1",
  }), /titleRef/);
  lifecycle.fulfil({
    expectedVersion: 2, transactionId: tx.id,
    movementRef: "move-1", titleRef: "title-1", invoiceRef: "inv-1",
  });
  const recognized = lifecycle.recognize({ expectedVersion: 3, transactionId: tx.id, amount: 20000 });
  assert.equal(recognized.recognized, 20000);
  const view = lifecycle.projection(tx.id);
  assert.equal(view.recognized, 20000);
  assert.equal(view.cash, 0);
  assert.equal(view.receivable, 20000);
  // Recognition beyond the total is rejected.
  assert.throws(() => lifecycle.recognize({ expectedVersion: 4, transactionId: tx.id, amount: 1 }), /more than/);
});

test("settlement pays recognized revenue; replays never double count", () => {
  const { lifecycle, projection } = fullStack();
  const tx = admitFacility(lifecycle.shop, "order-6", 2);
  lifecycle.reserve({
    expectedVersion: 0, transactionId: tx.id, lot: "lot-a",
    quantity: 2, facility: "facility-a", stockProjection: projection,
  });
  lifecycle.accept({ expectedVersion: 1, transactionId: tx.id });
  lifecycle.fulfil({
    expectedVersion: 2, transactionId: tx.id,
    movementRef: "move-1", titleRef: "title-1", invoiceRef: "inv-1",
  });
  // Cash cannot precede recognition.
  assert.throws(() => lifecycle.settle({
    expectedVersion: 3, transactionId: tx.id, paymentRef: "pay-ext-1", amount: 20000,
  }), /more cash than recognized/);
  lifecycle.recognize({ expectedVersion: 3, transactionId: tx.id, amount: 20000 });
  const paid = lifecycle.settle({
    expectedVersion: 4, transactionId: tx.id, paymentRef: "pay-ext-1", amount: 20000,
  });
  assert.equal(paid.cashTotal, 20000);
  const replayed = lifecycle.settle({
    expectedVersion: 5, transactionId: tx.id, paymentRef: "pay-ext-1", amount: 20000,
  });
  assert.equal(replayed.replayed, true);
  assert.equal(lifecycle.projection(tx.id).cash, 20000);
  assert.deepEqual(lifecycle.pendingWork(), []);
});

test("pending work names the missing counterpart, never a completed sale", () => {
  const { lifecycle } = fullStack();
  const tx = admitFacility(lifecycle.shop, "order-7", 1);
  assert.deepEqual(lifecycle.pendingWork(), [{ transaction: tx.id, missing: "acceptance" }]);
});

test("restart recovery rebuilds identical lifecycle state from events", () => {
  const { shop, lifecycle, projection } = fullStack();
  const tx = admitFacility(shop, "order-8", 2);
  lifecycle.reserve({
    expectedVersion: 0, transactionId: tx.id, lot: "lot-a",
    quantity: 2, facility: "facility-a", stockProjection: projection,
  });
  lifecycle.accept({ expectedVersion: 1, transactionId: tx.id });
  lifecycle.fulfil({
    expectedVersion: 2, transactionId: tx.id,
    movementRef: "move-1", titleRef: "title-1", invoiceRef: "inv-1",
  });
  lifecycle.recognize({ expectedVersion: 3, transactionId: tx.id, amount: 20000 });
  lifecycle.settle({
    expectedVersion: 4, transactionId: tx.id, paymentRef: "pay-ext-2", amount: 20000,
  });
  const recovered = lifecycle.rehydrate(lifecycle.events);
  assert.deepEqual(recovered.projection(tx.id), lifecycle.projection(tx.id));
  assert.deepEqual(recovered.pendingWork(), []);
  assert.equal(recovered.netAvailability(projection, "lot-a"), 10);
  assert.throws(() => recovered.rehydrate([{ type: "unknown.event" }]), /unknown event/);
});
