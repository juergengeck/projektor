/**
 * The `DedicatedWorkerGlobalScope` type lives in TypeScript's WebWorker lib,
 * which conflicts with DOM here. This minimal ambient shape covers what the
 * lab worker entry needs.
 */
interface DedicatedWorkerGlobalScope extends EventTarget {
  readonly location: WorkerLocation;
  postMessage(message: unknown, transfer?: Transferable[]): void;
}
