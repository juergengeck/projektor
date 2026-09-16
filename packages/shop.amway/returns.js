/**
 * Returns, reversals, and corrections for `shop.amway` (slice 5).
 *
 * A return case routes to the original seller through the recorded purchase
 * channel and retains order, return reference, tracking, receipt, inspection,
 * and refund/replacement evidence. Sets require component completeness. A
 * request alone establishes nothing: sellability and refunds follow explicit
 * resolution. Corrections append linked goods and financial adjustments under
 * the recognition policy and preserve the original transaction; the original
 * sale is never rewritten.
 */

function fail(message) {
  throw new Error(message);
}

export class AmwayReturns {
  constructor({ shop, now = () => Date.now() } = {}) {
    if (!shop) fail("Amway returns require the shop module.");
    this.shop = shop;
    this.now = now;
    this.cases = new Map();
    this.corrections = [];
    this.serial = 0;
  }

  open({ transaction: transactionId, returnRef, reason } = {}) {
    const transaction = this.shop.getTransaction(transactionId);
    if (typeof returnRef !== "string" || returnRef.length === 0) {
      fail("Amway return requires a return reference.");
    }
    if (typeof reason !== "string" || reason.length === 0) fail("Amway return requires a reason.");
    for (const existing of this.cases.values()) {
      if (existing.returnRef === returnRef) fail(`Amway return ${returnRef} is already open.`);
    }
    this.serial += 1;
    const opened = {
      id: `ret-${this.serial}`, transaction: transactionId,
      // Routed from the original order: partner purchases go back to that
      // partner, direct purchases to Amway fulfilment.
      responsibleSeller: transaction.seller, channel: transaction.channel,
      returnRef, reason, status: "requested",
      tracking: null, receipt: null, inspection: null, resolution: null,
      openedAt: this.now(),
    };
    this.cases.set(opened.id, opened);
    return { ...opened };
  }

  receive({ kase: id, tracking, condition, componentsComplete } = {}) {
    const kase = this.cases.get(id);
    if (!kase) fail(`Amway unknown return ${id}.`);
    if (kase.status !== "requested") fail(`Amway return ${id} is already ${kase.status}.`);
    if (typeof tracking !== "string" || tracking.length === 0) fail("Amway return receipt requires tracking evidence.");
    if (typeof condition !== "string" || condition.length === 0) {
      fail("Amway return receipt requires a condition inspection.");
    }
    if (typeof componentsComplete !== "boolean") {
      fail("Amway return receipt requires a set-completeness check.");
    }
    kase.tracking = tracking;
    kase.receipt = { tracking, receivedAt: this.now() };
    kase.inspection = { condition, componentsComplete, inspectedAt: this.now() };
    kase.status = "received";
    return { ...kase };
  }

  /**
   * Resolves the case with a refund, a replacement, or a rejection. Refunds
   * append a financial correction linked to the original transaction; goods
   * corrections record the inspected receipt for restocking decisions made
   * against real goods evidence elsewhere. Neither rewrites the sale.
   */
  resolve({ kase: id, decision, refundAmount = null, replacementRef = null, policy } = {}) {
    const kase = this.cases.get(id);
    if (!kase) fail(`Amway unknown return ${id}.`);
    if (kase.status !== "received") fail(`Amway return ${id} is not received.`);
    if (!["refund", "replace", "reject"].includes(decision)) {
      fail(`Amway unknown return decision ${decision}.`);
    }
    if (!policy || typeof policy.version !== "string") {
      fail("Amway return resolution requires a policy version.");
    }
    const transaction = this.shop.getTransaction(kase.transaction);
    if (decision === "refund") {
      if (!refundAmount || refundAmount.currency !== transaction.total.currency) {
        fail("Amway refund must match the transaction currency.");
      }
      if (refundAmount.amount <= 0 || refundAmount.amount > transaction.total.amount) {
        fail("Amway refund must be positive and within the transaction total.");
      }
    }
    if (decision === "replace" && (typeof replacementRef !== "string" || replacementRef.length === 0)) {
      fail("Amway replacement requires the replacement order reference.");
    }
    kase.resolution = {
      decision, refundAmount, replacementRef,
      policyVersion: policy.version, resolvedAt: this.now(),
    };
    kase.status = decision === "reject" ? "rejected" : "resolved";
    const correction = {
      transaction: kase.transaction, returnCase: id, decision,
      refundAmount, policyVersion: policy.version, correctedAt: this.now(),
    };
    this.corrections.push(correction);
    return { kase: { ...kase }, correction: { ...correction } };
  }

  correctionsFor(transactionId) {
    return this.corrections.filter(entry => entry.transaction === transactionId).map(entry => ({ ...entry }));
  }

  refundedTotal(transactionId) {
    this.shop.getTransaction(transactionId);
    return this.corrections
      .filter(entry => entry.transaction === transactionId && entry.decision === "refund")
      .reduce((sum, entry) => sum + entry.refundAmount.amount, 0);
  }
}
