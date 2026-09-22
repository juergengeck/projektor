// packages/ek.lab/test/node-worker.ts
import "../../../../one/packages/one.core/lib/system/load-nodejs.js";
import { MessageChannel, parentPort, workerData } from "node:worker_threads";
import { startLabInstance } from "../lab-instance.ts";

if (!parentPort) throw new Error("lab node worker requires a parent port");
const port = parentPort;
const data = workerData as { key: string; directory: string; commServerUrl?: string; appBaseUrl?: string };

try {
  await startLabInstance({
    port,
    key: data.key,
    email: `${data.key}@ek.local`,
    secret: `lab-${data.key}`,
    directory: data.directory,
    createMessageChannel: () => new MessageChannel(),
    commServerUrl: data.commServerUrl,
    appBaseUrl: data.appBaseUrl,
  });
} catch (error) {
  port.postMessage({ kind: "boot-failed", key: data.key, error: error instanceof Error ? error.stack : String(error) });
}
