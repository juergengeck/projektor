/**
 * Typed commercial transaction contracts for `shop.amway` (slices 1-2).
 *
 * A transaction pins purchase channel, seller of record, accepted terms,
 * price/currency, policy version, and exact goods/commercial references.
 * Money uses integer minor units with an explicit currency — never floats.
 * Every mutation carries an idempotency identity: replays return the
 * original transaction instead of creating a duplicate.
 */

export const PURCHASE_CHANNELS = ["direct", "facility"];

function fail(message) {
  throw new Error(message);
}

export function createMoney({ amount, currency } = {}) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    fail("Amway money must be a non-negative integer in minor units.");
  }
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    fail("Amway money requires a 3-letter ISO currency code.");
  }
  return { amount, currency };
}

export function addMoney(left, right) {
  if (left.currency !== right.currency) fail("Amway cannot total mixed currencies without an exchange-rate basis.");
  return { amount: left.amount + right.amount, currency: left.currency };
}

export function scaleMoney(unit, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) fail("Amway quantity must be a positive integer.");
  return { amount: unit.amount * quantity, currency: unit.currency };
}

export function createTransaction({
  id,
  channel,
  seller,
  customer,
  department,
  facility = null,
  lines,
  terms,
  currency,
  policy,
  idempotencyKey,
  createdAt,
} = {}) {
  if (typeof id !== "string" || id.length === 0) fail("Amway transaction requires a stable identity.");
  if (!PURCHASE_CHANNELS.includes(channel)) fail(`Amway unknown purchase channel ${channel}.`);
  if (typeof seller !== "string" || seller.length === 0) fail("Amway transaction requires a seller of record.");
  if (typeof customer !== "string" || customer.length === 0) fail("Amway transaction requires a customer.");
  if (typeof department !== "string" || department.length === 0) fail("Amway transaction requires a department scope.");
  if (channel === "direct" && facility !== null) {
    fail("Amway direct orders use Amway fulfilment and reference no facility.");
  }
  if (channel === "facility" && (typeof facility !== "string" || facility.length === 0)) {
    fail("Amway facility orders require the fulfilling facility.");
  }
  if (!Array.isArray(lines) || lines.length === 0) fail("Amway transaction requires at least one line.");
  for (const line of lines) {
    if (typeof line.item !== "string" || line.item.length === 0) fail("Amway line requires an exact catalog item version.");
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) fail("Amway line quantity must be a positive integer.");
    if (!line.unitPrice || line.unitPrice.currency !== currency) {
      fail("Amway line prices must match the transaction currency.");
    }
  }
  if (!terms || typeof terms.id !== "string" || typeof terms.version !== "string") {
    fail("Amway transaction requires exact accepted terms id and version.");
  }
  if (!policy || typeof policy.name !== "string" || typeof policy.version !== "string") {
    fail("Amway transaction requires a named recognition-policy version.");
  }
  if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
    fail("Amway transaction requires an idempotency identity.");
  }
  const total = lines
    .map(line => scaleMoney(line.unitPrice, line.quantity))
    .reduce((sum, value) => addMoney(sum, value));
  return {
    id, channel, seller, customer, department, facility,
    lines: lines.map(line => ({ ...line, unitPrice: { ...line.unitPrice } })),
    terms: { ...terms }, currency, policy: { ...policy },
    idempotencyKey, createdAt, total,
    status: "admitted",
  };
}
