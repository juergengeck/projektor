// packages/amway.lab/lab.integration.test.js
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Worker } from "node:worker_threads";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startLabHost } from "./host-switch.js";

const KEYS = ["admin", "manager", "seller", "customer"];
let root;
let host;

function feedUntil(client, predicate, label) {
  return new Promise((resolve, reject) => {
    const guard = setTimeout(() => { off(); reject(new Error(`feed never delivered: ${label}`)); }, 30_000);
    const off = client.onFeed(row => {
      if (!predicate(row)) return;
      clearTimeout(guard);
      off();
      resolve(row);
    });
  });
}

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "amway-lab-"));
  host = await startLabHost({
    keys: KEYS,
    spawn: key => {
      const worker = new Worker(new URL("./test/node-worker.js", import.meta.url), { workerData: { key, directory: path.join(root, key) } });
      // node:worker_threads Worker is an EventEmitter without addEventListener
      // (verified on Node 23); present the browser Worker's port shape.
      const port = {
        postMessage: (message, transfer) => worker.postMessage(message, transfer),
        addEventListener: (_type, listener) => worker.on("message", data => listener({ data })),
        removeEventListener: () => { throw new Error("lab host never removes worker listeners"); },
        start() {},
        close() {},
      };
      return { port, terminate: () => worker.terminate(), onError: cb => worker.on("error", cb) };
    },
  });
  await host.pairAll();
  const { admin, manager } = host.clients;
  // Disclosure follows authority: the manager receives the department with
  // its own assignment; seller and customer only once the manager assigns them.
  const managerAppointed = feedUntil(manager, row => row.type === "AmwayRoleAssignment" && row.id === host.persons.manager, "manager receives appointment");
  await admin.call("amwayLab", "createDepartment", { department: "demo-de", name: "Demo DE" });
  await admin.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.manager, role: "manager" });
  await managerAppointed;
  const membersReached = ["seller", "customer"].map(key =>
    feedUntil(host.clients[key], row => row.type === "AmwayDepartment", `${key} receives department`));
  await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.seller, role: "seller" });
  await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.customer, role: "customer" });
  await Promise.all(membersReached);
}, { timeout: 120_000 });

after(async () => {
  await host?.stop();
  if (root) await rm(root, { recursive: true, force: true });
});

test("every worker is paired directly with every other", async () => {
  for (const key of KEYS) {
    const status = await host.clients[key].call("connection", "getStatus", {});
    assert.equal(status.totalConnections, KEYS.length - 1, `${key} connections`);
  }
});

test("an offer published by the manager arrives by CHUM at every member", async () => {
  const arrivals = ["admin", "seller", "customer"].map(key =>
    feedUntil(host.clients[key], row => row.type === "AmwayOffer" && row.id === "lab-offer-1", `${key} offer`));
  await host.clients.manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-1", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "every worker holds the exact same version");
  const seen = await host.clients.seller.call("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(seen.offers.some(entry => entry.offerId === "lab-offer-1"));
});

test("a seller cannot publish offers", async () => {
  await assert.rejects(
    host.clients.seller.call("amwayLab", "publishOffer", {
      department: "demo-de", offerId: "nope", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 1, currency: "EUR",
    }),
    /may not publish offer/,
  );
});

test("orders reach the customer they are for", async () => {
  // Runs after the offer test (node:test runs top-level tests in order), so
  // lab-offer-1 is already materialized on the seller.
  const toCustomer = feedUntil(host.clients.customer, row => row.type === "AmwayOrder" && row.id === "lab-order-t1", "customer order");
  await host.clients.seller.call("amwayLab", "admitOrder", {
    department: "demo-de", customer: host.persons.customer, offer: "lab-offer-1", quantity: 2, idempotencyKey: "lab-order-t1",
  });
  await toCustomer;
  const view = await host.clients.customer.call("amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(view.orders.map(entry => entry.idempotencyKey), ["lab-order-t1"]);
  assert.equal(view.availability.available, 8);
});

test("a customer self-purchase feeds the admitted order back to staff", async () => {
  const id = "lab-order-customer-feedback";
  const arrivals = ["admin", "manager", "seller"].map(key =>
    feedUntil(host.clients[key], row => row.type === "AmwayOrder" && row.id === id, `${key} receives customer purchase`));
  await host.clients.customer.call("amwayLab", "admitOrder", {
    department: "demo-de", customer: host.persons.customer, offer: "lab-offer-1", quantity: 1, idempotencyKey: id,
  });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "staff receives the exact admitted version");
  const manager = await host.clients.manager.call("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(manager.orders.some(entry => entry.idempotencyKey === id));
  assert.equal(manager.availability.available, 7);
});

test("a paused worker catches up after resume", async () => {
  await host.clients.customer.call("amwayLab", "setOnline", { online: false });
  host.setSwitch("customer", false);
  await host.clients.manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-2", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const before = await host.clients.customer.call("amwayLab", "getDepartment", { department: "demo-de" });
  assert.equal(before.offers.some(entry => entry.offerId === "lab-offer-2"), false);
  const caughtUp = feedUntil(host.clients.customer, row => row.type === "AmwayOffer" && row.id === "lab-offer-2", "customer catch-up");
  host.setSwitch("customer", true);
  await host.clients.customer.call("amwayLab", "setOnline", { online: true });
  await caughtUp;
});
