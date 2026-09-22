// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/demo/runner-client.test.ts (5e0370c5b); replace with the shared lane-shell package in Phase 4.
import test from "node:test";
import assert from "node:assert/strict";
import { callPlan, waitForRegistry, type InstrumentedWindow, type PlanRegistry } from "./plan-client.ts";

interface ObserverState {
  notify?: () => void;
  observed: unknown[];
  disconnects: number;
}

function installObserverStub(state: ObserverState): () => void {
  const holder = globalThis as Record<string, unknown>;
  const Original = holder.MutationObserver;
  class StubObserver {
    constructor(callback: () => void) {
      state.notify = callback;
    }
    observe(target: unknown): void {
      state.observed.push(target);
    }
    disconnect(): void {
      state.disconnects += 1;
    }
  }
  holder.MutationObserver = StubObserver;
  return () => {
    if (Original === undefined) delete holder.MutationObserver;
    else holder.MutationObserver = Original;
  };
}

function freshObserverState(): ObserverState {
  return { notify: undefined, observed: [], disconnects: 0 };
}

test("calls the canonical registry and propagates failures without retrying", async () => {
  const calls: unknown[][] = [];
  const registry: PlanRegistry = {
    call: async (handler, method, params) => {
      calls.push([handler, method, params]);
      return { success: false, error: { message: "Missing test id: nav-questionnaires" } };
    },
  };
  await assert.rejects(
    callPlan(registry, new AbortController().signal, "ui", "clickTestId", { testId: "nav-questionnaires" }),
    /Missing test id: nav-questionnaires/,
  );
  assert.deepEqual(calls, [["ui", "clickTestId", { testId: "nav-questionnaires" }]]);
});

test("preserves the exact identity coordinates returned by the app", async () => {
  const data = { ownerId: "owner-person", instanceId: "exact-instance", appVersion: "1.0.test" };
  const registry: PlanRegistry = { call: async () => ({ success: true, data }) };
  assert.strictEqual(await callPlan(registry, new AbortController().signal, "ui", "getInviteState"), data);
});

test("discards an old document response when its generation closes", async () => {
  let finish!: (result: { success: boolean; data?: unknown }) => void;
  const pending: PlanRegistry = {
    call: () =>
      new Promise<{ success: boolean; data?: unknown }>(resolve => {
        finish = resolve;
      }),
  };
  const controller = new AbortController();
  const call = callPlan<{ ownerId: string }>(pending, controller.signal, "ui", "getInviteState");
  await Promise.resolve();
  controller.abort();
  finish({ success: true, data: { ownerId: "old-owner" } });
  await assert.rejects(call, /App document was closed/);
});

test("never starts a call for an already closed document", async () => {
  let calls = 0;
  const registry: PlanRegistry = {
    call: async () => {
      calls += 1;
      return { success: true };
    },
  };
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(callPlan(registry, controller.signal, "ui", "clickTestId"), /closed/);
  assert.equal(calls, 0);
});

test("fails on its liveness bound without retrying or inventing ready state", async () => {
  let calls = 0;
  const registry: PlanRegistry = {
    call: async () => {
      calls += 1;
      return new Promise<never>(() => {});
    },
  };
  await assert.rejects(
    callPlan(registry, new AbortController().signal, "ui", "getInviteState", undefined, 50),
    /no response within the time limit/,
  );
  assert.equal(calls, 1);
});

test("connects on arrival of the existing app bridge", async () => {
  const state = freshObserverState();
  const restore = installObserverStub(state);
  try {
    let hasBridge = false;
    const registry: PlanRegistry = { call: async () => ({ success: true }) };
    const app = {
      document: { documentElement: {}, getElementById: () => (hasBridge ? {} : null) },
      __planRegistry: registry,
    } as unknown as InstrumentedWindow;
    const connection = waitForRegistry(app, new AbortController().signal);
    hasBridge = true;
    state.notify!();
    assert.strictEqual(await connection, registry);
    assert.equal(state.disconnects, 1);
  } finally {
    restore();
  }
});

test("follows the live document when iframe navigation replaces it", async () => {
  const state = freshObserverState();
  const restore = installObserverStub(state);
  try {
    const aboutBlank = { documentElement: { id: "blank" }, getElementById: () => null };
    const appDocument = {
      documentElement: { id: "app" },
      getElementById: (id: string) => (id === "__api_bridge" ? {} : null),
    };
    let current: typeof aboutBlank | typeof appDocument = aboutBlank;
    const registry: PlanRegistry = { call: async () => ({ success: true }) };
    const app = {
      get document() {
        return current;
      },
      __planRegistry: registry,
    } as unknown as InstrumentedWindow;
    const connection = waitForRegistry(app, new AbortController().signal);
    assert.deepEqual(state.observed, [aboutBlank.documentElement]);
    current = appDocument;
    state.notify!();
    assert.strictEqual(await connection, registry);
    assert.deepEqual(state.observed, [aboutBlank.documentElement, appDocument.documentElement]);
  } finally {
    restore();
  }
});

test("releases the readiness observer and timer on document teardown", async () => {
  const state = freshObserverState();
  const restore = installObserverStub(state);
  try {
    const app = {
      document: { documentElement: {}, getElementById: () => null },
    } as unknown as InstrumentedWindow;
    const controller = new AbortController();
    const connection = waitForRegistry(app, controller.signal);
    controller.abort();
    await assert.rejects(connection, /closed/);
    assert.equal(state.disconnects, 1);
  } finally {
    restore();
  }
});
