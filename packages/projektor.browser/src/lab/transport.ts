// packages/projektor.browser/src/lab/transport.ts
/**
 * Web host side of the lab: spawns one Worker per role, switches `lab:` dials
 * between them, and hands the UI a refinio.api client per worker. Amway data
 * never passes through here; only CHUM ports and IPC calls do.
 */
import { startLabHost } from "@projektor/amway.lab/host-switch.js";
import type { PortApiClient } from "@projektor/amway.lab/port-ipc.js";

export const LAB_KEYS = ["admin", "manager", "seller", "customer"] as const;
export type LabKey = (typeof LAB_KEYS)[number];

export interface LabHandle {
  clients: Record<LabKey, PortApiClient>;
  persons: Record<LabKey, string>;
  setSwitch(key: LabKey, open: boolean): void;
  stop(): Promise<void>;
}

function waitForRow(client: PortApiClient, match: (row: { type: string; id: string }) => boolean): Promise<void> {
  return new Promise(resolve => {
    const off = client.onFeed((row: { type: string; id: string }) => {
      if (!match(row)) return;
      off();
      resolve();
    });
  });
}

export async function bootLab(): Promise<LabHandle> {
  // startLabHost is untyped JS; the shape below is its documented contract.
  const host = (await startLabHost({
    keys: [...LAB_KEYS],
    spawn: (key: LabKey) => {
      // Inline `new URL` so Vite emits a worker chunk; the key follows as the first message.
      const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
      worker.postMessage({ kind: "lab-key", key });
      return {
        port: worker,
        terminate: async () => worker.terminate(),
        onError: (cb: (error: Error) => void) => worker.addEventListener("error", event => cb(new Error(event.message))),
      };
    },
  })) as unknown as LabHandle & { pairAll(): Promise<void> };
  const { admin, manager } = host.clients;
  // Pairings and the department persist in each worker's IndexedDB; seed once.
  const status = await admin.call("amwayLab", "getDepartment", { department: "demo-de" });
  if (!status.known) {
    await host.pairAll();
    const appointed = waitForRow(manager, row => row.type === "AmwayRoleAssignment" && row.id === host.persons.manager);
    await admin.call("amwayLab", "createDepartment", { department: "demo-de", name: "Demo DE" });
    await admin.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.manager, role: "manager" });
    await appointed;
    const members = [host.clients.seller, host.clients.customer].map(client => waitForRow(client, row => row.type === "AmwayDepartment"));
    await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.seller, role: "seller" });
    await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.customer, role: "customer" });
    await Promise.all(members);
  }
  return host;
}
