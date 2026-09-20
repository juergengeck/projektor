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
  const sellerAppointed = feedUntil(clients().seller, row => row.type === "AmwayRoleAssignment" && row.id === persons().seller, "seller receives appointment");
  await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: persons().seller, role: "seller" });
  // Appointment chain: customers are appointed by the seller, not the manager.
  await sellerAppointed;
  await clients().seller.call("amwayLab", "assignRole", { department: "demo-de", subject: persons().customer, role: "customer" });
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

test("purchasing stocks the facility before anything is sold", async () => {
  // No opening stock exists: the manager cannot show inventory the org
  // never purchased. The admin (purchasing) receives the first goods.
  await clients().admin.call("amwayLab", "stockUp", { department: "demo-de", receiptId: "lab-stock-opening", quantity: 20 });
  type Balance = DepartmentView & { availability: { stocked: number; available: number } };
  const adminView = await clients().admin.call<Balance>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.equal(adminView.availability.stocked, 20);
  assert.equal(adminView.availability.available, 20);
});

test("a published offer reaches sellers through their manager, never customers", async () => {
  const arrivals = ["admin", "seller"].map(key =>
    feedUntil(clients()[key], row => row.type === "AmwayOffer" && row.id === "lab-offer-1", `${key} offer`));
  await clients().manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-1", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "staff hold the exact same version");
  const seen = await clients().seller.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(seen.offers.some(entry => entry.offerId === "lab-offer-1"));
  // The offer lane to the seller is proven above; disclose nothing further
  // and the customer must still be empty — publishing skips no level.
  await new Promise(resolve => setTimeout(resolve, 2000));
  const unshared = await clients().customer.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(unshared.offers, [], "publishing alone shares nothing with customers");
});

test("inventory reaches the customer only through the seller", async () => {
  await assert.rejects(
    clients().manager.call("amwayLab", "shareOffer", { department: "demo-de", offerId: "lab-offer-1", customer: persons().customer }),
    /only the seller may share offers/,
  );
  const shared = feedUntil(clients().customer, row => row.type === "AmwayOffer" && row.id === "lab-offer-1", "customer receives shared offer");
  await clients().seller.call("amwayLab", "shareOffer", { department: "demo-de", offerId: "lab-offer-1", customer: persons().customer });
  await shared;
  const view = await clients().customer.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(view.offers.some(entry => entry.offerId === "lab-offer-1"));
});

test("customers are appointed by the seller, not the manager", async () => {
  const stranger = "f".repeat(64);
  await assert.rejects(
    clients().manager.call("amwayLab", "assignRole", { department: "demo-de", subject: stranger, role: "customer" }),
    /only the seller may appoint customers/,
  );
  await assert.rejects(
    clients().seller.call("amwayLab", "assignRole", { department: "demo-de", subject: stranger, role: "manager" }),
    /only the department admin may appoint managers/,
  );
  await assert.rejects(
    clients().seller.call("amwayLab", "assignRole", { department: "demo-de", subject: stranger, role: "seller" }),
    /only the department admin or a manager may appoint sellers/,
  );
  await clients().seller.call("amwayLab", "assignRole", { department: "demo-de", subject: stranger, role: "customer" });
});

test("republishing a contact edits its name", async () => {
  const seller = persons().seller;
  await clients().seller.call("amwayLab", "publishContact", {
    department: "demo-de", name: "Seller One", role: "seller",
  });
  const renamed = feedUntil(clients().manager, row =>
    row.type === "AmwayContact" && row.obj?.name === "Seller Renamed", "manager sees renamed contact");
  await clients().seller.call("amwayLab", "publishContact", {
    department: "demo-de", name: "Seller Renamed", role: "seller",
  });
  await renamed;
  const seen = await clients().seller.call<DepartmentView & { contacts: { person: string; name: string }[] }>(
    "amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(
    seen.contacts.filter(entry => entry.person === seller).map(entry => entry.name),
    ["Seller Renamed"],
    "exactly one contact row carries the edited name",
  );
});

test("a seller cannot publish offers", async () => {
  await assert.rejects(
    clients().seller.call("amwayLab", "publishOffer", {
      department: "demo-de", offerId: "nope", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 1, currency: "EUR",
    }),
    /may not publish offer/,
  );
});

test("a purchase exists only after the customer places and the seller admits", async () => {
  // Runs after the offer test (node:test runs top-level tests in order), so
  // lab-offer-1 is already materialized on seller and customer.
  const toSeller = feedUntil(clients().seller, row => row.type === "AmwayOrder" && row.id === "lab-order-t1", "seller sees placement");
  await clients().customer.call("amwayLab", "placeOrder", {
    department: "demo-de", offer: "lab-offer-1", quantity: 2, idempotencyKey: "lab-order-t1",
  });
  await toSeller;
  const placed = await clients().customer.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(placed.orders, [], "placing alone buys nothing");
  assert.deepEqual(placed.pendingOrders.map(entry => entry.idempotencyKey), ["lab-order-t1"]);
  const sellerView = await clients().seller.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(sellerView.pendingOrders.map(entry => entry.idempotencyKey), ["lab-order-t1"], "the seller sees what to admit");
  const toCustomer = feedUntil(clients().customer, admittedRow("lab-order-t1"), "customer order");
  await clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: "lab-order-t1" });
  await toCustomer;
  const view = await clients().customer.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(view.orders.map(entry => entry.idempotencyKey), ["lab-order-t1"]);
  assert.deepEqual(view.pendingOrders, [], "admitting clears the pending order");
  // 20 purchased − 2 admitted here.
  assert.equal(view.availability.available, 18);
});

test("a seller cannot admit an order nobody placed", async () => {
  await assert.rejects(
    clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: "lab-order-ghost" }),
    /never placed by a customer/,
  );
  const view = await clients().seller.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(!view.orders.some(entry => entry.idempotencyKey === "lab-order-ghost"), "no purchase appears");
});

test("only a customer may place an order", async () => {
  await assert.rejects(
    clients().seller.call("amwayLab", "placeOrder", { department: "demo-de", offer: "lab-offer-1", quantity: 1 }),
    /only a customer may place an order/,
  );
});

test("admitting twice fails", async () => {
  await clients().customer.call("amwayLab", "placeOrder", {
    department: "demo-de", offer: "lab-offer-1", quantity: 1, idempotencyKey: "lab-order-once",
  });
  await feedUntil(clients().seller, row => row.type === "AmwayOrder" && row.id === "lab-order-once", "seller sees placement");
  await clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: "lab-order-once" });
  await assert.rejects(
    clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: "lab-order-once" }),
    /already admitted/,
  );
});

const admittedRow = (id: string) => (row: FeedRow): boolean =>
  row.type === "AmwayOrder" && row.id === id && (row.obj?.admittedAt as number) > 0;

test("a customer self-purchase feeds the admitted order back to staff", async () => {
  const id = "lab-order-customer-feedback";
  const arrivals = ["admin", "manager", "seller"].map(key =>
    feedUntil(clients()[key], admittedRow(id), `${key} receives customer purchase`));
  await clients().customer.call("amwayLab", "placeOrder", {
    department: "demo-de", offer: "lab-offer-1", quantity: 1, idempotencyKey: id,
  });
  await feedUntil(clients().seller, row => row.type === "AmwayOrder" && row.id === id, "seller sees placement");
  await clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: id });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "staff receives the exact admitted version");
  // The manager settles against every earlier purchase too: poll until the
  // previously admitted order is projected there before asserting the balance.
  const onceDeadline = Date.now() + 30_000;
  for (;;) {
    const probe = await clients().manager.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
    if (probe.orders.some(entry => entry.idempotencyKey === "lab-order-once")) break;
    if (Date.now() > onceDeadline) throw new Error("manager never projected admitted once");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  const manager = await clients().manager.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(manager.orders.some(entry => entry.idempotencyKey === id));
  // 20 purchased − lab-order-t1 (2) − lab-order-once (1) − 1 here.
  assert.equal(manager.availability.available, 16);
});

test("admitting more than the shared balance fails", async () => {
  // 20 purchased − 4 settled (t1, once, self-purchase), so 16 are available:
  // a 17-unit purchase never settles.
  await clients().customer.call("amwayLab", "placeOrder", {
    department: "demo-de", offer: "lab-offer-1", quantity: 17, idempotencyKey: "lab-order-oversell",
  });
  await feedUntil(clients().seller, row => row.type === "AmwayOrder" && row.id === "lab-order-oversell", "seller sees oversell placement");
  await assert.rejects(
    clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: "lab-order-oversell" }),
    /wants 17 units but only 16 are available/,
  );
});

test("only purchasing stocks up, and stocking funds later purchases", async () => {
  await assert.rejects(
    clients().seller.call("amwayLab", "stockUp", { department: "demo-de", receiptId: "lab-stock-no", quantity: 5 }),
    /only the department admin \(purchasing\) may stock up/,
  );
  await clients().admin.call("amwayLab", "stockUp", { department: "demo-de", receiptId: "lab-stock-1", quantity: 20 });
  // Re-recording the same receipt replaces it instead of counting twice.
  await clients().admin.call("amwayLab", "stockUp", { department: "demo-de", receiptId: "lab-stock-1", quantity: 20 });
  const receiptArrived = (row: FeedRow): boolean => row.type === "AmwayStockReceipt" && row.id === "lab-stock-1";
  await feedUntil(clients().customer, receiptArrived, "customer receives receipt");
  await feedUntil(clients().seller, receiptArrived, "seller receives receipt");
  type Balance = DepartmentView & {
    orders: { idempotencyKey: string; quantity: number }[];
    availability: { stocked: number; available: number };
  };
  const customerView = await clients().customer.call<Balance>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.equal(customerView.availability.stocked, 40, "receipts reach every member's balance");
  const sellerView = await clients().seller.call<Balance>("amwayLab", "getDepartment", { department: "demo-de" });
  const settled = sellerView.orders.reduce((sum, entry) => sum + entry.quantity, 0);
  assert.equal(sellerView.availability.available, 40 - settled);
  // The previously impossible purchase now settles against the restocked balance.
  await clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: "lab-order-oversell" });
  const after = await clients().seller.call<Balance>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(after.orders.some(entry => entry.idempotencyKey === "lab-order-oversell"));
  assert.equal(after.availability.available, 40 - settled - 17);
});

test("admission accrues receivables and payables per role", async () => {
  type Money = DepartmentView & {
    orders: { idempotencyKey: string; quantity: number; unitAmount: number }[];
    balances: { party: string; role: string; receivable: number; payable: number; currency: string }[];
  };
  // Every admitted order so far settled lab-offer-1 at 100.00€.
  const sellerView = await clients().seller.call<Money>("amwayLab", "getDepartment", { department: "demo-de" });
  const expected = sellerView.orders.reduce((sum, entry) => sum + entry.quantity * entry.unitAmount, 0);
  assert.ok(expected > 0, "purchases settled before");
  const row = (party: string) => sellerView.balances.find(entry => entry.party === party);
  assert.deepEqual(row(persons().customer),
    { party: persons().customer, role: "customer", receivable: 0, payable: expected, currency: "EUR" });
  assert.deepEqual(row(persons().seller),
    { party: persons().seller, role: "seller", receivable: expected, payable: expected, currency: "EUR" });
  const customerView = await clients().customer.call<Money>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(customerView.balances.map(entry => entry.party), [persons().customer], "customers see only their own row");
});

test("admission settles the placement price, not a later offer price", async () => {
  type Money = DepartmentView & {
    orders: { idempotencyKey: string; quantity: number; unitAmount: number }[];
    balances: { party: string; role: string; receivable: number; payable: number; currency: string }[];
  };
  const id = "lab-order-reprice";
  await clients().customer.call("amwayLab", "placeOrder", {
    department: "demo-de", offer: "lab-offer-1", quantity: 1, idempotencyKey: id,
  });
  await feedUntil(clients().seller, row => row.type === "AmwayOrder" && row.id === id, "seller sees placement");
  // The offer doubles after placement: admission still settles 100.00€.
  await clients().manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-1", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 20000, currency: "EUR",
  });
  await clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: id });
  const sellerView = await clients().seller.call<Money>("amwayLab", "getDepartment", { department: "demo-de" });
  const settled = sellerView.orders.find(entry => entry.idempotencyKey === id);
  assert.equal(settled?.unitAmount, 10000, "the admitted order carries the placement price");
  const customerRow = sellerView.balances.find(entry => entry.party === persons().customer);
  const expected = sellerView.orders.reduce((sum, entry) => sum + entry.quantity * entry.unitAmount, 0);
  assert.equal(customerRow?.payable, expected, "the balance settles the placement price");
});

test("a paused worker catches up after resume", async () => {
  await clients().customer.call("amwayLab", "setOnline", { online: false });
  host?.setSwitch("customer", false);
  await clients().manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-2", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const before = await clients().customer.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.equal(before.offers.some(entry => entry.offerId === "lab-offer-2"), false);
  host?.setSwitch("customer", true);
  await clients().customer.call("amwayLab", "setOnline", { online: true });
  // Resuming does not broadcast inventory either: it still flows only
  // through the seller.
  await new Promise(resolve => setTimeout(resolve, 2000));
  const unshared = await clients().customer.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
  assert.equal(unshared.offers.some(entry => entry.offerId === "lab-offer-2"), false);
  const caughtUp = feedUntil(clients().customer, row => row.type === "AmwayOffer" && row.id === "lab-offer-2", "customer catch-up");
  await clients().seller.call("amwayLab", "shareOffer", { department: "demo-de", offerId: "lab-offer-2", customer: persons().customer });
  await caughtUp;
});

test("persisted workers feed an admitted purchase back after restart", async () => {
  await host.stop();
  host = await startLabHost({ keys: KEYS, spawn: spawnWorker });
  const restored = await Promise.all(KEYS.map(key => clients()[key].call<ConnectionStatus>("connection", "getStatus", {})));
  assert.deepEqual(restored.map(status => status.totalConnections), [3, 3, 3, 3], "persisted mesh is connected");
  const id = "lab-order-after-restart";
  const arrivals = ["admin", "manager", "seller"].map(key =>
    feedUntil(clients()[key], admittedRow(id), `${key} receives post-restart purchase`));
  await clients().customer.call("amwayLab", "placeOrder", {
    department: "demo-de", offer: "lab-offer-1", quantity: 1, idempotencyKey: id,
  });
  await feedUntil(clients().seller, row => row.type === "AmwayOrder" && row.id === id, "seller sees placement");
  await clients().seller.call("amwayLab", "admitOrder", { department: "demo-de", idempotencyKey: id });
  await Promise.all(arrivals);
  // A restarted worker may briefly skip rows whose version head is not yet
  // readable: poll until every settled purchase is projected, then the
  // balance (40 stocked − 23 admitted) must agree.
  const settledIds = ["lab-order-t1", "lab-order-once", "lab-order-customer-feedback", "lab-order-oversell", "lab-order-reprice", id];
  const deadline = Date.now() + 30_000;
  for (;;) {
    const manager = await clients().manager.call<DepartmentView>("amwayLab", "getDepartment", { department: "demo-de" });
    if (settledIds.every(wanted => manager.orders.some(entry => entry.idempotencyKey === wanted))) {
      assert.equal(manager.availability.available, 17);
      break;
    }
    if (Date.now() > deadline) throw new Error("manager never projected every settled purchase after restart");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
});
