/**
 * Recurring orders for `shop.amway` (slice 5).
 *
 * A subscription retains schedule, customer authorization, eligible
 * products, policy version, and the external subscription reference. Each
 * executed occurrence becomes a distinct order admitted through the shop
 * under its own idempotency key, so duplicate occurrence imports can never
 * create duplicate orders. A future occurrence is forecast demand — never
 * revenue or stock movement. Cancellation stops future occurrences without
 * deleting completed orders. Benefits stay versioned source policy; no
 * advertised discount is hardcoded.
 */

function fail(message) {
  throw new Error(message);
}

export class AmwaySubscriptions {
  constructor({ shop, now = () => Date.now() } = {}) {
    if (!shop) fail("Amway subscriptions require the shop module.");
    this.shop = shop;
    this.now = now;
    this.subscriptions = new Map();
    this.occurrences = new Map();
    this.serial = 0;
  }

  subscribe({
    customer, department, lines, schedule, authorization,
    externalRef, benefitPolicy,
  } = {}) {
    if (typeof customer !== "string" || customer.length === 0) fail("Amway subscription requires a customer.");
    if (typeof department !== "string" || department.length === 0) fail("Amway subscription requires a department scope.");
    if (!Array.isArray(lines) || lines.length === 0) fail("Amway subscription requires eligible products.");
    if (!schedule || typeof schedule.interval !== "string") fail("Amway subscription requires a schedule.");
    if (!authorization || typeof authorization.id !== "string") {
      fail("Amway subscription requires customer authorization evidence.");
    }
    if (typeof externalRef !== "string" || externalRef.length === 0) {
      fail("Amway subscription requires the external subscription reference.");
    }
    if (!benefitPolicy || typeof benefitPolicy.version !== "string") {
      fail("Amway subscription requires a versioned benefit policy.");
    }
    for (const existing of this.subscriptions.values()) {
      if (existing.externalRef === externalRef && existing.status !== "cancelled") {
        fail(`Amway subscription ${externalRef} is already recorded.`);
      }
    }
    this.serial += 1;
    const subscription = {
      id: `sub-${this.serial}`, customer, department, lines: [...lines],
      schedule: { ...schedule }, authorization: { ...authorization },
      externalRef, benefitPolicy: { ...benefitPolicy },
      status: "active", createdAt: this.now(), cancelledAt: null,
    };
    this.subscriptions.set(subscription.id, subscription);
    return { ...subscription };
  }

  /**
   * Admits one executed occurrence as its own order. The occurrence identity
   * is idempotent: importing the same external occurrence twice returns the
   * original order.
   */
  occur({ subscription: id, occurrenceRef, order } = {}) {
    const subscription = this.subscriptions.get(id);
    if (!subscription) fail(`Amway unknown subscription ${id}.`);
    if (subscription.status !== "active") fail(`Amway subscription ${id} is not active.`);
    if (typeof occurrenceRef !== "string" || occurrenceRef.length === 0) {
      fail("Amway occurrence requires an external occurrence reference.");
    }
    const existing = this.occurrences.get(`${id}:${occurrenceRef}`);
    if (existing) return { ...existing, replayed: true };
    const admitted = this.shop.admitTransaction({
      ...order,
      customer: subscription.customer,
      department: subscription.department,
      idempotencyKey: `subscription:${subscription.externalRef}:${occurrenceRef}`,
    });
    const record = { subscription: id, occurrenceRef, transaction: admitted.id, admittedAt: this.now() };
    this.occurrences.set(`${id}:${occurrenceRef}`, record);
    return { ...record };
  }

  cancel({ subscription: id, atTime } = {}) {
    const subscription = this.subscriptions.get(id);
    if (!subscription) fail(`Amway unknown subscription ${id}.`);
    if (subscription.status === "cancelled") fail(`Amway subscription ${id} is already cancelled.`);
    subscription.status = "cancelled";
    subscription.cancelledAt = atTime ?? this.now();
    return { ...subscription };
  }

  ordersFor(id) {
    return [...this.occurrences.values()].filter(entry => entry.subscription === id).map(entry => ({ ...entry }));
  }
}
