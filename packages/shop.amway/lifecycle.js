/**
 * `shop.amway` lifecycle (slices 3-4): reservations with last-unit
 * concurrency protection, order acceptance, linked fulfilment, revenue
 * recognition, and settlement.
 *
 * Each mutation requires the current ledger version and advances it, so two
 * sellers racing for the last unit cannot both succeed: the loser sees a
 * stale version or insufficient net availability and fails before recording
 * anything. Reservation reduces availability without pretending goods moved;
 * movement, title/custody acceptance, invoicing, recognition, and payment
 * stay separate linked evidence.
 *
 * Physical stock, available-to-sell, recognized revenue, receivable, and cash
 * received are separate projections of the same admitted transaction set. A
 * missing counterpart surfaces as pending work, never as a completed
 * reconciliation. Every mutation appends to `events`, from which a restarted
 * runtime rebuilds identical state via `rehydrate`.
 */

function fail(message) {
  throw new Error(message);
}

export class AmwayLifecycle {
  constructor({ shop, now = () => Date.now() } = {}) {
    if (!shop) fail("Amway lifecycle requires the shop module.");
    this.shop = shop;
    this.now = now;
    this.version = 0;
    this.reservations = new Map();
    this.links = new Map();
    this.recognized = new Map();
    this.payments = new Map();
    this.paymentRefs = new Set();
    this.events = [];
    this.serial = 0;
  }

  #record(type, detail) {
    this.serial += 1;
    const event = { seq: this.serial, type, atTime: this.now(), ...detail };
    this.events.push(event);
    return event;
  }

  #checkVersion(expectedVersion) {
    if (expectedVersion !== this.version) {
      fail("Amway ledger changed. Refresh and review the action before submitting again.");
    }
  }

  #commit(expectedVersion, type, detail, apply) {
    this.#checkVersion(expectedVersion);
    const result = apply();
    this.version += 1;
    this.#record(type, { ...detail, version: this.version });
    return result;
  }

  #stateFor(transactionId) {
    let links = this.links.get(transactionId);
    if (!links) {
      links = { status: "admitted", movementRefs: [], titleRefs: [], invoiceRefs: [] };
      this.links.set(transactionId, links);
    }
    return links;
  }

  /**
   * Net available-to-sell for a lot: gross on-hand across the facility-scoped
   * projection rows minus quantities held by live reservations.
   */
  netAvailability(stockProjection, lot) {
    const gross = this.shop.grossAvailability(stockProjection, lot);
    let held = 0;
    for (const reservation of this.reservations.values()) {
      if (reservation.lot === lot && reservation.status === "held") held += reservation.quantity;
    }
    return gross - held;
  }

  reserve({ expectedVersion, transactionId, lot, quantity, facility, stockProjection } = {}) {
    // Pre-allocate the stable id so the held event carries it for rehydration.
    // A failed commit leaves a harmless gap, never a duplicate.
    this.serial += 1;
    const id = `res-${this.serial}`;
    return this.#commit(expectedVersion, "reservation.held", {
      reservation: id, transactionId, lot, quantity, facility,
    }, () => {
      const transaction = this.shop.getTransaction(transactionId);
      if (transaction.channel !== "facility") fail("Amway direct orders hold no facility stock.");
      if (transaction.facility !== facility) fail("Amway reservation must name the transaction facility.");
      if (!Number.isSafeInteger(quantity) || quantity <= 0) fail("Amway reservation quantity must be a positive integer.");
      if (this.netAvailability(stockProjection, lot) < quantity) {
        fail(`Amway cannot reserve ${quantity} of ${lot}: insufficient available stock.`);
      }
      const reservation = {
        id, transactionId, lot, quantity, facility,
        status: "held", heldAt: this.now(),
      };
      this.reservations.set(id, reservation);
      return { ...reservation };
    });
  }

  release({ expectedVersion, reservation: id } = {}) {
    return this.#commit(expectedVersion, "reservation.released", { reservation: id }, () => {
      const reservation = this.reservations.get(id);
      if (!reservation) fail(`Amway unknown reservation ${id}.`);
      if (reservation.status !== "held") fail(`Amway reservation ${id} is not held.`);
      reservation.status = "released";
      return { ...reservation };
    });
  }

  accept({ expectedVersion, transactionId } = {}) {
    return this.#commit(expectedVersion, "order.accepted", { transactionId }, () => {
      const transaction = this.shop.getTransaction(transactionId);
      const state = this.#stateFor(transactionId);
      if (state.status !== "admitted") fail(`Amway transaction ${transactionId} is already ${state.status}.`);
      if (transaction.channel === "facility") {
        const held = [...this.reservations.values()].some(
          reservation => reservation.transactionId === transactionId && reservation.status === "held",
        );
        if (!held) fail(`Amway transaction ${transactionId} has no held reservation.`);
      }
      state.status = "accepted";
      return { transactionId, status: state.status };
    });
  }

  fulfil({ expectedVersion, transactionId, movementRef, titleRef, invoiceRef } = {}) {
    return this.#commit(expectedVersion, "order.fulfilled", {
      transactionId, movementRef, titleRef, invoiceRef,
    }, () => {
      const state = this.#stateFor(transactionId);
      if (state.status !== "accepted") fail(`Amway transaction ${transactionId} is not accepted.`);
      for (const [name, ref] of [["movementRef", movementRef], ["titleRef", titleRef], ["invoiceRef", invoiceRef]]) {
        if (typeof ref !== "string" || ref.length === 0) fail(`Amway fulfilment requires ${name}.`);
      }
      state.movementRefs.push(movementRef);
      state.titleRefs.push(titleRef);
      state.invoiceRefs.push(invoiceRef);
      state.status = "fulfilled";
      for (const reservation of this.reservations.values()) {
        if (reservation.transactionId === transactionId && reservation.status === "held") {
          reservation.status = "consumed";
        }
      }
      return { transactionId, status: state.status };
    });
  }

  /**
   * Revenue recognition follows the transaction's declared policy version. A
   * movement or invoice never counts as recognized revenue on its own, and
   * recognition never implies cash: cash stays zero until settlement.
   */
  recognize({ expectedVersion, transactionId, amount } = {}) {
    return this.#commit(expectedVersion, "revenue.recognized", { transactionId, amount }, () => {
      const transaction = this.shop.getTransaction(transactionId);
      const state = this.#stateFor(transactionId);
      if (state.status !== "fulfilled") fail(`Amway transaction ${transactionId} is not fulfilled.`);
      if (!Number.isSafeInteger(amount) || amount <= 0) fail("Amway recognized amount must be a positive integer.");
      if (amount > transaction.total.amount) {
        fail("Amway cannot recognize more than the transaction total.");
      }
      const prior = this.recognized.get(transactionId) ?? 0;
      if (prior + amount > transaction.total.amount) fail("Amway cannot recognize more than the transaction total.");
      this.recognized.set(transactionId, prior + amount);
      return { transactionId, recognized: prior + amount, receivable: transaction.total.amount - prior - amount };
    });
  }

  /**
   * Settlement records cash against the recognized receivable. Replayed
   * payment references return the original record without double counting.
   */
  settle({ expectedVersion, transactionId, paymentRef, amount } = {}) {
    const existing = this.paymentRefs.has(paymentRef);
    this.#checkVersion(expectedVersion);
    if (existing) {
      for (const payment of this.payments.values()) {
        if (payment.paymentRef === paymentRef) return { ...payment, replayed: true };
      }
    }
    // Pre-allocate the stable id so the settled event carries it for rehydration.
    this.serial += 1;
    const id = `pay-${this.serial}`;
    return this.#commit(expectedVersion, "payment.settled", {
      payment: id, transactionId, paymentRef, amount,
    }, () => {
      const transaction = this.shop.getTransaction(transactionId);
      if (typeof paymentRef !== "string" || paymentRef.length === 0) fail("Amway settlement requires a payment reference.");
      if (this.paymentRefs.has(paymentRef)) fail(`Amway payment ${paymentRef} is already settled.`);
      if (!Number.isSafeInteger(amount) || amount <= 0) fail("Amway payment amount must be a positive integer.");
      const recognizedTotal = this.recognized.get(transactionId) ?? 0;
      const paidTotal = [...this.payments.values()]
        .filter(payment => payment.transactionId === transactionId)
        .reduce((sum, payment) => sum + payment.amount, 0);
      if (paidTotal + amount > recognizedTotal) {
        fail("Amway cannot settle more cash than recognized revenue.");
      }
      const payment = {
        id, transactionId, paymentRef, amount,
        currency: transaction.total.currency, settledAt: this.now(),
      };
      this.payments.set(payment.id, payment);
      this.paymentRefs.add(paymentRef);
      return { ...payment, cashTotal: paidTotal + amount };
    });
  }

  projection(transactionId) {
    const transaction = this.shop.getTransaction(transactionId);
    const state = this.#stateFor(transactionId);
    const recognizedTotal = this.recognized.get(transactionId) ?? 0;
    const cashTotal = [...this.payments.values()]
      .filter(payment => payment.transactionId === transactionId)
      .reduce((sum, payment) => sum + payment.amount, 0);
    return {
      transactionId, status: state.status,
      total: { ...transaction.total },
      recognized: recognizedTotal,
      receivable: transaction.total.amount - cashTotal,
      cash: cashTotal,
    };
  }

  /** Incomplete goods/commercial pairs with their missing evidence. */
  pendingWork() {
    const pending = [];
    for (const transaction of this.shop.transactions.values()) {
      const state = this.#stateFor(transaction.id);
      if (state.status === "admitted") pending.push({ transaction: transaction.id, missing: "acceptance" });
      else if (state.status === "accepted") pending.push({ transaction: transaction.id, missing: "fulfilment" });
      else if (state.status === "fulfilled") {
        const recognizedTotal = this.recognized.get(transaction.id) ?? 0;
        const cashTotal = [...this.payments.values()]
          .filter(payment => payment.transactionId === transaction.id)
          .reduce((sum, payment) => sum + payment.amount, 0);
        if (recognizedTotal < transaction.total.amount) {
          pending.push({ transaction: transaction.id, missing: "recognition" });
        } else if (cashTotal < transaction.total.amount) {
          pending.push({ transaction: transaction.id, missing: "settlement" });
        }
      }
    }
    return pending;
  }

  /**
   * Rebuilds identical lifecycle state from a recorded event log. The clone
   * shares this shop, so catalog and admitted transactions survive the
   * restart; only reservations, links, recognition, and payments rebuild.
   */
  rehydrate(events) {
    const clone = new AmwayLifecycle({ shop: this.shop, now: this.now });
    for (const event of events) {
      switch (event.type) {
        case "reservation.held":
          clone.reservations.set(event.reservation, {
            id: event.reservation, transactionId: event.transactionId, lot: event.lot,
            quantity: event.quantity, facility: event.facility, status: "held", heldAt: event.atTime,
          });
          break;
        case "reservation.released": {
          const reservation = clone.reservations.get(event.reservation);
          if (!reservation) fail(`Amway cannot rehydrate unknown reservation ${event.reservation}.`);
          reservation.status = "released";
          break;
        }
        case "order.accepted":
          clone.#stateFor(event.transactionId).status = "accepted";
          break;
        case "order.fulfilled": {
          const state = clone.#stateFor(event.transactionId);
          state.status = "fulfilled";
          state.movementRefs.push(event.movementRef);
          state.titleRefs.push(event.titleRef);
          state.invoiceRefs.push(event.invoiceRef);
          for (const reservation of clone.reservations.values()) {
            if (reservation.transactionId === event.transactionId) reservation.status = "consumed";
          }
          break;
        }
        case "revenue.recognized":
          clone.recognized.set(
            event.transactionId, (clone.recognized.get(event.transactionId) ?? 0) + event.amount,
          );
          break;
        case "payment.settled":
          clone.payments.set(event.payment, {
            id: event.payment, transactionId: event.transactionId,
            paymentRef: event.paymentRef, amount: event.amount, settledAt: event.atTime,
          });
          clone.paymentRefs.add(event.paymentRef);
          break;
        default:
          fail(`Amway cannot rehydrate unknown event ${event.type}.`);
      }
      clone.version = event.version ?? clone.version;
      clone.events.push(event);
    }
    return clone;
  }
}
