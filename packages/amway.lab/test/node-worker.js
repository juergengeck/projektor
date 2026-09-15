// packages/amway.lab/test/node-worker.js
import "../../../../one/packages/one.core/lib/system/load-nodejs.js";
import { MessageChannel, parentPort, workerData } from "node:worker_threads";
import { startLabInstance } from "../lab-instance.js";

try {
  await startLabInstance({
    port: parentPort,
    key: workerData.key,
    email: `${workerData.key}@lab.local`,
    secret: `lab-${workerData.key}`,
    directory: workerData.directory,
    createMessageChannel: () => new MessageChannel(),
  });
} catch (error) {
  parentPort.postMessage({ kind: "boot-failed", key: workerData.key, error: error instanceof Error ? error.stack : String(error) });
}
