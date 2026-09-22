// packages/projektor.browser/src/lab/transport.ts
/**
 * Web host side of the lab: spawns one Worker per role, switches `lab:` dials
 * between them, and hands the UI a refinio.api client per worker. Amway data
 * never passes through here; only CHUM ports and IPC calls do.
 */
import { startLabHost } from "@projektor/amway.lab/host-switch.ts";
import type { PortApiClient } from "@projektor/amway.lab/port-ipc.ts";

export const LAB_KEYS = ["admin", "manager", "seller", "customer"] as const;
export type LabKey = (typeof LAB_KEYS)[number];
export type { FeedRow } from "@projektor/amway.lab/port-ipc.ts";

export interface LabHandle {
  clients: Record<LabKey, PortApiClient>;
  persons: Record<LabKey, string>;
  setSwitch(key: LabKey, open: boolean): void;
  stop(): Promise<void>;
}

/**
 * Commserver override for tests and dev (`?commServer=`); production lanes
 * use the glue service default baked into the lab. Only ws(s) URLs pass.
 */
function laneCommServer(): string | undefined {
  try {
    const value = new URLSearchParams(window.location.search).get("commServer") ?? "";
    return /^wss?:\/\//.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Lane entry URL prefix the QR-encoded IoM invitation links back to. */
function laneAppBase(): string {
  const url = new URL(window.location.pathname, window.location.origin);
  // The invitation payload replaces the hash; retain the workspace's lane
  // selection in the query so #/lab invitations still open the join page.
  url.searchParams.set("lane", "amway");
  return url.toString();
}

function spawnWorker(key: LabKey, session: string, prune: boolean) {
  // Inline `new URL` so Vite emits a worker chunk; the key follows as the first message.
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.postMessage({ kind: "lab-key", key, session, prune, commServer: laneCommServer(), appBase: laneAppBase() });
  return {
    port: worker,
    terminate: async () => worker.terminate(),
    onError: (cb: (error: Error) => void) => worker.addEventListener("error", event => cb(new Error(event.message))),
  };
}

export async function bootLab(onStage: (stage: string) => void = () => {}): Promise<LabHandle> {
  const stage = (text: string) => {
    console.info(`[lab boot] ${text}`);
    onStage(text);
  };
  // One storage session per page load; see worker.ts for why reloads reboot fresh.
  const session = crypto.randomUUID().slice(0, 8);
  stage("spawning workers");
  // startLabHost is untyped JS; the shape below is its documented contract.
  const host = (await startLabHost({
    keys: [...LAB_KEYS],
    spawn: (key: LabKey) => spawnWorker(key, session, true),
  })) as unknown as LabHandle & { pairAll(): Promise<void> };
  const { admin } = host.clients;
  stage("workers ready");
  // Pairings and the department persist in each worker's IndexedDB; seed once.
  // Role appointments are deliberately NOT seeded: the admin appoints the
  // manager and the manager appoints the team through the lab buttons, so
  // every capability visibly unlocks through the appointment ceremony.
  const status = await admin.call<{ known: boolean }>("amwayLab", "getDepartment", { department: "demo-de" });
  if (!status.known) {
    stage("pairing 6 lanes");
    await host.pairAll();
    stage("paired, creating department");
    await admin.call("amwayLab", "createDepartment", { department: "demo-de", name: "Demo DE" });
    stage("department ready, appointments are manual");
  } else {
    stage("department known, skipping seed");
  }
  return host;
}

/**
 * Boot one worker for a joining device: same role credentials (hence the
 * same Person), fresh session storage, no mesh pairing and no seed. The
 * caller then runs acceptIoMInvite on the returned handle to pair this
 * instance with its counterpart through the commserver.
 */
export async function bootJoinInstance(
  key: LabKey,
  onStage: (stage: string) => void = () => {},
): Promise<LabHandle> {
  const stage = (text: string) => {
    console.info(`[lab join] ${text}`);
    onStage(text);
  };
  const session = crypto.randomUUID().slice(0, 8);
  stage("spawning join worker");
  const host = (await startLabHost({
    keys: [key],
    // No pruning: sibling mesh workers in this profile hold live databases
    // under the same key prefix; deleting them wedges their connections.
    // Stale join sessions are swept by the next full mesh boot instead.
    spawn: (spawned: LabKey) => spawnWorker(spawned, session, false),
  })) as unknown as LabHandle;
  stage("join worker ready");
  return host;
}
