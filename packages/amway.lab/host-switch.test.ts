import assert from "node:assert/strict";
import { test } from "node:test";
import { startLabHost } from "./host-switch.ts";

type Listener = (event: { data: unknown }) => void;

class FakeWorkerPort {
  key: string;
  events: string[];
  listeners = new Set<Listener>();

  constructor(key: string, events: string[]) {
    this.key = key;
    this.events = events;
  }

  addEventListener(type: string, listener: Listener): void {
    if (type === "message") this.listeners.add(listener);
  }

  start(): void {}

  emit(message: unknown): void {
    for (const listener of this.listeners) listener({ data: message });
  }

  postMessage(message: { kind?: string }): void {
    if (message?.kind === "chum-accept") this.events.push(`${this.key}:accept`);
  }
}

test("dials wait until the target has installed its accept listener", async () => {
  const events: string[] = [];
  const ports = new Map<string, FakeWorkerPort>();
  const dialPort = { postMessage() {}, close() {} };

  const host = await startLabHost({
    keys: ["fast", "slow"],
    spawn(key: string) {
      const port = new FakeWorkerPort(key, events);
      ports.set(key, port);
      if (key === "fast") {
        queueMicrotask(() => {
          port.emit({ kind: "routing-ready", key });
          events.push("fast:dial");
          port.emit({ kind: "chum-dial", from: key, url: "lab://slow", port: dialPort });
          port.emit({ kind: "ready", key, person: "fast-person" });
        });
      } else {
        setTimeout(() => {
          events.push("slow:routing-ready");
          port.emit({ kind: "routing-ready", key });
          port.emit({ kind: "ready", key, person: "slow-person" });
        }, 10);
      }
      return { port, terminate: async () => {}, onError() {} };
    },
  });

  try {
    assert.deepEqual(events, ["fast:dial", "slow:routing-ready", "slow:accept"]);
    assert.deepEqual(host.persons, { fast: "fast-person", slow: "slow-person" });
  } finally {
    await host.stop();
  }
});
