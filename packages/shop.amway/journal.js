/**
 * Producer journal for the Amway workspace (slice 6).
 *
 * Shop events alone cannot provide the whole journal: role-assignment and
 * other sharing producers emit their own lifecycle and recipient/version
 * evidence. The journal ingests per-producer event roots and reads the
 * scoped, paginated occurrence list at a declared completeness cut. A
 * missing producer root surfaces as a gap, never as silent completeness.
 * Journal access never grants payload access: occurrences carry exact
 * references, not content.
 */

function fail(message) {
  throw new Error(message);
}

export class AmwayJournal {
  constructor({ expectedProducers = [], now = () => Date.now() } = {}) {
    this.now = now;
    this.expectedProducers = new Set(expectedProducers);
    this.roots = new Map();
    this.occurrences = [];
  }

  declareProducer(producer) {
    if (typeof producer !== "string" || producer.length === 0) fail("Amway journal requires a producer name.");
    this.expectedProducers.add(producer);
  }

  ingest({ producer, events } = {}) {
    if (!this.expectedProducers.has(producer)) {
      fail(`Amway journal does not expect producer ${producer}.`);
    }
    if (!Array.isArray(events)) fail("Amway journal ingest requires an event list.");
    const root = this.roots.get(producer) ?? { producer, count: 0 };
    for (const event of events) {
      this.occurrences.push({ producer, ...event });
      root.count += 1;
    }
    root.cutAt = this.now();
    this.roots.set(producer, root);
    return { ...root };
  }

  completeness() {
    const ingested = new Set(this.roots.keys());
    const missing = [...this.expectedProducers].filter(producer => !ingested.has(producer));
    return {
      producers: [...this.expectedProducers],
      ingested: [...ingested],
      missing,
      complete: missing.length === 0,
      cutAt: this.now(),
    };
  }

  read({ department, actor, type, transaction, since = 0, until = Number.MAX_SAFE_INTEGER, limit = 50, cursor = 0 } = {}) {
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 500) {
      fail("Amway journal read requires a limit between 1 and 500.");
    }
    const filtered = this.occurrences.filter(event =>
      (department === undefined || event.department === department) &&
      (actor === undefined || event.issuer === actor || event.subject === actor || event.holder === actor) &&
      (type === undefined || event.type === type) &&
      (transaction === undefined || event.transaction === transaction || event.transactionId === transaction) &&
      event.atTime >= since && event.atTime <= until);
    const page = filtered.slice(cursor, cursor + limit);
    return {
      occurrences: page.map(event => ({ ...event })),
      cut: { total: filtered.length, atTime: this.now(), complete: this.completeness().complete },
      nextCursor: cursor + page.length < filtered.length ? cursor + page.length : null,
    };
  }
}
