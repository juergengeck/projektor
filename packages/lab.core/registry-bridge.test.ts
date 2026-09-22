// packages/lab.core/registry-bridge.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { exposeRegistry } from "./registry-bridge.ts";

function fakeWindow() {
  const appended: { id: string }[] = [];
  const win = {
    document: {
      createElement: () => ({ id: "", hidden: false }),
      body: { appendChild: (el: { id: string }) => appended.push(el) },
      getElementById: (id: string) => appended.find(el => el.id === id) ?? null,
    },
  } as unknown as Window & { __planRegistry?: { call: Function } };
  return { win, appended };
}

test("exposes the registry before the bridge marker, wrapping results", async () => {
  const { win } = fakeWindow();
  exposeRegistry(win, { call: async (plan: string, method: string) => ({ plan, method }) });
  assert.ok(win.document.getElementById("__api_bridge"));
  assert.deepEqual(await win.__planRegistry!.call("lab", "whoAmI"), { success: true, data: { plan: "lab", method: "whoAmI" } });
});

test("reports failures as { success: false } without throwing", async () => {
  const { win } = fakeWindow();
  exposeRegistry(win, { call: async () => { throw new Error("Operation 'lab' not found"); } });
  assert.deepEqual(await win.__planRegistry!.call("lab", "x"), { success: false, error: { message: "Operation 'lab' not found" } });
});
