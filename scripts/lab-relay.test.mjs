import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { createLabRelay, LAB_RELAY_PATH } from "./lab-relay.mjs";

async function startedRelay(options) {
  const relay = createLabRelay(options);
  const server = createServer((req, res) => {
    res.writeHead(404).end();
  });
  server.on("upgrade", (request, socket, head) => {
    if (!relay.handleUpgrade(request, socket, head)) socket.destroy();
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const sockets = new Set();
  return {
    relay,
    server,
    base,
    dial(token, side) {
      const socket = new WebSocket(`${base.replace("http", "ws")}${LAB_RELAY_PATH}?token=${token}&side=${side}`);
      socket.binaryType = "arraybuffer";
      sockets.add(socket);
      return socket;
    },
    async shutdown() {
      for (const socket of sockets) {
        try {
          socket.close();
        } catch {
          // Already gone.
        }
      }
      relay.shutdown();
      server.closeAllConnections?.();
      server.close();
      await once(server, "close");
    },
  };
}

async function opened(socket) {
  if (socket.readyState === 1) return;
  await once(socket, "open");
}

async function nextMessage(socket) {
  const [event] = await once(socket, "message");
  const data = event.data;
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  throw new Error(`Unexpected message payload: ${typeof data}`);
}

async function closeCode(socket) {
  const [event] = await once(socket, "close");
  return event.code;
}

test("host and joiner pipe frames in both directions", async (t) => {
  const relay = await startedRelay();
  t.after(() => relay.shutdown());
  const token = `aZ_9-${"x".repeat(11)}Q`;
  const host = relay.dial(token, "host");
  const joiner = relay.dial(token, "join");
  await Promise.all([opened(host), opened(joiner)]);
  assert.equal(relay.relay.roomCount(), 1);

  host.send("hello from host");
  assert.equal(await nextMessage(joiner), "hello from host");

  joiner.send(new Uint8Array([1, 2, 3, 4]));
  assert.deepEqual(await nextMessage(host), new Uint8Array([1, 2, 3, 4]));
  assert.equal(relay.relay.roomCount(), 1);
});

test("join to an unknown token is rejected and leaves no room", async (t) => {
  const relay = await startedRelay();
  t.after(() => relay.shutdown());
  const joiner = relay.dial(`f${"1".repeat(15)}e`, "join");
  assert.equal(await closeCode(joiner), 4404);
  assert.equal(relay.relay.roomCount(), 0);
});

test("a second joiner is rejected while the first pair stays live", async (t) => {
  const relay = await startedRelay();
  t.after(() => relay.shutdown());
  const token = `b${"2".repeat(15)}c`;
  const host = relay.dial(token, "host");
  const first = relay.dial(token, "join");
  await Promise.all([opened(host), opened(first)]);

  const second = relay.dial(token, "join");
  assert.equal(await closeCode(second), 4409);

  host.send("still piped");
  assert.equal(await nextMessage(first), "still piped");
});

test("malformed relay requests are refused before upgrade", async (t) => {
  const relay = await startedRelay();
  t.after(() => relay.shutdown());
  const bad = relay.dial("short", "host");
  // A destroyed handshake surfaces as either a close or an error.
  const outcome = await Promise.race([
    closeCode(bad).then(code => ({ code })),
    once(bad, "error").then(() => ({ refused: true })),
  ]);
  assert.ok(outcome.code === 1006 || outcome.refused, `unexpected outcome: ${JSON.stringify(outcome.code)}`);
  assert.equal(relay.relay.roomCount(), 0);
});

test("idle rooms expire and unrelated paths are ignored", async (t) => {
  const relay = await startedRelay({ roomTtlMs: 50 });
  t.after(() => relay.shutdown());
  const token = `c${"3".repeat(15)}d`;
  const host = relay.dial(token, "host");
  await opened(host);
  assert.equal(await closeCode(host), 4408);
  assert.equal(relay.relay.roomCount(), 0);
  assert.equal(relay.relay.handleUpgrade({ url: "/elsewhere" }, { destroy() {} }, undefined), false);
});
