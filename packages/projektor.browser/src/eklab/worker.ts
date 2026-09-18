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
import { startLabInstance } from "@projektor/ek.lab/lab-instance.ts";
import type { LabPort } from "@projektor/ek.lab/port-ipc.ts";

const scope = self as unknown as DedicatedWorkerGlobalScope & {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};

// The DOM scope's addEventListener takes a nullable listener, which can never
// satisfy LabPort's non-null contract by assignability — so the boundary cast
// lives here, once, instead of weakening the port type every consumer uses.
const port: LabPort = {
  // CHUM dials carry a MessagePort that must travel in the transfer list —
  // posting it without transfer throws "could not be cloned". Node's
  // worker_threads takes any array; the DOM scope needs Transferable[].
  postMessage: (message, transfer) => {
    if (transfer?.length) scope.postMessage(message, transfer as Transferable[]);
    else scope.postMessage(message);
  },
  addEventListener: (type, listener) => scope.addEventListener(
    type,
    listener as EventListener,
  ),
};

scope.onmessage = (event: MessageEvent) => {
  const message = event.data as { kind?: string; key?: string; session?: string; prune?: boolean };
  if (message?.kind !== "lab-key" || typeof message.key !== "string") return;
  scope.onmessage = null;
  const key = message.key;
  // Session-scoped storage: every page load is a fresh boot. Reloading into
  // persisted worker state wedges CHUM (paired and connected, but nothing
  // flows, not even new writes), and one.models offers no repair short of a
  // fresh instance — so each load gets its own directory and converges down
  // the same pairAll-plus-seed path the integration test proves.
  const session = typeof message.session === "string" && message.session !== "" ? message.session : "default";
  const directory = `amway-lab-${key}-${session}`;
  // Join workers share the key prefix with live mesh workers in this
  // profile; pruning here would delete their databases mid-handshake.
  if (message.prune !== false) void pruneOldSessions(key, directory);
  startLabInstance({
    port,
    key,
    email: `${key}@ek.local`,
    secret: `lab-${key}`,
    directory,
    createMessageChannel: () => new MessageChannel(),
  }).catch(error => {
    scope.postMessage({ kind: "boot-failed", key, error: error instanceof Error ? error.stack : String(error) });
  });
};

/** Best-effort cleanup of previous loads' directories. Never blocks boot. */
async function pruneOldSessions(key: string, keep: string): Promise<void> {
  try {
    const databases = await indexedDB.databases?.();
    if (!Array.isArray(databases)) return;
    const prefix = `amway-lab-${key}-`;
    await Promise.all(
      databases
        .map(entry => entry.name ?? "")
        .filter(name => name.startsWith(prefix) && name !== keep)
        .map(name => new Promise<void>(resolve => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve();
          request.onblocked = () => resolve();
        })),
    );
  } catch {
    // IndexedDB enumeration is not portable; stale sessions simply remain.
  }
}
