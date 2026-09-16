/**
 * Versioned catalog, offers, and prices for `shop.amway` (slice 2).
 *
 * Catalog items preserve source identity (item number, brand, market,
 * language, variant, pack size, unit) plus presentation (display name,
 * category) and the Amway point/business values (PV/BV). Price lists and set compositions are
 * versioned and immutable: a later catalog change can never rewrite an
 * admitted order, which pins exact item and price versions. Categories and
 * brands are product facets, never authority scopes.
 */

function fail(message) {
  throw new Error(message);
}

export function createCatalogItem({
  itemNumber, brand, market, language, variant = null,
  packSize = 1, unit, setComponents = null,
  name, category = null, pv = null, bv = null,
} = {}) {
  if (typeof itemNumber !== "string" || itemNumber.length === 0) fail("Amway catalog item requires a source item number.");
  if (typeof brand !== "string" || brand.length === 0) fail("Amway catalog item requires a brand.");
  if (typeof market !== "string" || market.length === 0) fail("Amway catalog item requires a market.");
  if (typeof language !== "string" || language.length === 0) fail("Amway catalog item requires a language.");
  if (typeof name !== "string" || name.length === 0) fail("Amway catalog item requires a display name.");
  if (category !== null && (typeof category !== "string" || category.length === 0)) {
    fail("Amway catalog category must be a non-empty string when present.");
  }
  for (const [label, value] of [["PV", pv], ["BV", bv]]) {
    if (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)) {
      fail(`Amway catalog ${label} must be a non-negative number when present.`);
    }
  }
  if (!Number.isSafeInteger(packSize) || packSize <= 0) fail("Amway pack size must be a positive integer.");
  if (typeof unit !== "string" || unit.length === 0) fail("Amway catalog item requires a unit.");
  if (setComponents !== null) {
    if (!Array.isArray(setComponents) || setComponents.length === 0) {
      fail("Amway set components must be a non-empty list when present.");
    }
    for (const component of setComponents) {
      if (typeof component.item !== "string" || !Number.isSafeInteger(component.quantity) || component.quantity <= 0) {
        fail("Amway set components require exact item versions and positive quantities.");
      }
    }
  }
  return { itemNumber, brand, market, language, variant, packSize, unit, setComponents, name, category, pv, bv };
}

export function createPriceList({ id, version, currency, prices } = {}) {
  if (typeof id !== "string" || id.length === 0) fail("Amway price list requires an id.");
  if (typeof version !== "string" || version.length === 0) fail("Amway price list requires a version.");
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    fail("Amway price list requires a 3-letter ISO currency code.");
  }
  if (!prices || typeof prices !== "object") fail("Amway price list requires prices.");
  const entries = {};
  for (const [item, price] of Object.entries(prices)) {
    if (!Number.isSafeInteger(price) || price < 0) fail(`Amway price for ${item} must be non-negative integer minor units.`);
    entries[item] = { amount: price, currency };
  }
  return Object.freeze({ id, version, currency, prices: Object.freeze(entries) });
}

export class AmwayCatalog {
  constructor() {
    this.items = new Map();
    this.priceLists = new Map();
    this.offers = new Map();
  }

  registerItem(item, { version } = {}) {
    const record = createCatalogItem(item);
    if (typeof version !== "string" || version.length === 0) fail("Amway catalog item requires a version.");
    const key = `${record.itemNumber}@${version}`;
    if (this.items.has(key)) fail(`Amway catalog item ${key} is already registered.`);
    const stored = Object.freeze({ ...record, version, key });
    this.items.set(key, stored);
    return stored;
  }

  publishPriceList(list) {
    const record = createPriceList(list);
    const key = `${record.id}@${record.version}`;
    if (this.priceLists.has(key)) fail(`Amway price list ${key} is already published.`);
    this.priceLists.set(key, record);
    return record;
  }

  /**
   * An offer pins an exact item version, price-list version, and fulfilment
   * channel. Public availability is not proof of local stock.
   */
  publishOffer({ id, item, priceList, channel, eligible = null } = {}) {
    if (typeof id !== "string" || id.length === 0) fail("Amway offer requires an id.");
    if (!this.items.has(item)) fail(`Amway offer references unknown catalog item ${item}.`);
    if (!this.priceLists.has(priceList)) fail(`Amway offer references unknown price list ${priceList}.`);
    const list = this.priceLists.get(priceList);
    const stored = this.items.get(item);
    const unitPrice = list.prices[stored.itemNumber];
    if (!unitPrice) fail(`Amway price list ${priceList} has no price for ${stored.itemNumber}.`);
    if (this.offers.has(id)) fail(`Amway offer ${id} is already published.`);
    const offer = Object.freeze({ id, item, priceList, channel, unitPrice, eligible });
    this.offers.set(id, offer);
    return offer;
  }

  getOffer(id) {
    const offer = this.offers.get(id);
    if (!offer) fail(`Amway unknown offer ${id}.`);
    return offer;
  }
}
