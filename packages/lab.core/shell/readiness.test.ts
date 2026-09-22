// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/lab/transport.ts (5e0370c5b); replace with the shared lane-shell package in Phase 4.
// Flexibel has no unit tests for callWhenRegistered; the cases below are new
// and cover the exact retry contract the plan mandates.
import test from "node:test";
import assert from "node:assert/strict";
import { callWhenRegistered, poll, type ShellClient } from "./readiness.ts";

type CallResult = { success: boolean; data?: unknown; error?: { message?: string } };

function clientWith(key: string, calls: number[], impl: (n: number) => Promise<CallResult>): ShellClient {
  return {
    key,
    registry: {
      call: async () => {
        calls.push(calls.length + 1);
        return impl(calls.length);
      },
    },
  };
}

test("returns the first success without waiting", async () => {
  const calls: number[] = [];
  const client = clientWith("seller", calls, async () => ({ success: true, data: "ok" }));
  assert.equal(
    await callWhenRegistered<string>(client, new AbortController().signal, "probe", "lab", "getDepartment"),
    "ok",
  );
  assert.deepEqual(calls, [1]);
});

test("waits for the operation to register, then the same call succeeds", async () => {
  const calls: number[] = [];
  const client = clientWith("seller", calls, async n =>
    n === 1
      ? { success: false, error: { message: "Operation 'lab' not found" } }
      : { success: true, data: 42 },
  );
  assert.equal(
    await callWhenRegistered<number>(client, new AbortController().signal, "probe", "lab", "getDepartment"),
    42,
  );
  assert.deepEqual(calls, [1, 2]);
});

test("never retries a side-effecting call that fails with another error", async () => {
  const calls: number[] = [];
  const client = clientWith("seller", calls, async () => ({
    success: false,
    error: { message: "pairing already accepted" },
  }));
  await assert.rejects(
    callWhenRegistered(client, new AbortController().signal, "pair", "connection", "acceptInvite"),
    /pairing already accepted/,
  );
  assert.deepEqual(calls, [1]);
});

test("gives up waiting for registration after the bound", async () => {
  const calls: number[] = [];
  const client = clientWith("seller", calls, async () => ({
    success: false,
    error: { message: "Operation 'lab' not found" },
  }));
  await assert.rejects(
    callWhenRegistered(client, new AbortController().signal, "probe", "lab", "getDepartment", undefined, 20_000, 600),
    /Operation 'lab' not found/,
  );
  assert.ok(calls.length >= 2);
});

test("throws immediately on an aborted signal without calling", async () => {
  const calls: number[] = [];
  const client = clientWith("seller", calls, async () => ({ success: true }));
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    callWhenRegistered(client, controller.signal, "probe", "lab", "getDepartment"),
    /document was closed/,
  );
  assert.deepEqual(calls, []);
});

test("poll resolves as soon as the check passes", async () => {
  await poll(new AbortController().signal, "seller", 1000, async () => true);
});

test("poll keeps polling until the check passes", async () => {
  let checks = 0;
  await poll(new AbortController().signal, "seller", 5000, async () => {
    checks += 1;
    return checks >= 3;
  });
  assert.equal(checks, 3);
});

test("poll times out instead of polling forever", async () => {
  await assert.rejects(poll(new AbortController().signal, "seller", 100, async () => false), /timed out/);
});

test("poll aborts between polls", async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    await assert.rejects(poll(controller.signal, "seller", 10_000, async () => false), /document was closed/);
  } finally {
    clearTimeout(timer);
  }
});
