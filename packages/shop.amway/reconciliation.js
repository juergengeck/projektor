/**
 * Earnings-statement reconciliation for `shop.amway` (slice 5).
 *
 * Source statements are imported exactly: period, beneficiary, market,
 * currency, policy version, and lines linking orders and adjustments. Source
 * performance labels (PW/PV, GV/BV) are retained as performance measures and
 * can never enter euro totals. Reconciliation links each line to shop
 * evidence and exposes unexplained differences. Payout is matched separately:
 * a reported commission is never treated as paid cash, and no commission is
 * calculated — current plan rules are unverified inputs.
 */

function fail(message) {
  throw new Error(message);
}

export class AmwayReconciliation {
  constructor({ shop, returns = null, now = () => Date.now() } = {}) {
    if (!shop) fail("Amway reconciliation requires the shop module.");
    this.shop = shop;
    this.returns = returns;
    this.now = now;
    this.statements = new Map();
    this.payouts = new Map();
    this.serial = 0;
  }

  importStatement({ beneficiary, period, market, currency, policyVersion, lines, sourceRef } = {}) {
    if (typeof beneficiary !== "string" || beneficiary.length === 0) fail("Amway statement requires a beneficiary.");
    if (!period || typeof period.id !== "string") fail("Amway statement requires a period.");
    if (typeof market !== "string" || market.length === 0) fail("Amway statement requires a market.");
    if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
      fail("Amway statement requires a 3-letter ISO currency code.");
    }
    if (typeof policyVersion !== "string" || policyVersion.length === 0) {
      fail("Amway statement requires a policy version.");
    }
    if (!Array.isArray(lines) || lines.length === 0) fail("Amway statement requires lines.");
    for (const line of lines) {
      if (typeof line.kind !== "string") fail("Amway statement line requires a kind.");
      if (line.amount !== null && line.amount !== undefined) {
        if (!Number.isSafeInteger(line.amount) || line.amount < 0) {
          fail("Amway statement money must be non-negative integer minor units.");
        }
      }
      // Performance measures stay measures: points fields must never be
      // numeric amounts mixed into money, so they carry their own labels.
      if (line.points !== undefined && typeof line.points !== "object") {
        fail("Amway performance measures must be labelled points, not money.");
      }
    }
    this.serial += 1;
    const statement = {
      id: `stmt-${this.serial}`, beneficiary, period: { ...period }, market, currency,
      policyVersion, lines: lines.map(line => ({ ...line })),
      sourceRef: sourceRef ?? null, importedAt: this.now(), status: "imported",
    };
    this.statements.set(statement.id, statement);
    return { ...statement };
  }

  /**
   * Matches statement lines against shop transactions and return
   * corrections. Lines without evidence stay unexplained; team totals
   * without an externally evidenced team scope stay unreconciled.
   */
  reconcile({ statement: id, teamScope = null } = {}) {
    const statement = this.statements.get(id);
    if (!statement) fail(`Amway unknown statement ${id}.`);
    const matched = [];
    const unexplained = [];
    for (const line of statement.lines) {
      if (line.kind === "team-total" && !teamScope) {
        unexplained.push({ line, reason: "team scope is not externally evidenced" });
        continue;
      }
      if (line.order) {
        const transaction = this.shop.transactions.get(line.order);
        if (!transaction) {
          unexplained.push({ line, reason: "order has no shop evidence" });
          continue;
        }
        if (transaction.total.currency !== statement.currency) {
          unexplained.push({ line, reason: "statement currency differs from order currency" });
          continue;
        }
        matched.push({ line, transaction: transaction.id, total: transaction.total.amount });
        continue;
      }
      if (line.adjustment && this.returns) {
        const corrections = this.returns.correctionsFor(line.adjustment);
        if (corrections.length === 0) {
          unexplained.push({ line, reason: "adjustment has no return correction" });
          continue;
        }
        matched.push({ line, corrections: corrections.length });
        continue;
      }
      unexplained.push({ line, reason: "line links no shop evidence" });
    }
    statement.status = unexplained.length === 0 ? "reconciled" : "partial";
    return {
      statement: id, status: statement.status,
      matched, unexplained,
      pointsAreNotMoney: true,
    };
  }

  /** Cash received is recorded independently of the reported entitlement. */
  matchPayout({ statement: id, payoutRef, amount } = {}) {
    const statement = this.statements.get(id);
    if (!statement) fail(`Amway unknown statement ${id}.`);
    if (typeof payoutRef !== "string" || payoutRef.length === 0) fail("Amway payout requires a reference.");
    if (!Number.isSafeInteger(amount) || amount <= 0) fail("Amway payout must be positive integer minor units.");
    if (this.payouts.has(payoutRef)) return { ...this.payouts.get(payoutRef), replayed: true };
    const payout = { statement: id, payoutRef, amount, matchedAt: this.now() };
    this.payouts.set(payoutRef, payout);
    return { ...payout };
  }
}
