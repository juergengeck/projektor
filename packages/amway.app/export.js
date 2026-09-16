/**
 * Per-department import/export, modeled on the vger memories export format.
 *
 * Like a portable memory document, a department export is self-contained:
 * the envelope carries the data, the exporter identity, and a trust block.
 * There is no signature infrastructure in this slice, so exports are
 * unsigned and import as `unverified` by default — exactly the memories
 * design decision. Trust is explicit: the operator elevates a signer through
 * `trustSigner`, never implicitly at import time. Re-importing an envelope
 * replays to the original import instead of duplicating records.
 */

import { createTransaction } from "../shop.amway/transactions.js";
import { AmwayLifecycle } from "../shop.amway/lifecycle.js";

export const AMWAY_EXPORT_FORMAT = "amway.department-export";
export const AMWAY_EXPORT_VERSION = 1;

function fail(message) {
  throw new Error(message);
}

function required(value, field) {
  if (value === undefined || value === null || value === "") fail(`Amway export: ${field} is required.`);
  return value;
}

const clone = value => JSON.parse(JSON.stringify(value));

export function exportDepartment(modules, department, { exportedBy, exportId = null } = {}) {
  const { directory, phonebook, shop, lifecycle, subscriptions, returns, reconciliation } = modules;
  required(exportedBy, "exportedBy");
  const record = directory.departments.get(required(department, "department"));
  if (!record) fail(`Amway export: unknown department ${department}.`);
  const inScope = entry => entry.department === department;
  const data = {
    department: clone(record),
    assignments: [...directory.assignments.values()].filter(inScope).map(clone),
    contracts: [...directory.contracts.values()].filter(inScope).map(clone),
    entries: [...directory.entries.values()].filter(inScope).map(clone),
    contacts: [...phonebook.contacts.values()].filter(inScope).map(clone),
    certified: [...phonebook.certified.values()].map(entry => {
      const contact = phonebook.contacts.get(entry.publishedContact);
      return contact && contact.department === department ? clone(entry) : null;
    }).filter(Boolean),
    books: [...phonebook.books.values()].filter(inScope).map(book => ({
      ...clone(book),
      entries: [...book.entries],
      grants: book.grants.map(clone),
    })),
    catalog: {
      items: [...shop.catalog.items.values()].map(clone),
      priceLists: [...shop.catalog.priceLists.values()].map(clone),
      offers: [...shop.catalog.offers.values()].filter(offer => offer.channel).map(clone),
    },
    transactions: [...shop.transactions.values()]
      .filter(entry => entry.department === department).map(clone),
    // The lifecycle log is shop-scoped, not department-scoped: merging
    // another log into a live lifecycle would corrupt reservations, so the
    // full log ships and the importer decides (fresh replace vs retain).
    lifecycleEvents: lifecycle.events.map(clone),
    subscriptions: subscriptions
      ? [...subscriptions.subscriptions.values()].filter(entry => entry.department === department).map(clone)
      : [],
    occurrences: subscriptions ? [...subscriptions.occurrences.values()].map(clone) : [],
    returnCases: returns ? [...returns.cases.values()].map(kase => ({ ...clone(kase) })) : [],
    corrections: returns ? returns.corrections.map(clone) : [],
    statements: reconciliation ? [...reconciliation.statements.values()].map(clone) : [],
    payouts: reconciliation ? [...reconciliation.payouts.values()].map(clone) : [],
  };
  return {
    format: AMWAY_EXPORT_FORMAT,
    version: AMWAY_EXPORT_VERSION,
    exportId: exportId ?? `export-${department}-${Date.now()}`,
    department,
    exportedAt: Date.now(),
    exportedBy,
    exporter: { identity: exportedBy, departmentManager: record.manager, organizationManager: record.createdBy },
    trust: { signer: exportedBy, status: "unverified", signature: null },
    data,
  };
}

function sameRecord(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function maxSerial(ids, current) {
  let max = current;
  for (const id of ids) {
    const serial = Number(String(id).split("-").pop());
    if (Number.isSafeInteger(serial)) max = Math.max(max, serial);
  }
  return max;
}

function restoreMap(map, records, what) {
  let imported = 0;
  for (const record of records) {
    const existing = map.get(record.id);
    if (existing) {
      if (!sameRecord(existing, record)) fail(`Amway import: conflicting ${what} ${record.id}.`);
      continue;
    }
    map.set(record.id, record);
    imported += 1;
  }
  return imported;
}

/**
 * Restores an envelope into live modules. Unknown or non-elevated signers
 * import as `unverified`; `imports` tracks envelope ids for replay safety.
 */
export function importDepartment(modules, envelope, { importedBy, elevate = false, imports = new Map(), trustedSigners = new Set() } = {}) {
  required(importedBy, "importedBy");
  if (!envelope || envelope.format !== AMWAY_EXPORT_FORMAT) fail("Amway import: not a department export.");
  if (envelope.version !== AMWAY_EXPORT_VERSION) fail(`Amway import: unsupported version ${envelope.version}.`);
  const { directory, phonebook, shop } = modules;
  for (const key of ["department", "assignments", "contracts", "entries", "contacts", "certified", "books"]) {
    if (!envelope.data || envelope.data[key] === undefined) fail(`Amway import: envelope lacks ${key}.`);
  }
  const replayed = imports.get(envelope.exportId);
  if (replayed) return { ...replayed, replayed: true };

  const signer = envelope.trust?.signer ?? envelope.exportedBy;
  const trusted = trustedSigners.has(signer) || elevate;
  const department = clone(envelope.data.department);
  const existing = directory.departments.get(department.id);
  if (existing && !sameRecord(existing, department)) {
    fail(`Amway import: department ${department.id} exists with different content.`);
  }
  let imported = existing ? 0 : 1;
  if (!existing) {
    directory.departments.set(department.id, department);
    directory.events.push({ seq: directory.serial += 1, type: "department.imported", department: department.id, atTime: Date.now() });
  }

  imported += restoreMap(directory.assignments, envelope.data.assignments.map(clone), "assignment");
  imported += restoreMap(directory.contracts, envelope.data.contracts.map(clone), "contract");
  for (const entry of envelope.data.entries.map(clone)) {
    const key = `${entry.department}:${entry.person}:${entry.sharedWith}`;
    const prior = [...directory.entries.values()].find(candidate =>
      candidate.department === entry.department && candidate.person === entry.person &&
      candidate.sharedWith === entry.sharedWith);
    if (prior) {
      if (!sameRecord(prior, entry)) fail("Amway import: conflicting directory entry.");
      continue;
    }
    directory.entries.set(key, entry);
    imported += 1;
  }
  imported += restoreMap(phonebook.contacts, envelope.data.contacts.map(clone), "contact");
  imported += restoreMap(phonebook.certified, envelope.data.certified.map(clone), "certified contact");
  for (const book of envelope.data.books.map(clone)) {
    const prior = phonebook.books.get(book.id);
    if (prior) {
      if (!sameRecord(prior, book)) fail(`Amway import: conflicting phonebook ${book.id}.`);
      continue;
    }
    phonebook.books.set(book.id, book);
    imported += 1;
  }

  for (const item of envelope.data.catalog?.items ?? []) {
    const key = `${item.itemNumber}@${item.version}`;
    if (!shop.catalog.items.has(key)) {
      const { version, key: _key, ...definition } = item;
      shop.catalog.registerItem(definition, { version });
      imported += 1;
    }
  }
  for (const list of envelope.data.catalog?.priceLists ?? []) {
    const key = `${list.id}@${list.version}`;
    if (!shop.catalog.priceLists.has(key)) {
      shop.catalog.publishPriceList({ id: list.id, version: list.version, currency: list.currency, prices: Object.fromEntries(Object.entries(list.prices).map(([item, price]) => [item, price.amount])) });
      imported += 1;
    }
  }
  for (const offer of envelope.data.catalog?.offers ?? []) {
    if (!shop.catalog.offers.has(offer.id)) {
      shop.catalog.publishOffer({ id: offer.id, item: offer.item, priceList: offer.priceList, channel: offer.channel, eligible: offer.eligible ?? null });
      imported += 1;
    }
  }
  for (const record of envelope.data.transactions ?? []) {
    if (shop.transactions.has(record.id)) {
      if (!sameRecord(shop.transactions.get(record.id), record)) {
        fail(`Amway import: conflicting transaction ${record.id}.`);
      }
      continue;
    }
    const { id, status: _status, total: _total, ...params } = record;
    const validated = createTransaction({ id, ...params });
    if (!sameRecord(validated.total, record.total)) fail(`Amway import: transaction ${id} total mismatch.`);
    shop.transactions.set(id, validated);
    const priorKey = shop.byIdempotencyKey.get(validated.idempotencyKey);
    if (priorKey && priorKey.id !== id) fail(`Amway import: idempotency conflict for ${validated.idempotencyKey}.`);
    shop.byIdempotencyKey.set(validated.idempotencyKey, validated);
    const serial = Number(String(id).replace("tx-", ""));
    if (Number.isSafeInteger(serial)) shop.serial = Math.max(shop.serial, serial);
    imported += 1;
  }

  const { subscriptions, returns, reconciliation } = modules;
  if (subscriptions) {
    for (const record of (envelope.data.subscriptions ?? []).map(clone)) {
      const prior = subscriptions.subscriptions.get(record.id);
      if (prior) {
        if (!sameRecord(prior, record)) fail(`Amway import: conflicting subscription ${record.id}.`);
        continue;
      }
      subscriptions.subscriptions.set(record.id, record);
      imported += 1;
    }
    for (const record of (envelope.data.occurrences ?? []).map(clone)) {
      const key = `${record.subscription}:${record.occurrenceRef}`;
      if (!subscriptions.occurrences.has(key)) {
        subscriptions.occurrences.set(key, record);
        imported += 1;
      }
    }
    subscriptions.serial = maxSerial([...subscriptions.subscriptions.keys()], subscriptions.serial);
  }
  if (returns) {
    for (const record of (envelope.data.returnCases ?? []).map(clone)) {
      const prior = returns.cases.get(record.id);
      if (prior) {
        if (!sameRecord(prior, record)) fail(`Amway import: conflicting return ${record.id}.`);
        continue;
      }
      returns.cases.set(record.id, record);
      imported += 1;
    }
    const known = new Set(returns.corrections.map(entry => JSON.stringify(entry)));
    for (const correction of (envelope.data.corrections ?? []).map(clone)) {
      if (!known.has(JSON.stringify(correction))) {
        returns.corrections.push(correction);
        imported += 1;
      }
    }
    returns.serial = maxSerial([...returns.cases.keys()], returns.serial);
  }
  if (reconciliation) {
    imported += restoreMap(reconciliation.statements, (envelope.data.statements ?? []).map(clone), "statement");
    for (const payout of (envelope.data.payouts ?? []).map(clone)) {
      if (!reconciliation.payouts.has(payout.payoutRef)) {
        reconciliation.payouts.set(payout.payoutRef, payout);
        imported += 1;
      }
    }
    reconciliation.serial = maxSerial([...reconciliation.statements.keys()], reconciliation.serial);
  }

  // Lifecycle: replace only a fresh lifecycle; a live one is retained and
  // the exported log is reported pending instead of merged.
  const incoming = modules.lifecycle;
  let lifecycle = "retained-target";
  if (incoming && incoming.reservations.size === 0 && incoming.links.size === 0) {
    const rebuilt = lifecycleFromExport(shop, envelope, {});
    incoming.reservations = rebuilt.reservations;
    incoming.links = rebuilt.links;
    incoming.recognized = rebuilt.recognized;
    incoming.payments = rebuilt.payments;
    incoming.paymentRefs = rebuilt.paymentRefs;
    incoming.events = rebuilt.events;
    incoming.version = rebuilt.version;
    lifecycle = "restored";
  }

  const result = {
    department: department.id,
    trustStatus: trusted ? "trusted" : "unverified",
    signer,
    imported,
    lifecycle,
    pendingLifecycleEvents: lifecycle === "restored" ? 0 : (envelope.data.lifecycleEvents ?? []).length,
    importedBy,
    importedAt: Date.now(),
  };
  imports.set(envelope.exportId, result);
  return { ...result, replayed: false };
}

export function lifecycleFromExport(shop, envelope, { now } = {}) {
  const lifecycle = new AmwayLifecycle({ shop, now });
  return lifecycle.rehydrate((envelope.data.lifecycleEvents ?? []).map(clone));
}
