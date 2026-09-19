// packages/ek.lab/lab.integration.test.ts
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
  pendingOrders: { idempotencyKey: string; offer: string; quantity: number }[];
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
  root = await mkdtemp(path.join(tmpdir(), "ek-lab-"));
  host = await startLabHost({
    keys: KEYS,
    spawn: spawnWorker,
  });
  await host?.pairAll();
  const { admin, manager } = clients();
  // Disclosure follows authority: the manager receives the department with
  // its own assignment; seller and customer only once the manager assigns them.
  const managerAppointed = feedUntil(manager, row => row.type === "EkRoleAssignment" && row.id === persons().manager, "manager receives appointment");
  await admin.call("ekLab", "createDepartment", { department: "ek-de", name: "Demo DE" });
  await admin.call("ekLab", "assignRole", { department: "ek-de", subject: persons().manager, role: "manager" });
  await managerAppointed;
  const membersReached = ["seller", "customer"].map(key =>
    feedUntil(clients()[key], row => row.type === "EkDepartment", `${key} receives department`));
  const sellerAppointed = feedUntil(clients().seller, row => row.type === "EkRoleAssignment" && row.id === persons().seller, "seller receives appointment");
  await manager.call("ekLab", "assignRole", { department: "ek-de", subject: persons().seller, role: "seller" });
  // Appointment chain: customers are appointed by the seller, not the manager.
  await sellerAppointed;
  await clients().seller.call("ekLab", "assignRole", { department: "ek-de", subject: persons().customer, role: "customer" });
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

test("a published offer reaches sellers through their manager, never customers", async () => {
  const arrivals = ["admin", "seller"].map(key =>
    feedUntil(clients()[key], row => row.type === "EkOffer" && row.id === "ek-offer-1", `${key} offer`));
  await clients().manager.call("ekLab", "publishOffer", {
    department: "ek-de", offerId: "ek-offer-1", item: "BMA-WARTUNG@1", priceList: "ek-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "staff hold the exact same version");
  const seen = await clients().seller.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.ok(seen.offers.some(entry => entry.offerId === "ek-offer-1"));
  // The offer lane to the seller is proven above; disclose nothing further
  // and the customer must still be empty — publishing skips no level.
  await new Promise(resolve => setTimeout(resolve, 2000));
  const unshared = await clients().customer.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.deepEqual(unshared.offers, [], "publishing alone shares nothing with customers");
});

test("inventory reaches the customer only through the seller", async () => {
  await assert.rejects(
    clients().manager.call("ekLab", "shareOffer", { department: "ek-de", offerId: "ek-offer-1", customer: persons().customer }),
    /only the seller may share offers/,
  );
  const shared = feedUntil(clients().customer, row => row.type === "EkOffer" && row.id === "ek-offer-1", "customer receives shared offer");
  await clients().seller.call("ekLab", "shareOffer", { department: "ek-de", offerId: "ek-offer-1", customer: persons().customer });
  await shared;
  const view = await clients().customer.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.ok(view.offers.some(entry => entry.offerId === "ek-offer-1"));
});

test("customers are appointed by the seller, not the manager", async () => {
  const stranger = "f".repeat(64);
  await assert.rejects(
    clients().manager.call("ekLab", "assignRole", { department: "ek-de", subject: stranger, role: "customer" }),
    /only the seller may appoint customers/,
  );
  await assert.rejects(
    clients().seller.call("ekLab", "assignRole", { department: "ek-de", subject: stranger, role: "manager" }),
    /only the department admin may appoint managers/,
  );
  await assert.rejects(
    clients().seller.call("ekLab", "assignRole", { department: "ek-de", subject: stranger, role: "seller" }),
    /only the department admin or a manager may appoint sellers/,
  );
  await clients().seller.call("ekLab", "assignRole", { department: "ek-de", subject: stranger, role: "customer" });
});

test("a seller cannot publish offers", async () => {
  await assert.rejects(
    clients().seller.call("ekLab", "publishOffer", {
      department: "ek-de", offerId: "nope", item: "BMA-WARTUNG@1", priceList: "ek-retail@2026-09", unitAmount: 1, currency: "EUR",
    }),
    /may not publish offer/,
  );
});

test("a purchase exists only after the customer places and the seller admits", async () => {
  // Runs after the offer test (node:test runs top-level tests in order), so
  // ek-offer-1 is already materialized on seller and customer.
  const toSeller = feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === "ek-order-t1", "seller sees placement");
  await clients().customer.call("ekLab", "placeOrder", {
    department: "ek-de", offer: "ek-offer-1", quantity: 2, idempotencyKey: "ek-order-t1",
  });
  await toSeller;
  const placed = await clients().customer.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.deepEqual(placed.orders, [], "placing alone buys nothing");
  assert.deepEqual(placed.pendingOrders.map(entry => entry.idempotencyKey), ["ek-order-t1"]);
  const sellerView = await clients().seller.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.deepEqual(sellerView.pendingOrders.map(entry => entry.idempotencyKey), ["ek-order-t1"], "the seller sees what to admit");
  const toCustomer = feedUntil(clients().customer, admittedRow("ek-order-t1"), "customer order");
  await clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-t1" });
  await toCustomer;
  const view = await clients().customer.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.deepEqual(view.orders.map(entry => entry.idempotencyKey), ["ek-order-t1"]);
  assert.deepEqual(view.pendingOrders, [], "admitting clears the pending order");
  assert.equal(view.availability.available, 8);
});

test("a seller cannot admit an order nobody placed", async () => {
  await assert.rejects(
    clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-ghost" }),
    /never placed by a customer/,
  );
  const view = await clients().seller.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.ok(!view.orders.some(entry => entry.idempotencyKey === "ek-order-ghost"), "no purchase appears");
});

test("only a customer may place an order", async () => {
  await assert.rejects(
    clients().seller.call("ekLab", "placeOrder", { department: "ek-de", offer: "ek-offer-1", quantity: 1 }),
    /only a customer may place an order/,
  );
});

test("admitting twice fails", async () => {
  await clients().customer.call("ekLab", "placeOrder", {
    department: "ek-de", offer: "ek-offer-1", quantity: 1, idempotencyKey: "ek-order-once",
  });
  await feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === "ek-order-once", "seller sees placement");
  await clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-once" });
  await assert.rejects(
    clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-once" }),
    /already admitted/,
  );
});

const admittedRow = (id: string) => (row: FeedRow): boolean =>
  row.type === "EkOrder" && row.id === id && (row.obj?.admittedAt as number) > 0;

test("a customer self-purchase feeds the admitted order back to staff", async () => {
  const id = "ek-order-customer-feedback";
  const arrivals = ["admin", "manager", "seller"].map(key =>
    feedUntil(clients()[key], admittedRow(id), `${key} receives customer purchase`));
  await clients().customer.call("ekLab", "placeOrder", {
    department: "ek-de", offer: "ek-offer-1", quantity: 1, idempotencyKey: id,
  });
  await feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === id, "seller sees placement");
  await clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: id });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "staff receives the exact admitted version");
  // The manager settles against every earlier purchase too: poll until the
  // previously admitted order is projected there before asserting the balance.
  const onceDeadline = Date.now() + 30_000;
  for (;;) {
    const probe = await clients().manager.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
    if (probe.orders.some(entry => entry.idempotencyKey === "ek-order-once")) break;
    if (Date.now() > onceDeadline) throw new Error("manager never projected admitted once");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const manager = await clients().manager.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.ok(manager.orders.some(entry => entry.idempotencyKey === id));
  assert.equal(manager.availability.available, 6);
});

test("admitting more than the shared balance fails", async () => {
  // ek-order-t1 (2) + ek-order-once (1) + the self-purchase (1) settled
  // before, so 6 are available: an 11-unit purchase never settles.
  await clients().customer.call("ekLab", "placeOrder", {
    department: "ek-de", offer: "ek-offer-1", quantity: 11, idempotencyKey: "ek-order-oversell",
  });
  await feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === "ek-order-oversell", "seller sees oversell placement");
  await assert.rejects(
    clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-oversell" }),
    /wants 11 units but only 6 are available/,
  );
});

test("only purchasing stocks up, and stocking funds later purchases", async () => {
  await assert.rejects(
    clients().seller.call("ekLab", "stockUp", { department: "ek-de", receiptId: "ek-stock-no", quantity: 5 }),
    /only the department admin \(purchasing\) may stock up/,
  );
  await clients().admin.call("ekLab", "stockUp", { department: "ek-de", receiptId: "ek-stock-1", quantity: 20 });
  // Re-recording the same receipt replaces it instead of counting twice.
  await clients().admin.call("ekLab", "stockUp", { department: "ek-de", receiptId: "ek-stock-1", quantity: 20 });
  const receiptArrived = (row: FeedRow): boolean => row.type === "EkStockReceipt" && row.id === "ek-stock-1";
  await feedUntil(clients().customer, receiptArrived, "customer receives receipt");
  await feedUntil(clients().seller, receiptArrived, "seller receives receipt");
  type Balance = DepartmentView & {
    orders: { idempotencyKey: string; quantity: number }[];
    availability: { stocked: number; available: number };
  };
  const customerView = await clients().customer.call<Balance>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(customerView.availability.stocked, 30, "receipts reach every member's balance");
  const sellerView = await clients().seller.call<Balance>("ekLab", "getDepartment", { department: "ek-de" });
  const settled = sellerView.orders.reduce((sum, entry) => sum + entry.quantity, 0);
  assert.equal(sellerView.availability.available, 30 - settled);
  // The previously impossible purchase now settles against the restocked balance.
  await clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-oversell" });
  const after = await clients().seller.call<Balance>("ekLab", "getDepartment", { department: "ek-de" });
  assert.ok(after.orders.some(entry => entry.idempotencyKey === "ek-order-oversell"));
  assert.equal(after.availability.available, 30 - settled - 11);
});

test("a paused worker catches up after resume", async () => {
  await clients().customer.call("ekLab", "setOnline", { online: false });
  host?.setSwitch("customer", false);
  await clients().manager.call("ekLab", "publishOffer", {
    department: "ek-de", offerId: "ek-offer-2", item: "BMA-WARTUNG@1", priceList: "ek-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const before = await clients().customer.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(before.offers.some(entry => entry.offerId === "ek-offer-2"), false);
  host?.setSwitch("customer", true);
  await clients().customer.call("ekLab", "setOnline", { online: true });
  // Resuming does not broadcast inventory either: it still flows only
  // through the seller.
  await new Promise(resolve => setTimeout(resolve, 2000));
  const unshared = await clients().customer.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(unshared.offers.some(entry => entry.offerId === "ek-offer-2"), false);
  const caughtUp = feedUntil(clients().customer, row => row.type === "EkOffer" && row.id === "ek-offer-2", "customer catch-up");
  await clients().seller.call("ekLab", "shareOffer", { department: "ek-de", offerId: "ek-offer-2", customer: persons().customer });
  await caughtUp;
});

test("persisted workers feed an admitted purchase back after restart", async () => {
  await host.stop();
  host = await startLabHost({ keys: KEYS, spawn: spawnWorker });
  const restored = await Promise.all(KEYS.map(key => clients()[key].call<ConnectionStatus>("connection", "getStatus", {})));
  assert.deepEqual(restored.map(status => status.totalConnections), [3, 3, 3, 3], "persisted mesh is connected");
  const id = "ek-order-after-restart";
  const arrivals = ["admin", "manager", "seller"].map(key =>
    feedUntil(clients()[key], admittedRow(id), `${key} receives post-restart purchase`));
  await clients().customer.call("ekLab", "placeOrder", {
    department: "ek-de", offer: "ek-offer-1", quantity: 1, idempotencyKey: id,
  });
  await feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === id, "seller sees placement");
  await clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: id });
  await Promise.all(arrivals);
  // A restarted worker may briefly skip rows whose version head is not yet
  // readable: poll until every settled purchase is projected, then the
  // balance (10 opening + 20 stocked − 16 admitted) must agree.
  const settledIds = ["ek-order-t1", "ek-order-once", "ek-order-customer-feedback", "ek-order-oversell", id];
  const deadline = Date.now() + 30_000;
  for (;;) {
    const manager = await clients().manager.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
    if (settledIds.every(wanted => manager.orders.some(entry => entry.idempotencyKey === wanted))) {
      assert.equal(manager.availability.available, 14);
      break;
    }
    if (Date.now() > deadline) throw new Error("manager never projected every settled purchase after restart");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
});
