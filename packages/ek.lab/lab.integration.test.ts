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
  availability: { stocked: number; available: number } | null;
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

test("purchasing stocks the facility before anything is sold", async () => {
  // No opening stock exists: the manager cannot show inventory the org
  // never purchased. The admin (purchasing) receives the first goods.
  await clients().admin.call("ekLab", "stockUp", { department: "ek-de", receiptId: "ek-stock-opening", quantity: 20 });
  const adminView = await clients().admin.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(adminView.availability?.stocked, 20);
  assert.equal(adminView.availability?.available, 20);
  const customerOpening = await clients().customer.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(customerOpening.availability, null, "customers never see stock");
});

test("a published offer reaches managers only, until shared down", async () => {
  const arrival = feedUntil(clients().manager, row => row.type === "EkOffer" && row.id === "ek-offer-1", "manager offer");
  await clients().manager.call("ekLab", "publishOffer", {
    department: "ek-de", offerId: "ek-offer-1", item: "BMA-WARTUNG@1", priceList: "ek-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  await arrival;
  // Publishing discloses nothing beyond staff: the appointed seller holds
  // no offer rows (appointment alone delivers no inventory), and neither
  // does the customer.
  await new Promise(resolve => setTimeout(resolve, 2000));
  const sellerView = await clients().seller.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.deepEqual(sellerView.offers, [], "publishing alone shares nothing with sellers");
  const customerView = await clients().customer.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.deepEqual(customerView.offers, [], "publishing alone shares nothing with customers");
});

test("a manager shares offers down with chosen sellers", async () => {
  // ek-offer-1 was published in the earlier test and reached managers only.
  await assert.rejects(
    clients().seller.call("ekLab", "shareOfferWithSeller", { department: "ek-de", offerId: "ek-offer-1", seller: persons().seller }),
    /only the manager may share offers with sellers/,
  );
  await assert.rejects(
    clients().manager.call("ekLab", "shareOfferWithSeller", { department: "ek-de", offerId: "ek-offer-1", seller: persons().customer }),
    /appointed sellers only/,
  );
  await assert.rejects(
    clients().manager.call("ekLab", "shareOfferWithSeller", { department: "ek-de", offerId: "nope", seller: persons().seller }),
    /not known in ek-de/,
  );
  const shared = feedUntil(clients().seller, row => row.type === "EkOffer" && row.id === "ek-offer-1", "seller receives shared offer");
  await clients().manager.call("ekLab", "shareOfferWithSeller", { department: "ek-de", offerId: "ek-offer-1", seller: persons().seller });
  await shared;
  const seen = await clients().seller.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.ok(seen.offers.some(entry => entry.offerId === "ek-offer-1"), "sharing delivers the offer to the chosen seller");
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
  assert.equal(view.availability, null, "customers never see stock");
  // 20 purchased − 2 admitted here; the staff meter agrees.
  await feedUntil(clients().manager, row => row.type === "EkOrder" && row.id === "ek-order-t1" && (row.obj?.admittedAt as number) > 0, "manager receives admission");
  const staffView = await clients().manager.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(staffView.availability?.available, 18);
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
  // 20 purchased − ek-order-t1 (2) − ek-order-once (1) − 1 here.
  assert.equal(manager.availability.available, 16);
});

test("admitting more than the shared balance fails", async () => {
  // 20 purchased − 4 settled (t1, once, self-purchase), so 16 are available:
  // a 17-unit purchase never settles.
  await clients().customer.call("ekLab", "placeOrder", {
    department: "ek-de", offer: "ek-offer-1", quantity: 17, idempotencyKey: "ek-order-oversell",
  });
  await feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === "ek-order-oversell", "seller sees oversell placement");
  await assert.rejects(
    clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-oversell" }),
    /wants 17 units but only 16 are available/,
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
  await feedUntil(clients().seller, receiptArrived, "seller replicates receipts");
  await feedUntil(clients().manager, receiptArrived, "manager replicates receipts");
  type Balance = DepartmentView & {
    orders: { idempotencyKey: string; quantity: number }[];
  };
  // Receipts reach staff and sellers, never customers — and only staff
  // project the meter.
  const customerView = await clients().customer.call<Balance>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(customerView.availability, null, "customers never see stock");
  const sellerView = await clients().seller.call<Balance>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(sellerView.availability, null, "sellers see shared offers, never the facility balance");
  const adminView = await clients().admin.call<Balance>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(adminView.availability?.stocked, 40);
  const settled = adminView.orders.reduce((sum, entry) => sum + entry.quantity, 0);
  assert.equal(adminView.availability?.available, 40 - settled);
  // The previously impossible purchase now settles against the restocked balance.
  await clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-oversell" });
  await feedUntil(clients().admin, row => row.type === "EkOrder" && row.id === "ek-order-oversell" && (row.obj?.admittedAt as number) > 0, "admin receives admission");
  const after = await clients().admin.call<Balance>("ekLab", "getDepartment", { department: "ek-de" });
  assert.ok(after.orders.some(entry => entry.idempotencyKey === "ek-order-oversell"));
  assert.equal(after.availability?.available, 40 - settled - 17);
});

test("admission accrues receivables and payables per role", async () => {
  type Money = DepartmentView & {
    orders: { idempotencyKey: string; quantity: number; unitAmount: number }[];
    balances: { party: string; role: string; receivable: number; payable: number; currency: string }[];
  };
  // Every admitted order so far settled ek-offer-1 at 100.00€.
  const sellerView = await clients().seller.call<Money>("ekLab", "getDepartment", { department: "ek-de" });
  const expected = sellerView.orders.reduce((sum, entry) => sum + entry.quantity * entry.unitAmount, 0);
  assert.ok(expected > 0, "purchases settled before");
  const row = (party: string) => sellerView.balances.find(entry => entry.party === party);
  assert.deepEqual(row(persons().customer),
    { party: persons().customer, role: "customer", receivable: 0, payable: expected, currency: "EUR" });
  assert.deepEqual(row(persons().seller),
    { party: persons().seller, role: "seller", receivable: expected, payable: expected, currency: "EUR" });
  const customerView = await clients().customer.call<Money>("ekLab", "getDepartment", { department: "ek-de" });
  assert.deepEqual(customerView.balances.map(entry => entry.party), [persons().customer], "customers see only their own row");
});

test("admission settles the placement price, not a later offer price", async () => {
  type Money = DepartmentView & {
    orders: { idempotencyKey: string; quantity: number; unitAmount: number }[];
    balances: { party: string; role: string; receivable: number; payable: number; currency: string }[];
  };
  const id = "ek-order-reprice";
  await clients().customer.call("ekLab", "placeOrder", {
    department: "ek-de", offer: "ek-offer-1", quantity: 1, idempotencyKey: id,
  });
  await feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === id, "seller sees placement");
  // The offer doubles after placement: admission still settles 100.00€.
  await clients().manager.call("ekLab", "publishOffer", {
    department: "ek-de", offerId: "ek-offer-1", item: "BMA-WARTUNG@1", priceList: "ek-retail@2026-09", unitAmount: 20000, currency: "EUR",
  });
  await clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: id });
  const sellerView = await clients().seller.call<Money>("ekLab", "getDepartment", { department: "ek-de" });
  const settled = sellerView.orders.find(entry => entry.idempotencyKey === id);
  assert.equal(settled?.unitAmount, 10000, "the admitted order carries the placement price");
  const customerRow = sellerView.balances.find(entry => entry.party === persons().customer);
  const expected = sellerView.orders.reduce((sum, entry) => sum + entry.quantity * entry.unitAmount, 0);
  assert.equal(customerRow?.payable, expected, "the balance settles the placement price");
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
  await clients().manager.call("ekLab", "shareOfferWithSeller", { department: "ek-de", offerId: "ek-offer-2", seller: persons().seller });
  await feedUntil(clients().seller, row => row.type === "EkOffer" && row.id === "ek-offer-2", "seller receives offer-2");
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
  // balance (40 stocked − 23 admitted) must agree.
  const settledIds = ["ek-order-t1", "ek-order-once", "ek-order-customer-feedback", "ek-order-oversell", "ek-order-reprice", id];
  const deadline = Date.now() + 30_000;
  for (;;) {
    const manager = await clients().manager.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
    if (settledIds.every(wanted => manager.orders.some(entry => entry.idempotencyKey === wanted))) {
      assert.equal(manager.availability.available, 17);
      break;
    }
    if (Date.now() > deadline) throw new Error("manager never projected every settled purchase after restart");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
});

test("only the department admin may appoint admins", async () => {
  const stranger = "9".repeat(64);
  await assert.rejects(
    clients().manager.call("ekLab", "assignRole", { department: "ek-de", subject: persons().customer, role: "admin" }),
    /only the department admin may appoint admins/,
  );
  await assert.rejects(
    clients().seller.call("ekLab", "assignRole", { department: "ek-de", subject: stranger, role: "admin" }),
    /only the department admin may appoint admins/,
  );
  // The manager-promoted customer from the defect report holds no admin
  // authority: publishing an offer still fails.
  await assert.rejects(
    clients().customer.call("ekLab", "publishOffer", {
      department: "ek-de", offerId: "ek-offer-coup", item: "BMA-WARTUNG@1", priceList: "ek-retail@2026-09", unitAmount: 1, currency: "EUR",
    }),
    /may not publish offer/,
  );
  // The root admin delegates freely.
  await clients().admin.call("ekLab", "assignRole", { department: "ek-de", subject: stranger, role: "admin" });
  const view = await clients().admin.call<DepartmentView & { assignments: { subject: string; role: string }[] }>(
    "ekLab", "getDepartment", { department: "ek-de" });
  assert.ok(view.assignments.some(entry => entry.subject === stranger && entry.role === "admin"));
});

test("concurrent admissions on one worker cannot oversell", async () => {
  // 40 stocked − 23 admitted by the earlier tests: 17 available. Two 10-unit
  // purchases race on the seller worker; exactly one may settle.
  const arrivals = ["ek-order-race-a", "ek-order-race-b"].map(id =>
    feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === id, `seller sees ${id}`));
  for (const id of ["ek-order-race-a", "ek-order-race-b"]) {
    await clients().customer.call("ekLab", "placeOrder", {
      department: "ek-de", offer: "ek-offer-1", quantity: 10, idempotencyKey: id,
    });
  }
  await Promise.all(arrivals);
  const results = await Promise.allSettled([
    clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-race-a" }),
    clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-race-b" }),
  ]);
  assert.equal(results[0].status, "fulfilled", "the first admission settles");
  if (results[1].status !== "rejected") throw new Error("the racing admission succeeded; stock oversold");
  assert.match(String(results[1].reason?.message ?? results[1].reason), /wants 10 units but only 7 are available/);
  await feedUntil(clients().manager, admittedRow("ek-order-race-a"), "manager receives the winning admission");
  const manager = await clients().manager.call<DepartmentView>("ekLab", "getDepartment", { department: "ek-de" });
  assert.equal(manager.availability?.available, 7, "availability never goes negative");
});

test("concurrent admissions across workers settle exactly once", async () => {
  // 7 available after the single-worker race. Two 4-unit purchases are
  // admitted at once on different workers: each passes its local check, and
  // every instance converges on one winner plus one oversold rejection.
  const seesC = feedUntil(clients().seller, row => row.type === "EkOrder" && row.id === "ek-order-race-c", "seller sees race-c");
  const seesD = feedUntil(clients().admin, row => row.type === "EkOrder" && row.id === "ek-order-race-d", "admin sees race-d");
  for (const id of ["ek-order-race-c", "ek-order-race-d"]) {
    await clients().customer.call("ekLab", "placeOrder", {
      department: "ek-de", offer: "ek-offer-1", quantity: 4, idempotencyKey: id,
    });
  }
  await seesC;
  await seesD;
  const results = await Promise.allSettled([
    clients().seller.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-race-c" }),
    clients().admin.call("ekLab", "admitOrder", { department: "ek-de", idempotencyKey: "ek-order-race-d" }),
  ]);
  assert.ok(results.every(entry => entry.status === "fulfilled"), "each worker settles against its local balance");
  type Settled = DepartmentView & {
    orders: { idempotencyKey: string }[];
    rejected: { type: string; id: string; reason: string }[];
  };
  const ids = ["ek-order-race-c", "ek-order-race-d"];
  const deadline = Date.now() + 30_000;
  for (;;) {
    const admin = await clients().admin.call<Settled>("ekLab", "getDepartment", { department: "ek-de" });
    const settled = ids.filter(id => admin.orders.some(entry => entry.idempotencyKey === id));
    const refused = ids.filter(id => admin.rejected.some(entry => entry.id === id && entry.reason === "oversold"));
    if (settled.length + refused.length === 2) {
      assert.equal(settled.length, 1, "exactly one admission settles across workers");
      assert.equal(refused.length, 1, "the other is rejected as oversold");
      assert.equal(admin.availability?.available, 3, "availability never goes negative");
      break;
    }
    if (Date.now() > deadline) throw new Error("workers never converged on one winner");
    await new Promise(resolve => setTimeout(resolve, 250));
  }
});
