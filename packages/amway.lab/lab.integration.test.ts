// packages/amway.lab/lab.integration.test.ts
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Worker } from "node:worker_threads";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startLabHost } from "./host-switch.ts";
import type { LabHost } from "./host-switch.ts";
import type { FeedRow, PortApiClient } from "./port-ipc.ts";

const KEYS = ["admin", "manager", "seller", "customer"];
let root = "";
let host: LabHost | undefined;

interface ConnectionStatus {
  totalConnections: number;
}

interface DepartmentView {
  orders: { idempotencyKey: string }[];
  offers: { offerId: string }[];
  availability: { available: number };
}

function spawnWorker(key: string) {
  const worker = new Worker(new URL("./test/node-worker.ts", import.meta.url), { workerData: { key, directory: path.join(root, key) } });
  // node:worker_threads Worker is an EventEmitter without addEventListener
  // (verified on Node 23); present the browser Worker's port shape.
  const port = {
    postMessage: (message: unknown, transfer?: unknown[]) => worker.postMessage(message, transfer as []),
    addEventListener: (_type: string, listener: (event: { data: unknown }) => void) => worker.on("message", data => listener({ data })),
    removeEventListener: () => { throw new Error("lab host never removes worker listeners"); },
    start() {},
    close() {},
  };
  return { port, terminate: () => worker.terminate(), onError: (cb: (error: Error) => void) => worker.on("error", cb) };
}

function feedUntil(client: PortApiClient, predicate: (row: FeedRow) => boolean, label: string): Promise<FeedRow> {
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

function clients(): Record<string, PortApiClient> {
  if (!host) throw new Error("lab host is not running");
  return host.clients;
}

function persons(): Record<string, string> {
  if (!host) throw new Error("lab host is not running");
  return host.persons;
}

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "amway-lab-"));
  host = await startLabHost({
    keys: KEYS,
    spawn: spawnWorker,
  });
  await host?.pairAll();
  const { admin, manager } = clients();
  // Disclosure follows authority: the manager receives the department with
  // its own assignment; seller and customer only once the manager assigns them.
  const managerAppointed = feedUntil(manager, row => row.type === "AmwayRoleAssignment" && row.id === persons().manager, "manager receives appointment");
  await admin.call("amwayLab", "createDepartment", { department: "demo-de", name: "Demo DE" });
  await admin.call("amwayLab", "assignRole", { department: "demo-de", subject: persons().manager, role: "manager" });
  await managerAppointed;
  const membersReached = ["seller", "customer"].map(key =>
    feedUntil(clients()[key], row => row.type === "AmwayDepartment", `${key} receives department`));
  await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: persons().seller, role: "seller" });
  await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: persons().customer, role: "customer" });
  await Promise.all(membersReached);
}, { timeout: 120_000 });

after(async () => {
  await host?.stop();
  if (root) await rm(root, { recursive: true, force: true });
});

test("every worker is paired directly with every other", async () => {
  for (const key of KEYS) {
    const status = await clients()[key].call<ConnectionStatus>("connection", "getStatus", {});
    assert.equal(status.totalConnections, KEYS.length - 1, `${key} connections`);
  }
});

test("an offer published by the manager arrives by CHUM at every member", async () => {
  const arrivals = ["admin", "seller", "customer"].map(key =>
    feedUntil(clients()[key], row => row.type === "AmwayOffer" && row.id === "lab-offer-1", `${key} offer`));
  await clients().manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-1", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "every worker holds the exact same version");
  const seen = await clients().seller.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(seen.offers.some(entry => entry.offerId === "lab-offer-1"));
});

test("a seller cannot publish offers", async () => {
  await assert.rejects(
    clients().seller.call("amwayLab", "publishOffer", {
      department: "demo-de", offerId: "nope", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 1, currency: "EUR",
    }),
    /may not publish offer/,
  );
});

test("orders reach the customer they are for", async () => {
  // Runs after the offer test (node:test runs top-level tests in order), so
  // lab-offer-1 is already materialized on the seller.
  const toCustomer = feedUntil(clients().customer, row => row.type === "AmwayOrder" && row.id === "lab-order-t1", "customer order");
  await clients().seller.call("amwayLab", "admitOrder", {
    department: "demo-de", customer: persons().customer, offer: "lab-offer-1", quantity: 2, idempotencyKey: "lab-order-t1",
  });
  await toCustomer;
  const view = await clients().customer.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(view.orders.map(entry => entry.idempotencyKey), ["lab-order-t1"]);
  assert.equal(view.availability.available, 8);
});

test("a customer self-purchase feeds the admitted order back to staff", async () => {
  const id = "lab-order-customer-feedback";
  const arrivals = ["admin", "manager", "seller"].map(key =>
    feedUntil(clients()[key], row => row.type === "AmwayOrder" && row.id === id, `${key} receives customer purchase`));
  await clients().customer.call("amwayLab", "admitOrder", {
    department: "demo-de", customer: persons().customer, offer: "lab-offer-1", quantity: 1, idempotencyKey: id,
  });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "staff receives the exact admitted version");
  const manager = await clients().manager.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(manager.orders.some(entry => entry.idempotencyKey === id));
  assert.equal(manager.availability.available, 7);
});

test("a paused worker catches up after resume", async () => {
  await clients().customer.call("amwayLab", "setOnline", { online: false });
  host?.setSwitch("customer", false);
  await clients().manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-2", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const before = await clients().customer.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.equal(before.offers.some(entry => entry.offerId === "lab-offer-2"), false);
  const caughtUp = feedUntil(clients().customer, row => row.type === "AmwayOffer" && row.id === "lab-offer-2", "customer catch-up");
  host?.setSwitch("customer", true);
  await clients().customer.call("amwayLab", "setOnline", { online: true });
  await caughtUp;
});

test("persisted workers feed an admitted purchase back after restart", async () => {
  await host.stop();
  host = await startLabHost({ keys: KEYS, spawn: spawnWorker });
  const restored = await Promise.all(KEYS.map(key => clients()[key].call<ConnectionStatus>("connection", "getStatus", {})));
  assert.deepEqual(restored.map(status => status.totalConnections), [3, 3, 3, 3], "persisted mesh is connected");
  const id = "lab-order-after-restart";
  const arrivals = ["admin", "manager", "seller"].map(key =>
    feedUntil(clients()[key], row => row.type === "AmwayOrder" && row.id === id, `${key} receives post-restart purchase`));
  await clients().customer.call("amwayLab", "admitOrder", {
    department: "demo-de", customer: persons().customer, offer: "lab-offer-1", quantity: 1, idempotencyKey: id,
  });
  await Promise.all(arrivals);
  const manager = await clients().manager.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.equal(manager.availability.available, 6);
});
