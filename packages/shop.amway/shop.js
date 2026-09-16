/**
 * `shop.amway` module root (slices 1-2): initialization, idempotent
 * transaction admission against pinned catalog evidence, and gross
 * availability reads over an injected stock projection.
 *
 * Availability here is gross on-hand stock. Net available-to-sell (minus
 * reservations) arrives with slice 3, which owns reservation state.
 * Direct-channel transactions never touch facility stock: admission rejects
 * any facility reference on the direct channel, and availability reads are
 * only meaningful for facility fulfilment.
 */

import { createTransaction } from "./transactions.js";
import { AmwayCatalog } from "./catalog.js";

function fail(message) {
  throw new Error(message);
}

export class AmwayShop {
  constructor({ catalog = new AmwayCatalog(), now = () => Date.now() } = {}) {
    this.catalog = catalog;
    this.now = now;
    this.transactions = new Map();
    this.byIdempotencyKey = new Map();
    this.serial = 0;
  }

  /**
   * Admits one commercial transaction. Lines name offers; the shop pins the
   * exact item and price versions so later catalog changes cannot rewrite
   * this order. Replays under the same idempotency key return the original.
   */
  admitTransaction({
    channel, seller, customer, department, facility,
    lines, terms, policy, idempotencyKey,
  } = {}) {
    if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
      fail("Amway transaction requires an idempotency identity.");
    }
    const replayed = this.byIdempotencyKey.get(idempotencyKey);
    if (replayed) return replayed;
    if (!Array.isArray(lines) || lines.length === 0) fail("Amway transaction requires at least one line.");
    const pinned = lines.map(({ offer, quantity }) => {
      const resolved = this.catalog.getOffer(offer);
      if (resolved.channel !== channel) {
        fail(`Amway offer ${offer} is not valid for ${channel} fulfilment.`);
      }
      return { item: resolved.item, priceList: resolved.priceList, unitPrice: resolved.unitPrice, quantity };
    });
    const currency = pinned[0].unitPrice.currency;
    this.serial += 1;
    const transaction = createTransaction({
      id: `tx-${this.serial}`,
      channel, seller, customer, department, facility: facility ?? null,
      lines: pinned, terms, currency, policy, idempotencyKey,
      createdAt: this.now(),
    });
    this.transactions.set(transaction.id, transaction);
    this.byIdempotencyKey.set(idempotencyKey, transaction);
    return transaction;
  }

  getTransaction(id) {
    const transaction = this.transactions.get(id);
    if (!transaction) fail(`Amway unknown transaction ${id}.`);
    return transaction;
  }

  /**
   * Gross on-hand quantity for a lot across the given stock projection rows
   * (`{lot, location, quantity}` as produced by the inventory snapshot).
   * Takes no authority decision; callers scope rows to the facility first.
   */
  grossAvailability(stockProjection, lot) {
    if (!Array.isArray(stockProjection)) fail("Amway availability requires a stock projection.");
    return stockProjection
      .filter(row => row.lot === lot)
      .reduce((sum, row) => sum + row.quantity, 0);
  }
}
