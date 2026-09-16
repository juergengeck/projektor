import assert from "node:assert/strict";
import { test } from "node:test";
import { AmwayCatalog, createCatalogItem } from "./catalog.js";

function base(overrides = {}) {
  return {
    itemNumber: "NUTRILITE-DAILY", brand: "Nutrilite", market: "DE",
    language: "de", unit: "piece", name: "Daily Multivitamin Tabletten",
    ...overrides,
  };
}

test("catalog items require a display name and accept category plus PV/BV", () => {
  const item = createCatalogItem({ ...base(), category: "Ernährung", pv: 11, bv: 30 });
  assert.equal(item.name, "Daily Multivitamin Tabletten");
  assert.equal(item.category, "Ernährung");
  assert.equal(item.pv, 11);
  assert.equal(item.bv, 30);
  assert.throws(() => createCatalogItem(base({ name: undefined })), /display name/);
  assert.throws(() => createCatalogItem(base({ name: "" })), /display name/);
  assert.throws(() => createCatalogItem(base({ category: "" })), /category/);
  assert.throws(() => createCatalogItem(base({ pv: -1 })), /PV/);
  assert.throws(() => createCatalogItem(base({ bv: Number.NaN })), /BV/);
});

test("registered items keep presentation fields and survive offer pinning", () => {
  const catalog = new AmwayCatalog();
  const stored = catalog.registerItem(
    { ...base(), category: "Ernährung", pv: 11, bv: 30 },
    { version: "1" },
  );
  assert.equal(stored.name, "Daily Multivitamin Tabletten");
  catalog.publishPriceList({
    id: "retail-de", version: "2026-09", currency: "EUR", prices: { "NUTRILITE-DAILY": 2790 },
  });
  const offer = catalog.publishOffer({
    id: "offer-daily", item: "NUTRILITE-DAILY@1",
    priceList: "retail-de@2026-09", channel: "facility",
  });
  assert.equal(catalog.items.get(offer.item).name, "Daily Multivitamin Tabletten");
});
