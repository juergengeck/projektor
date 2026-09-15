// packages/projektor.browser/src/lab/worker.ts
/**
 * Browser Web Worker entry for one lab instance. The platform import must run
 * before anything touches one.core storage.
 *
 * Vite only emits this file as a separate worker chunk when it is the direct
 * argument of `new Worker(new URL(...))` in transport.ts, so the role key
 * cannot travel in a URL query: it arrives as the first message instead.
 */
import "@refinio/one.core/system/load-browser.js";
import { startLabInstance } from "@projektor/amway.lab/lab-instance.js";

const scope = self as unknown as DedicatedWorkerGlobalScope & {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};

scope.onmessage = (event: MessageEvent) => {
  const message = event.data as { kind?: string; key?: string };
  if (message?.kind !== "lab-key" || typeof message.key !== "string") return;
  scope.onmessage = null;
  const key = message.key;
  startLabInstance({
    port: scope,
    key,
    email: `${key}@lab.local`,
    secret: `lab-${key}`,
    directory: `amway-lab-${key}`,
    createMessageChannel: () => new MessageChannel(),
  }).catch(error => {
    scope.postMessage({ kind: "boot-failed", key, error: error instanceof Error ? error.stack : String(error) });
  });
};
