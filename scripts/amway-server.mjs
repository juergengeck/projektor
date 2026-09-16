#!/usr/bin/env node
/**
 * Amway workspace server: one ONE instance serving the Amway operations.
 *
 * Like the inventory runtime, this process boots exactly one ONE instance:
 * `POST /session` unlocks (or creates) the local account, the instance
 * owner becomes the runtime identity, and every operation runs on the
 * instance's `OperationRegistry`. There are no parallel hand-rolled accounts;
 * restarting switches accounts. Domain state is process-local in this slice
 * and gains ONE-backed durability next (`durable: false` until then).
 */
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "../../one/packages/one.core/lib/system/load-nodejs.js";
import { initInstance, closeInstance, getInstanceOwnerIdHash } from "../../one/packages/one.core/lib/instance.js";
import { createAccess } from "../../one/packages/one.core/lib/access.js";
import { SET_ACCESS_MODE } from "../../one/packages/one.core/lib/storage-base-common.js";
import { storeVersionedObject } from "../../one/packages/one.core/lib/storage-versioned-objects.js";
import { publishDepartmentRoot, registerAmwayRecipes } from "../packages/amway.app/publication.js";
import { OperationRegistry, createPublicOperationCatalogPayload, hasPublicOperationMethod } from "../../one/packages/refinio.api/dist/src/registry/index.js";
import { AmwayDirectory } from "../packages/amway.app/departments.js";
import { AmwayInvites } from "../packages/amway.app/invites.js";
import { AmwayPhoneBook } from "../packages/amway.app/phonebook.js";
import { AmwaySettingsStore, amwaySettingsSchema } from "../packages/amway.app/settings.js";
import { AMWAY_APP_BOOK_CATALOG } from "../packages/amway.app/app-book.js";
import { exportDepartment, importDepartment } from "../packages/amway.app/export.js";
import { buildDemoDepartment } from "../packages/amway.app/demo.js";
import { AmwayShop } from "../packages/shop.amway/shop.js";
import { AmwayLifecycle } from "../packages/shop.amway/lifecycle.js";
import { AmwaySubscriptions } from "../packages/shop.amway/subscriptions.js";
import { AmwayReturns } from "../packages/shop.amway/returns.js";
import { AmwayReconciliation } from "../packages/shop.amway/reconciliation.js";
import { AmwayJournal } from "../packages/shop.amway/journal.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const UI_DIR = path.join(ROOT_DIR, "packages", "amway.app", "ui");
const ASSETS_DIR = path.join(ROOT_DIR, "packages", "amway.app", "assets");
const BROWSER_DIR = path.join(ROOT_DIR, "packages", "projektor.browser", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

export function createAmwayServer({ directory, instanceDir, shop, journal } = {}) {
  const directoryInstance = directory ?? new AmwayDirectory({ bootstrapIssuers: [] });
  const shopInstance = shop ?? new AmwayShop({});
  const phonebookInstance = new AmwayPhoneBook({ directory: directoryInstance });
  const state = {
    directory: directoryInstance,
    phonebook: phonebookInstance,
    invites: new AmwayInvites({ directory: directoryInstance, phonebook: phonebookInstance }),
    shop: shopInstance,
    lifecycle: new AmwayLifecycle({ shop: shopInstance }),
    subscriptions: new AmwaySubscriptions({ shop: shopInstance }),
    returns: new AmwayReturns({ shop: shopInstance }),
    reconciliation: null,
    journal: journal ?? new AmwayJournal({ expectedProducers: [] }),
    selectedDepartment: "",
    settings: new AmwaySettingsStore(),
    trustedSigners: new Set(),
    imports: new Map(),
    unlockEmail: "",
  };
  state.reconciliation = new AmwayReconciliation({ shop: shopInstance, returns: state.returns });

  let initialized = false;
  let opening = false;
  let registry;
  let session;

  const modules = () => ({
    directory: state.directory, phonebook: state.phonebook, shop: state.shop,
    lifecycle: state.lifecycle, subscriptions: state.subscriptions,
    returns: state.returns, reconciliation: state.reconciliation,
  });

  state.journal = journal ?? new AmwayJournal({ expectedProducers: ["assignments", "shop"] });
  const journalWatermark = { assignments: 0, shop: 0 };

  const money = value => `${(value.amount / 100).toFixed(2)} ${value.currency}`;

  /** ONE persistence behind the publication seam: raw storage, no model owner. */
  const amwayPersistence = {
    storeVersioned: async object => {
      const stored = await storeVersionedObject(object);
      return { idHash: String(stored.idHash), hash: String(stored.hash) };
    },
    grantIdRoots: async (idHashes, person) => {
      if (idHashes.length === 0) return;
      await createAccess(idHashes.map(idHash => ({
        id: idHash, person: [person], hashGroup: [], mode: SET_ACCESS_MODE.ADD,
      })));
    },
  };

  /** Department owning a reservation, via its transaction. Null when unknown. */
  function reservationDepartment(entry) {
    try {
      return state.shop.getTransaction(entry.transactionId).department;
    } catch {
      return null;
    }
  }

  /** Dashboard figures for one department, from raw minor-unit amounts. */
  function departmentSummary(department) {
    ingestJournal();
    const record = state.directory.departments.get(department);
    const members = {};
    for (const entry of state.directory.assignments.values()) {
      if (entry.department !== department || entry.revokedAt !== null) continue;
      members[entry.role] = (members[entry.role] ?? 0) + 1;
    }
    const txs = [...state.shop.transactions.values()].filter(entry => entry.department === department);
    const ordersByStatus = {};
    let cash = 0;
    let receivable = 0;
    let currency = "EUR";
    for (const tx of txs) {
      const ledger = state.lifecycle.projection(tx.id);
      ordersByStatus[ledger.status] = (ordersByStatus[ledger.status] ?? 0) + 1;
      cash += ledger.cash;
      receivable += ledger.receivable;
      currency = tx.total.currency;
    }
    const reservations = { held: 0, consumed: 0 };
    for (const entry of state.lifecycle.reservations.values()) {
      if (reservationDepartment(entry) !== department) continue;
      if (entry.status === "held") reservations.held += 1;
      else if (entry.status === "consumed") reservations.consumed += 1;
    }
    return {
      department,
      name: record.name,
      members,
      items: state.shop.catalog.items.size,
      offers: state.shop.catalog.offers.size,
      orders: txs.length,
      ordersByStatus,
      cash: money({ amount: cash, currency }),
      receivable: money({ amount: receivable, currency }),
      reservations,
      subscriptions: [...state.subscriptions.subscriptions.values()]
        .filter(entry => entry.department === department).length,
      journalEvents: state.journal.read({ department, limit: 1 }).cut.total,
    };
  }

  /**
   * Display names for person identities: the published contact name where
   * one exists, otherwise a marker for country organisation managers, else
   * the raw identity (never invent a name).
   */
  function displayNames(department) {
    const names = {};
    for (const contact of state.phonebook.contacts.values()) {
      if (contact.department === department && !names[contact.person]) {
        names[contact.person] = { name: contact.name, organization: false };
      }
    }
    for (const issuer of state.directory.bootstrapIssuers) {
      names[issuer] = names[issuer] ?? { name: null, organization: true };
      names[issuer].organization = true;
    }
    return names;
  }

  /** Feed new domain events into the journal exactly once per producer. */
  function ingestJournal() {
    const fresh = {
      assignments: state.directory.events.slice(journalWatermark.assignments),
      // Lifecycle events carry no department of their own: attribute them
      // through their transaction, otherwise department-scoped journal
      // reads would silently drop every order and stock event.
      shop: state.lifecycle.events.slice(journalWatermark.shop).map(event => {
        if (event.department !== undefined || !event.transactionId) return event;
        try {
          return { ...event, department: state.shop.getTransaction(event.transactionId).department };
        } catch {
          return event;
        }
      }),
    };
    for (const [producer, events] of Object.entries(fresh)) {
      if (events.length > 0) {
        state.journal.ingest({ producer, events });
        journalWatermark[producer] += events.length;
      }
    }
  }

  const plan = {
    getSession() {
      return { email: state.unlockEmail, owner: getInstanceOwnerIdHash() };
    },
    getScope(params = {}) {
      const departments = [...state.directory.departments.values()].map(entry => ({
        id: entry.id, name: entry.name, scope: entry.scope,
      }));
      const selected = params.department ?? state.selectedDepartment;
      if (selected !== "" && !state.directory.departments.has(selected)) {
        throw new Error(`Amway: unknown department ${selected}.`);
      }
      return { departments, selected, email: state.unlockEmail };
    },
    selectDepartment(params = {}) {
      if (typeof params.department !== "string" || !state.directory.departments.has(params.department)) {
        throw new Error("Amway: select a known department.");
      }
      state.selectedDepartment = params.department;
      return { selected: state.selectedDepartment };
    },
    getSettings() {
      return { schema: amwaySettingsSchema(), values: state.settings.getValues(state.unlockEmail) };
    },
    updateSettings(params = {}) {
      if (typeof params.key !== "string") throw new Error("Amway settings: key is required.");
      return { values: state.settings.setValue(state.unlockEmail, params.key, params.value) };
    },
    exportDepartment(params = {}) {
      if (typeof params.department !== "string") throw new Error("Amway: department is required.");
      return exportDepartment(modules(), params.department, { exportedBy: state.unlockEmail });
    },
    importDepartment(params = {}) {
      if (!params.envelope || typeof params.envelope !== "object") {
        throw new Error("Amway: envelope is required.");
      }
      return importDepartment(modules(), params.envelope, {
        importedBy: state.unlockEmail, elevate: params.elevate === true,
        imports: state.imports, trustedSigners: state.trustedSigners,
      });
    },
    loadDemo() {
      return buildDemoDepartment(modules());
    },
    getTrustInfo(params = {}) {
      if (typeof params.department !== "string") throw new Error("Amway: department is required.");
      const record = state.directory.departments.get(params.department);
      if (!record) throw new Error(`Amway: unknown department ${params.department}.`);
      const managerAssignment = [...state.directory.assignments.values()].find(entry =>
        entry.department === params.department && entry.role === "manager" && entry.subject === record.manager);
      return {
        department: params.department,
        manager: record.manager,
        organizationManager: record.createdBy,
        managerEnrolledBy: managerAssignment?.issuer ?? null,
        journal: state.journal.completeness(),
        trustedSigners: [...state.trustedSigners],
        imports: [...state.imports.values()].filter(entry => entry.department === params.department),
      };
    },
    trustSigner(params = {}) {
      if (typeof params.signer !== "string" || !params.signer) throw new Error("Amway: signer is required.");
      state.trustedSigners.add(params.signer);
      return { trustedSigners: [...state.trustedSigners] };
    },
    untrustSigner(params = {}) {
      state.trustedSigners.delete(params.signer);
      return { trustedSigners: [...state.trustedSigners] };
    },
    getDirectory(params = {}) {
      if (typeof params.department !== "string") throw new Error("Amway: department is required.");
      const atTime = Date.now();
      return {
        names: displayNames(params.department),
        assignments: [...state.directory.assignments.values()]
          .filter(entry => entry.department === params.department)
          .map(({ id, subject, role, issuer, validFrom, validUntil, revokedAt }) =>
            ({ id, subject, role, issuer, validFrom, validUntil, revokedAt })),
        contacts: [...state.phonebook.contacts.values()]
          .filter(entry => entry.department === params.department)
          .map(contact => ({
            ...contact,
            certified: [...state.phonebook.certified.values()]
              .filter(entry => entry.publishedContact === contact.id)
              .map(entry => ({ id: entry.id, current: state.phonebook.isCertified(entry.id, atTime) })),
          })),
      };
    },
    createInvite(params = {}) {
      if (typeof params.department !== "string") throw new Error("Amway: department is required.");
      if (typeof params.role !== "string") throw new Error("Amway: role is required.");
      if (typeof params.issuer !== "string" || !params.issuer) {
        throw new Error("Amway: the inviting manager is required.");
      }
      return state.invites.createInvite({
        issuer: params.issuer, department: params.department,
        role: params.role, label: params.label ?? null,
        pairing: params.pairing ?? null,
      });
    },
    listInvites(params = {}) {
      return { invites: state.invites.listInvites({ department: params.department }) };
    },
    acceptInvite(params = {}) {
      if (typeof params.invitationUrl !== "string") throw new Error("Amway: invitationUrl is required.");
      if (typeof params.person !== "string") throw new Error("Amway: person is required.");
      if (typeof params.name !== "string") throw new Error("Amway: name is required.");
      return state.invites.acceptInvite({
        invitationUrl: params.invitationUrl, person: params.person, name: params.name,
      });
    },
    pairingComplete(params = {}) {
      if (typeof params.token !== "string" && typeof params.invitationUrl !== "string") {
        throw new Error("Amway: pairing completion requires a token or invitationUrl.");
      }
      if (typeof params.person !== "string") throw new Error("Amway: person is required.");
      if (typeof params.name !== "string") throw new Error("Amway: name is required.");
      return state.invites.pairingComplete({
        token: params.token ?? null, invitationUrl: params.invitationUrl ?? null,
        person: params.person, name: params.name,
        topicId: params.topicId ?? null, remotePerson: params.remotePerson ?? null,
        pairingUrl: params.pairingUrl ?? null,
      });
    },
    publishDepartment(params = {}) {
      if (typeof params.department !== "string") throw new Error("Amway: department is required.");
      if (typeof params.issuer !== "string" || !params.issuer) {
        throw new Error("Amway: the publishing manager is required.");
      }
      registerAmwayRecipes();
      return publishDepartmentRoot({
        directory: state.directory, shop: state.shop, lifecycle: state.lifecycle,
        persistence: amwayPersistence, department: params.department, issuer: params.issuer,
        custodian: getInstanceOwnerIdHash(), exportedAt: Date.now(),
      });
    },
    revokeInvite(params = {}) {
      if (typeof params.token !== "string") throw new Error("Amway: token is required.");
      if (typeof params.issuer !== "string" || !params.issuer) {
        throw new Error("Amway: the revoking manager is required.");
      }
      return state.invites.revokeInvite({ issuer: params.issuer, token: params.token });
    },
    getContracts(params = {}) {
      if (typeof params.department !== "string") throw new Error("Amway: department is required.");
      return {
        names: displayNames(params.department),
        contracts: [...state.directory.contracts.values()]
          .filter(entry => entry.department === params.department)
          .map(({ id, holder, contact, purpose, validFrom, validUntil, revokedAt }) =>
            ({ id, holder, contact, purpose, validFrom, validUntil, revokedAt })),
      };
    },
    getCatalog() {
      return {
        items: [...state.shop.catalog.items.values()],
        priceLists: [...state.shop.catalog.priceLists.values()].map(list => ({
          id: list.id, version: list.version, currency: list.currency,
          prices: Object.fromEntries(Object.entries(list.prices).map(([item, price]) => [item, money(price)])),
        })),
        offers: [...state.shop.catalog.offers.values()].map(offer => ({
          ...offer, unitPrice: money(offer.unitPrice),
        })),
      };
    },
    getOrders(params = {}) {
      const txs = [...state.shop.transactions.values()]
        .filter(entry => !params.department || entry.department === params.department);
      return {
        names: params.department ? displayNames(params.department) : {},
        transactions: txs.map(tx => ({
          ...tx, total: money(tx.total),
          lines: tx.lines.map(line => ({ ...line, unitPrice: money(line.unitPrice) })),
          ledger: state.lifecycle.projection(tx.id),
        })),
        subscriptions: [...state.subscriptions.subscriptions.values()]
          .filter(entry => !params.department || entry.department === params.department),
        occurrences: [...state.subscriptions.occurrences.values()],
      };
    },
    getInventory(params = {}) {
      const reservations = [...state.lifecycle.reservations.values()]
        .filter(entry => !params.department || reservationDepartment(entry) === params.department);
      return { reservations };
    },
    getEarnings(params = {}) {
      const txs = [...state.shop.transactions.values()]
        .filter(entry => !params.department || entry.department === params.department);
      return {
        sales: txs.map(tx => {
          const ledger = state.lifecycle.projection(tx.id);
          return {
            transaction: tx.id, total: money(tx.total),
            recognized: money({ amount: ledger.recognized, currency: tx.total.currency }),
            receivable: money({ amount: ledger.receivable, currency: tx.total.currency }),
            cash: money({ amount: ledger.cash, currency: tx.total.currency }),
          };
        }),
        statements: [...state.reconciliation.statements.values()],
      };
    },
    getReturns() {
      return {
        cases: [...state.returns.cases.values()],
        corrections: state.returns.corrections,
      };
    },
    getJournal(params = {}) {
      ingestJournal();
      const names = {};
      const departments = params.department
        ? [params.department]
        : [...state.directory.departments.keys()];
      for (const department of departments) {
        Object.assign(names, displayNames(department));
      }
      const page = state.journal.read({
        department: params.department,
        type: params.type,
        limit: params.limit ?? 50,
        cursor: params.cursor ?? 0,
      });
      // Newest first, like the flexibel story journal: the read page is
      // oldest-first, so reverse it before handing semantic entries out.
      const occurrences = page.occurrences.reverse().map(entry => {
        if (typeof entry.amount !== "number") return entry;
        let currency = "EUR";
        const transaction = entry.transactionId ?? entry.transaction;
        if (transaction) {
          try {
            currency = state.shop.getTransaction(transaction).total.currency;
          } catch {
            currency = "EUR";
          }
        }
        return { ...entry, amountText: money({ amount: entry.amount, currency }) };
      });
      return { ...page, occurrences, names };
    },
    getStatus(params = {}) {
      ingestJournal();
      const status = {
        departments: state.directory.departments.size,
        transactions: state.shop.transactions.size,
        journalComplete: state.journal.completeness().complete,
        owner: getInstanceOwnerIdHash(),
        durable: false,
      };
      if (typeof params.department === "string" && state.directory.departments.has(params.department)) {
        status.summary = departmentSummary(params.department);
      }
      return status;
    },
  };

  const AMWAY_METHODS = [
    "getSession", "getScope", "selectDepartment", "getSettings", "updateSettings",
    "exportDepartment", "importDepartment", "loadDemo", "getTrustInfo",
    "trustSigner", "untrustSigner", "getDirectory", "getContracts", "getCatalog",
    "getOrders", "getInventory", "getEarnings", "getReturns", "getJournal",
    "createInvite", "listInvites", "acceptInvite", "pairingComplete", "revokeInvite", "publishDepartment", "getStatus",
  ];

  async function body(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (!String(req.headers["content-type"]).startsWith("application/json")) {
      throw new Error("JSON request required.");
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Request must be an object.");
    return value;
  }

  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(value));
    };
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    const port = server.address()?.port;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) {
      return send(403, { error: "Local host required." });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionCookie = `amway-session-${port}`;
    if (req.method === "POST" && (!url.pathname.startsWith("/api/") || req.headers.origin) && req.headers.origin !== `http://${req.headers.host}`) {
      return send(403, { error: "Same-origin request required." });
    }
    try {
      if (req.method === "GET" && (url.pathname === "/amway/" || url.pathname === "/amway")) {
        const html = await readFile(path.join(UI_DIR, "index.html"), "utf8");
        res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
        return res.end(html);
      }
      if (req.method === "GET" && (url.pathname === "/browser/" || url.pathname === "/browser")) {
        const html = await readFile(path.join(BROWSER_DIR, "index.html"), "utf8");
        res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
        return res.end(html);
      }
      if (req.method === "GET" && (url.pathname === "/browser/lab/" || url.pathname === "/browser/lab")) {
        const html = await readFile(path.join(BROWSER_DIR, "lab", "index.html"), "utf8");
        res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
        return res.end(html);
      }
      if (req.method === "GET" && url.pathname.startsWith("/browser/assets/")) {
        const file = path.join(BROWSER_DIR, "assets", path.basename(url.pathname));
        if (!file.startsWith(BROWSER_DIR)) return send(403, { error: "Not found." });
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
        return res.end(data);
      }
      if (req.method === "GET" && url.pathname.startsWith("/amway/ui/")) {
        const file = path.join(UI_DIR, path.basename(url.pathname));
        if (!file.startsWith(UI_DIR)) return send(403, { error: "Not found." });
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
        return res.end(data);
      }
      if (req.method === "GET" && url.pathname.startsWith("/amway/assets/")) {
        const file = path.join(ASSETS_DIR, path.basename(url.pathname));
        if (!file.startsWith(ASSETS_DIR)) return send(403, { error: "Not found." });
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": MIME[path.extname(file)] ?? "application/octet-stream" });
        return res.end(data);
      }
      if (req.method === "GET" && url.pathname === "/amway/i18n.js") {
        const data = await readFile(path.join(ROOT_DIR, "packages", "amway.app", "i18n.js"));
        res.writeHead(200, { "Content-Type": MIME[".js"] });
        return res.end(data);
      }
      if (req.method === "POST" && url.pathname === "/session") {
        if (opening || initialized) {
          const error = new Error("This workspace is already unlocked. Restart it to unlock another account.");
          error.code = "auth.locked";
          return send(409, { error: error.message, code: error.code });
        }
        const { email, password } = await body(req);
        if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || !password) {
          throw new Error("Email and password are required.");
        }
        opening = true;
        try {
          await initInstance({ name: "amway", email, secret: password, directory: instanceDir, encryptStorage: false, initialRecipes: [] });
          registerAmwayRecipes();
          initialized = true;
          state.unlockEmail = email;
          registry = new OperationRegistry();
          registry.register("amway", plan, {
            description: "Amway workspace: departments, shop, settings, data, and trust.",
            methods: AMWAY_METHODS.map(name => ({ name, description: `Amway ${name}` })),
          });
          registry.register("amwayAppBook", { getDefinition: () => structuredClone(AMWAY_APP_BOOK_CATALOG) }, {
            methods: [{ name: "getDefinition", description: "Amway application Book catalog" }],
          });
          session = randomBytes(32).toString("hex");
          res.setHeader("Set-Cookie", `${sessionCookie}=${session}; HttpOnly; SameSite=Strict; Path=/`);
          return send(200, { owner: getInstanceOwnerIdHash(), email });
        } catch (error) {
          closeInstance();
          initialized = false;
          registry = undefined;
          state.unlockEmail = "";
          throw error;
        } finally { opening = false; }
      }
      const cookie = String(req.headers.cookie || "").split("; ").find(value => value.startsWith(`${sessionCookie}=`))?.slice(sessionCookie.length + 1);
      if (!session || !cookie || cookie.length !== session.length || !timingSafeEqual(Buffer.from(cookie), Buffer.from(session))) {
        return send(401, { error: "Unlock your local Amway workspace first." });
      }
      if (req.method === "GET" && url.pathname === "/api") {
        return send(200, createPublicOperationCatalogPayload(registry));
      }
      const route = /^\/api\/([^/]+)\/([^/]+)$/.exec(url.pathname);
      if (req.method === "POST" && route && hasPublicOperationMethod(registry, route[1], route[2])) {
        // execute() already returns the {operation, product, ...} envelope.
        return send(200, await registry.execute(route[1], route[2], await body(req)));
      }
      return send(404, { error: "Operation not found." });
    } catch (error) {
      const value = { error: error.message };
      if (error.code) value.code = error.code;
      send(400, value);
    }
  });
  server.on("close", () => { if (initialized) { closeInstance(); initialized = false; } });
  return { server, state, getPlan: () => plan };
}

const startedAsScript = process.argv[1] === fileURLToPath(import.meta.url);
if (startedAsScript) {
  const instanceDir = process.env.AMWAY_STORAGE_DIR || path.join(homedir(), ".local", "share", "projektor", "amway");
  const port = Number(process.env.AMWAY_PORT ?? 4176);
  const { server } = createAmwayServer({ instanceDir });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Amway workspace on http://127.0.0.1:${port}/amway/`);
  });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    server.closeIdleConnections?.();
    server.close();
  });
}
