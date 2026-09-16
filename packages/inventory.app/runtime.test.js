import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createInventoryServer } from "../../scripts/inventory-server.mjs";

test("real inventory API persists evidenced goods, exact movements, and counts across restart", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "inventory-runtime-"));
  let server;
  let base;
  let cookie;
  async function start() {
    server = createInventoryServer({ directory });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    base = `http://127.0.0.1:${server.address().port}`;
  }
  async function close() {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server = undefined;
  }
  async function call(route, params, headers = {}) {
    const response = await fetch(`${base}${route}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify(params) });
    return { response, value: await response.json() };
  }
  async function login(password = "inventory-test-secret") {
    const result = await call("/session", { email: "inventory-test@example.invalid", password });
    if (result.response.ok) cookie = result.response.headers.get("set-cookie").split(";")[0];
    return result;
  }
  async function operation(method, params = {}) {
    const result = await call(`/api/inventory/${method}`, params);
    assert.equal(result.response.status, 200, JSON.stringify(result.value));
    assert.ok(result.value.product, JSON.stringify(result.value));
    return result.value.product;
  }
  try {
    await start();
    assert.equal((await call("/api/inventory/getSnapshot", {})).response.status, 401);
    assert.equal((await call("/session", {}, { Origin: "https://other.example" })).response.status, 403);
    const unlocked = await login();
    assert.equal(unlocked.response.status, 200, JSON.stringify(unlocked.value));
    let state = await operation("getSnapshot");
    assert.equal(state.stock.length, 0);
    state = await operation("addLocation", { name: "Warehouse", expectedVersion: state.version });
    const warehouse = state.locations[0].ref;
    state = await operation("addLocation", { name: "Workshop", expectedVersion: state.version });
    const workshop = state.locations.find(value => value.name === "Workshop").ref;
    state = await operation("openLot", { name: "Steel", lotId: "STEEL-1", unit: "kg", dimension: "mass", quantity: 0.3, location: warehouse, evidence: "Opening balance OB-001: 0.3 kg owned and held locally.", expectedVersion: state.version });
    const lot = state.stock[0].lot;
    assert.equal(state.stock[0].quantity, 0.3);
    assert.match(state.history[0].ref, /^[a-f0-9]{64}$/);
    assert.match(state.history[0].evidence, /OB-001/);
    const beforeRejected = state.version;
    for (const [method, params] of [
      ["openLot", { name: "Steel", lotId: "STEEL-1", unit: "kg", dimension: "mass", quantity: 0.3, location: warehouse, evidence: "duplicate" }],
      ["move", { lot, quantity: 0.4, fromLocation: warehouse, toLocation: workshop }],
      ["move", { lot, quantity: -1, fromLocation: warehouse, toLocation: workshop }],
      ["count", { lot: "f".repeat(64), location: warehouse, observedQuantity: 2 }],
      ["move", { lot, quantity: 0.1, fromLocation: warehouse, toLocation: "f".repeat(64) }],
    ]) {
      const result = await call(`/api/inventory/${method}`, { ...params, expectedVersion: state.version });
      assert.ok(result.response.status >= 400 || result.value.error, `${method} must reject invalid input`);
      assert.equal((await operation("getSnapshot")).version, beforeRejected);
    }
    state = await operation("move", { lot, quantity: 0.1, fromLocation: warehouse, toLocation: workshop, expectedVersion: state.version });
    assert.equal(state.stock.find(value => value.location === warehouse).quantity, 0.2);
    state = await operation("move", { lot, quantity: 0.2, fromLocation: warehouse, toLocation: workshop, expectedVersion: state.version });
    assert.equal(state.stock.length, 1);
    assert.equal(state.stock[0].quantity, 0.3);
    assert.equal(state.stock[0].custodian, state.owner);
    assert.equal(state.stock[0].titleHolder, state.owner);
    state = await operation("count", { lot, location: workshop, observedQuantity: 0.2, expectedVersion: state.version });
    assert.equal(state.stock[0].quantity, 0.3);
    assert.equal(state.observations[0].difference, -0.1);
    const concurrent = await Promise.all([
      call("/api/inventory/move", { lot, quantity: 0.2, fromLocation: workshop, toLocation: warehouse, expectedVersion: state.version }),
      call("/api/inventory/move", { lot, quantity: 0.2, fromLocation: workshop, toLocation: warehouse, expectedVersion: state.version }),
    ]);
    assert.equal(concurrent.filter(result => result.response.ok && !result.value.error).length, 1);
    state = await operation("getSnapshot");
    state = await operation("openLot", { name: "Steel", lotId: "STEEL-2", unit: "kg", dimension: "mass", quantity: 5, location: warehouse, evidence: "Opening balance OB-002.", expectedVersion: state.version });
    assert.equal(state.lots.length, 2);
    assert.equal(state.observations[0].foldedQuantity, 0.3);
    assert.equal(state.observations[0].difference, -0.1);
    const persisted = structuredClone(state);
    await close();
    cookie = undefined;
    await start();
    const wrongPassword = await login("wrong-password");
    assert.equal(wrongPassword.response.status, 400);
    assert.equal((await login()).response.status, 200);
    assert.deepEqual(await operation("getSnapshot"), persisted);
    assert.equal((await call("/api/inventory/write", {})).response.status, 404);
    const discovery = await fetch(`${base}/api`, { headers: { Cookie: cookie } });
    assert.match(await discovery.text(), /openLot/);
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Record opening stock/);
  } finally {
    if (server) await close();
    await rm(directory, { recursive: true, force: true });
  }
});
