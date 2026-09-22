// packages/amway.lab/port-ipc.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { MessageChannel } from "node:worker_threads";
import { IpcTransport } from "../../../one/packages/refinio.api/dist/src/transports/IpcTransport.js";
import { OperationRegistry } from "../../../one/packages/refinio.api/dist/src/registry/index.js";
import { createPortIpcMain, PortApiClient, postFeed } from "./port-ipc.ts";

function pair() {
  const { port1, port2 } = new MessageChannel();
  const registry = new OperationRegistry();
  registry.register("echo", {
    say: (params: { text: string }) => ({ said: params.text }),
    boom: () => { throw new Error("kaboom"); },
  }, { description: "echo", methods: [{ name: "say", description: "say" }, { name: "boom", description: "boom" }] });
  new IpcTransport(registry).register(createPortIpcMain(port1));
  const client = new PortApiClient(port2);
  return { port1, port2, client };
}

test("calls reach the registry through IpcTransport", async () => {
  const { port1, port2, client } = pair();
  try {
    assert.deepEqual(await client.call("echo", "say", { text: "hi" }), { said: "hi" });
    assert.ok((await client.list()).some(entry => entry.name === "echo"));
  } finally { port1.close(); port2.close(); }
});

test("plan errors reject the call", async () => {
  const { port1, port2, client } = pair();
  try {
    await assert.rejects(client.call("echo", "boom", {}), /kaboom/);
    await assert.rejects(client.call("nope", "say", {}), /not found/);
  } finally { port1.close(); port2.close(); }
});

test("feed rows and worker failure", async () => {
  const { port1, port2, client } = pair();
  try {
    const row = new Promise<unknown>(resolve => client.onFeed(resolve));
    postFeed(port1, { type: "AmwayOffer", id: "o1" });
    assert.deepEqual(await row, { type: "AmwayOffer", id: "o1" });
    const pending = client.call("echo", "say", { text: "late" });
    client.fail(new Error("worker crashed"));
    await assert.rejects(pending, /worker crashed/);
  } finally { port1.close(); port2.close(); }
});
