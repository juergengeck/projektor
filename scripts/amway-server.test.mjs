import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AmwayDirectory } from "../packages/amway.app/departments.js";
import { getObjectByIdHash } from "../../one/packages/one.core/lib/storage-versioned-objects.js";
import { createAmwayServer } from "./amway-server.mjs";

// one.core pins its storage base directory process-wide: every server in
// this file shares one instance dir and runs strictly sequentially.
const instanceDir = mkdtempSync(path.join(tmpdir(), "amway-test-"));

async function started() {
  const directory = new AmwayDirectory({ bootstrapIssuers: ["person:root"], now: () => 1_000 });
  directory.createDepartment({
    id: "nord", name: "Nord", manager: "person:manager",
    createdBy: "person:root", createdAt: 1_000,
  });
  const { server } = createAmwayServer({ directory, instanceDir });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base, instanceDir };
}

async function close(server) {
  server.closeIdleConnections?.();
  await new Promise(resolve => server.close(resolve));
}

async function post(base, path, params = {}, cookie = "") {
  const headers = { "Content-Type": "application/json", Origin: base };
  if (cookie) headers.Cookie = cookie;
  const response = await fetch(`${base}${path}`, {
    method: "POST", headers, body: JSON.stringify(params),
  });
  const setCookie = response.headers.get("set-cookie") ?? "";
  const sessionCookie = (setCookie.match(/(amway-session-[^=]*=[^;]*)/) ?? [])[0] ?? "";
  return { status: response.status, body: await response.json(), sessionCookie };
}

async function unlocked(base, email = "seller@example.de", password = "geheimnis-1") {
  const opened = await post(base, "/session", { email, password });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.email, email);
  assert.ok(opened.body.owner);
  assert.ok(opened.sessionCookie.includes("amway-session-"));
  return opened.sessionCookie;
}

async function op(base, method, params, cookie) {
  const response = await post(base, `/api/amway/${method}`, params, cookie);
  assert.equal(response.status, 200);
  return response.body.product;
}

test("Amway shell serves the branded workspace over loopback", async (t) => {
  const { server, base } = await started();
  t.after(() => close(server));
  const html = await (await fetch(`${base}/amway/`)).text();
  assert.match(html, /Amway Arbeitsbereich/);
  assert.match(html, /main-nav/);
  assert.match(html, /settings-cog/);
  assert.match(html, /amway-logo-black\.svg/);
  const css = await fetch(`${base}/amway/ui/styles.css`);
  assert.equal(css.status, 200);
  const i18n = await fetch(`${base}/amway/i18n.js`);
  assert.equal(i18n.status, 200);
  assert.match(await i18n.text(), /Se connecter/);
});

test("React browser app is served same-origin when built", async (t) => {
  const { server, base } = await started();
  t.after(() => close(server));
  const html = await (await fetch(`${base}/browser/`)).text();
  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /\/browser\/assets\//);
});

test("one instance unlocks, gates scope, and refuses a second unlock", async (t) => {
  const { server, base } = await started();
  t.after(() => close(server));
  const anonymous = await post(base, "/api/amway/getScope", {});
  assert.equal(anonymous.status, 401);
  const cookie = await unlocked(base);
  const session = await op(base, "getSession", {}, cookie);
  assert.equal(session.email, "seller@example.de");
  const scope = await op(base, "getScope", {}, cookie);
  assert.deepEqual(scope.departments, [
    { id: "nord", name: "Nord", scope: "amway.department:nord" },
  ]);
  await op(base, "selectDepartment", { department: "nord" }, cookie);
  const locked = await post(base, "/session", { email: "other@example.de", password: "geheimnis-1" });
  assert.equal(locked.status, 409);
  assert.equal(locked.body.code, "auth.locked");
});

test("wrong instance secret fails without unlocking", async (t) => {
  const first = await started();
  await unlocked(first.base, "owner@example.de", "richtig-123");
  await close(first.server);
  const { server, base } = await started();
  t.after(() => close(server));
  const wrong = await post(base, "/session", { email: "owner@example.de", password: "falsch-falsch" });
  assert.equal(wrong.status, 400);
  const right = await post(base, "/session", { email: "owner@example.de", password: "richtig-123" });
  assert.equal(right.status, 200);
});

test("demo data fills every screen read", async (t) => {
  const { server, base } = await started();
  t.after(() => close(server));
  const cookie = await unlocked(base);
  const demo = await op(base, "loadDemo", {}, cookie);
  assert.equal(demo.department, "demo-de");
  const people = await op(base, "getDirectory", { department: "demo-de" }, cookie);
  assert.ok(people.assignments.length >= 4);
  assert.ok(people.contacts.some(entry => entry.certified.some(cert => cert.current)));
  assert.equal(people.names["person:demo-manager"]?.name, "Maria Manager");
  assert.equal(people.names["person:demo-seller"]?.name, "Selma Seller");
  assert.equal(people.names["person:demo-seller-2"]?.name, "Ben Berater");
  assert.equal(people.names["person:demo-customer-2"]?.name, "Karla Kunde");
  assert.equal(people.names["person:amway-de"]?.organization, true);
  const west = await op(base, "getDirectory", { department: "demo-de-west" }, cookie);
  assert.equal(west.names["person:demo-manager-2"]?.name, "Markus Manager");
  assert.equal(west.names["person:demo-seller-3"]?.name, "Sven Seller");
  assert.equal(west.names["person:demo-customer-3"]?.name, "Clara Customer");
  const contracts = await op(base, "getContracts", { department: "demo-de" }, cookie);
  assert.equal(contracts.contracts.length, 2);
  const catalog = await op(base, "getCatalog", {}, cookie);
  assert.ok(catalog.offers.some(entry => entry.id === "demo-offer-glister"));
  assert.ok(catalog.offers.length >= 30);
  assert.ok(catalog.items.some(entry => entry.itemNumber === "NUTRILITE-DOUBLE-X"));
  assert.ok(catalog.items.some(entry => entry.itemNumber === "AMWAY-HOME-LOC-1L"));
  const doubleX = catalog.items.find(entry => entry.itemNumber === "NUTRILITE-DOUBLE-X");
  assert.equal(doubleX.name, "Double X Multivitamin Tabletten");
  assert.equal(doubleX.category, "Ernährung");
  assert.equal(doubleX.pv, 42);
  const orders = await op(base, "getOrders", { department: "demo-de" }, cookie);
  assert.equal(orders.transactions.length, 2);
  assert.equal(orders.transactions[0].ledger.status, "fulfilled");
  assert.equal(orders.transactions[1].ledger.status, "accepted");
  assert.equal(orders.transactions[1].total, "156.20 EUR");
  assert.equal(orders.subscriptions.length, 2);
  assert.ok(orders.subscriptions.some(entry => entry.customer === "person:demo-customer-2"));
  const westOrders = await op(base, "getOrders", { department: "demo-de-west" }, cookie);
  assert.equal(westOrders.transactions.length, 1);
  assert.equal(westOrders.transactions[0].ledger.status, "accepted");
  assert.equal(westOrders.transactions[0].total, "42.70 EUR");
  const inventory = await op(base, "getInventory", {}, cookie);
  assert.equal(inventory.reservations.length, 5);
  const scoped = await op(base, "getInventory", { department: "demo-de" }, cookie);
  assert.ok(scoped.reservations.some(entry => entry.status === "consumed"));
  assert.equal(scoped.reservations.filter(entry => entry.status === "held").length, 3);
  const westInventory = await op(base, "getInventory", { department: "demo-de-west" }, cookie);
  assert.equal(westInventory.reservations.length, 1);
  assert.equal(westInventory.reservations[0].status, "held");
  const earnings = await op(base, "getEarnings", { department: "demo-de" }, cookie);
  assert.equal(earnings.sales[0].cash, "200.00 EUR");
  assert.equal(earnings.sales[1].cash, "0.00 EUR");
  assert.equal(earnings.sales[1].receivable, "156.20 EUR");
  const journal = await op(base, "getJournal", { department: "demo-de" }, cookie);
  assert.ok(journal.occurrences.length > 0);
  assert.equal(journal.cut.complete, true);
  // Newest first, with shop events attributed to their department.
  assert.equal(journal.occurrences[0].type, "order.accepted");
  assert.equal(journal.occurrences[0].transactionId, "tx-2");
  assert.ok(journal.occurrences.some(entry => entry.type === "payment.settled"));
  assert.ok(journal.occurrences.some(entry => entry.type === "reservation.held"));
  assert.ok(!journal.occurrences.some(entry =>
    entry.transactionId === "tx-3" || entry.department === "demo-de-west"));
  const settled = journal.occurrences.find(entry => entry.type === "payment.settled");
  assert.equal(settled.amountText, "200.00 EUR");
  assert.equal(journal.names["person:demo-seller"]?.name, "Selma Seller");
  assert.equal(journal.names["person:demo-customer-2"]?.name, "Karla Kunde");
  const status = await op(base, "getStatus", { department: "demo-de" }, cookie);
  assert.equal(status.summary.name, "Demo Deutschland");
  assert.deepEqual(status.summary.members, { manager: 1, admin: 1, seller: 2, customer: 2 });
  assert.equal(status.summary.items, 34);
  assert.equal(status.summary.offers, 34);
  assert.equal(status.summary.orders, 2);
  assert.deepEqual(status.summary.ordersByStatus, { fulfilled: 1, accepted: 1 });
  assert.equal(status.summary.cash, "200.00 EUR");
  assert.equal(status.summary.receivable, "156.20 EUR");
  assert.deepEqual(status.summary.reservations, { held: 3, consumed: 1 });
  assert.equal(status.summary.subscriptions, 2);
  assert.ok(status.summary.journalEvents > 0);
  const journalAgain = await op(base, "getJournal", { department: "demo-de" }, cookie);
  assert.equal(journalAgain.occurrences.length, journal.occurrences.length);
});

test("settings, export, trust elevation, and fresh-instance import", async (t) => {
  const { server, base } = await started();
  const cookie = await unlocked(base);
  await op(base, "loadDemo", {}, cookie);
  const settings = await op(base, "getSettings", {}, cookie);
  assert.equal(settings.schema.id, "amway");
  const updated = await op(base, "updateSettings", { key: "language", value: "fr" }, cookie);
  assert.equal(updated.values.language, "fr");
  const envelope = await op(base, "exportDepartment", { department: "demo-de" }, cookie);
  assert.equal(envelope.trust.status, "unverified");
  await close(server);

  const next = await started();
  t.after(() => close(next.server));
  const cookie2 = await unlocked(next.base, "ops@example.de");
  const imported = await op(next.base, "importDepartment", { envelope }, cookie2);
  assert.equal(imported.trustStatus, "unverified");
  await op(next.base, "trustSigner", { signer: envelope.trust.signer }, cookie2);
  const scope = await op(next.base, "getScope", {}, cookie2);
  assert.ok(scope.departments.some(entry => entry.id === "demo-de"));
});

test("invitation URLs pair new members with signed roles", async (t) => {
  const { server, base } = await started();
  t.after(() => close(server));
  const cookie = await unlocked(base);
  const invite = await op(base, "createInvite", {
    issuer: "person:manager", department: "nord", role: "seller",
  }, cookie);
  assert.ok(invite.url.startsWith("https://projektor.one/amway/invite/"));
  const listed = await op(base, "listInvites", { department: "nord" }, cookie);
  assert.equal(listed.invites.length, 1);
  const paired = await op(base, "acceptInvite", {
    invitationUrl: invite.url, person: "person:neu", name: "Neu Seller",
  }, cookie);
  assert.equal(paired.pairing.role, "seller");
  const people = await op(base, "getDirectory", { department: "nord" }, cookie);
  assert.equal(people.names["person:neu"]?.name, "Neu Seller");
  const empty = await op(base, "listInvites", { department: "nord" }, cookie);
  assert.equal(empty.invites.length, 0);
});

test("transport pairing completes invites with a primed intent", async (t) => {
  const { server, base } = await started();
  t.after(() => close(server));
  const cookie = await unlocked(base);
  const invite = await op(base, "createInvite", {
    issuer: "person:manager", department: "nord", role: "customer", pairing: {},
  }, cookie);
  assert.deepEqual(invite.pairing, { topic: "amway.department:nord", connectionMode: "primed" });
  const completed = await op(base, "pairingComplete", {
    token: invite.token, person: "person:fern-beitritt", name: "Fern Beitritt",
    topicId: "amway.department:nord", remotePerson: "person:fern-geraet",
  }, cookie);
  assert.equal(completed.pairing.role, "customer");
  assert.equal(completed.pairing.pairedBy, "person:fern-geraet");
  const people = await op(base, "getDirectory", { department: "nord" }, cookie);
  assert.equal(people.names["person:fern-beitritt"]?.name, "Fern Beitritt");
});

test("department roots publish durably with a stable id", async (t) => {
  const { server, base } = await started();
  t.after(() => close(server));
  const cookie = await unlocked(base);
  await op(base, "loadDemo", {}, cookie);
  const first = await op(base, "publishDepartment", {
    issuer: "person:demo-manager", department: "demo-de",
  }, cookie);
  assert.ok(/^[0-9a-f]{64}$/.test(first.rootRef));
  assert.ok(/^[0-9a-f]{64}$/.test(first.rootVersionRef));
  assert.equal(first.counts.items, 34);
  const stored = await getObjectByIdHash(first.rootRef);
  assert.equal(stored.obj.department, "demo-de");
  assert.ok(JSON.parse(stored.obj.members).some(entry => entry.subject === "person:demo-manager"));
  const second = await op(base, "publishDepartment", {
    issuer: "person:demo-manager", department: "demo-de",
  }, cookie);
  assert.equal(second.rootRef, first.rootRef);
  const latest = await getObjectByIdHash(first.rootRef);
  assert.equal(latest.hash, second.rootVersionRef);
  const denied = await post(base, "/api/amway/publishDepartment", {
    issuer: "person:demo-seller", department: "demo-de",
  }, cookie);
  assert.equal(denied.status, 400);
  assert.match(denied.body.error, /no manager role/);
});

test("Amway server rejects cross-origin access", async (t) => {
  const { server, base } = await started();
  t.after(() => close(server));
  const crossOrigin = await fetch(`${base}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://evil.example" },
    body: "{}",
  });
  assert.equal(crossOrigin.status, 403);
});
