import assert from "node:assert/strict";
import { test } from "node:test";
import { createMoney, addMoney, scaleMoney, createTransaction } from "./transactions.js";
import { AmwayCatalog } from "./catalog.js";
import { AmwayShop } from "./shop.js";

test("money is exact: no float drift, no mixed currencies", () => {
  const tenth = createMoney({ amount: 10, currency: "EUR" });
  const total = addMoney(addMoney(tenth, tenth), tenth);
  assert.equal(total.amount, 30);
  assert.throws(() => createMoney({ amount: 10.5, currency: "EUR" }), /minor units/);
  assert.throws(() => createMoney({ amount: 10, currency: "EURO" }), /ISO currency/);
  assert.throws(
    () => addMoney(tenth, createMoney({ amount: 5, currency: "USD" })),
    /mixed currencies/,
  );
  // The inventory 0.1 + 0.2 case in minor units stays exact.
  const small = createMoney({ amount: 10, currency: "EUR" });
  assert.equal(addMoney(small, createMoney({ amount: 20, currency: "EUR" })).amount, 30);
});

test("facility transaction pins channel, seller, terms, and policy", () => {
  const tx = createTransaction({
    id: "tx-1", channel: "facility", seller: "person:seller", customer: "person:customer",
    department: "nord", facility: "facility-a",
    lines: [{ item: "GLISTER-100@1", unitPrice: { amount: 10000, currency: "EUR" }, quantity: 2 }],
    terms: { id: "terms-sale", version: "2026-09-01" },
    currency: "EUR", policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: "order-external-1", createdAt: 1_000,
  });
  assert.equal(tx.total.amount, 20000);
  assert.equal(tx.status, "admitted");
});

test("direct orders reference no facility; facility orders require one", () => {
  const line = [{ item: "GLISTER-100@1", unitPrice: { amount: 10000, currency: "EUR" }, quantity: 1 }];
  const base = {
    id: "tx-x", seller: "person:seller", customer: "person:customer", department: "nord",
    lines: line, terms: { id: "t", version: "1" }, currency: "EUR",
    policy: { name: "recognition", version: "1" }, idempotencyKey: "k", createdAt: 1,
  };
  assert.throws(() => createTransaction({ ...base, channel: "direct", facility: "facility-a" }), /no facility/);
  assert.throws(() => createTransaction({ ...base, channel: "facility" }), /require the fulfilling facility/);
  const direct = createTransaction({ ...base, channel: "direct", facility: null });
  assert.equal(direct.facility, null);
});

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

test("admission pins catalog evidence and replays idempotently", () => {
  const shop = stockedShop();
  const params = {
    channel: "facility", seller: "person:seller", customer: "person:customer",
    department: "nord", facility: "facility-a",
    lines: [{ offer: "offer-glister", quantity: 2 }],
    terms: { id: "terms-sale", version: "2026-09-01" },
    policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: "order-external-7",
  };
  const first = shop.admitTransaction(params);
  assert.equal(first.lines[0].item, "GLISTER-100@1");
  assert.equal(first.total.amount, 20000);
  const replayed = shop.admitTransaction({ ...params, lines: [{ offer: "offer-glister", quantity: 99 }] });
  assert.equal(replayed.id, first.id);
  assert.equal(replayed.total.amount, 20000);
  assert.equal(shop.transactions.size, 1);
});

test("later catalog changes cannot rewrite admitted orders", () => {
  const shop = stockedShop();
  const tx = shop.admitTransaction({
    channel: "facility", seller: "person:seller", customer: "person:customer",
    department: "nord", facility: "facility-a",
    lines: [{ offer: "offer-glister", quantity: 1 }],
    terms: { id: "terms-sale", version: "2026-09-01" },
    policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: "order-external-8",
  });
  shop.catalog.publishPriceList({
    id: "retail-de", version: "2026-10", currency: "EUR", prices: { "GLISTER-100": 12000 },
  });
  shop.catalog.publishOffer({
    id: "offer-glister-new", item: "GLISTER-100@1", priceList: "retail-de@2026-10", channel: "facility",
  });
  assert.equal(shop.getTransaction(tx.id).total.amount, 10000);
});

test("offer channel must match the transaction channel", () => {
  const shop = stockedShop();
  shop.catalog.publishOffer({
    id: "offer-direct", item: "GLISTER-100@1", priceList: "retail-de@2026-09", channel: "direct",
  });
  assert.throws(() => shop.admitTransaction({
    channel: "facility", seller: "person:seller", customer: "person:customer",
    department: "nord", facility: "facility-a",
    lines: [{ offer: "offer-direct", quantity: 1 }],
    terms: { id: "terms-sale", version: "2026-09-01" },
    policy: { name: "recognition", version: "2026-09-01" },
    idempotencyKey: "order-external-9",
  }), /not valid for facility fulfilment/);
});

test("gross availability sums on-hand projection rows", () => {
  const shop = stockedShop();
  const projection = [
    { lot: "lot-a", location: "loc-1", quantity: 6 },
    { lot: "lot-a", location: "loc-2", quantity: 4 },
    { lot: "lot-b", location: "loc-1", quantity: 3 },
  ];
  assert.equal(shop.grossAvailability(projection, "lot-a"), 10);
  assert.equal(shop.grossAvailability(projection, "lot-missing"), 0);
});
