// packages/projektor.browser/src/lab/transport.ts
/**
 * Flexibel-style host transport: boots one lane-app iframe per role and
 * seeds them through invites. The host never touches lab data — it issues
 * registry calls and reads snapshots; CHUM stays between the instances over
 * the lab:// switch (Task 13) with the glue commserver for IoM discovery.
 *
 * Role appointments stay manual: the seed pairs the instances and creates
 * the department, and the admin and manager appoint through the UI.
 */
import type { LabBrand } from "../../../lab.core/brand.ts";
import { encodeMeshInviteUrl, labUrl } from "../../../lab.core/invite-url.ts";
import { staleSessionDirectories } from "../../../lab.core/storage.ts";
import { labAppUrl } from "../../../lab.core/shell/urls.ts";
import {
  callPlan,
  waitForRegistry,
  type InstrumentedWindow,
  type PlanRegistry,
} from "../../../lab.core/shell/plan-client.ts";
import { callWhenRegistered, poll } from "../../../lab.core/shell/readiness.ts";
import { iframeHostPort } from "../../../lab.core/iframe-port.ts";
import { startLabHost, type LabHost } from "../../../lab.core/worker/host-switch.ts";
import type { LaneUiState } from "../../../lab.core/session-plan.ts";
import type { DepartmentProjection } from "../../../lab.core/projection.ts";

export const LAB_KEYS = ["admin", "manager", "seller", "customer"] as const;
export type LabKey = (typeof LAB_KEYS)[number];

export interface LabAccount {
  key: LabKey;
  email: string;
  secret: string;
}

/** Deterministic accounts, never stored: the same email always reproduces
 * the same Person, so IoM pairing can find its counterpart by email. */
export function labAccount(key: LabKey, brand: LabBrand): LabAccount {
  return { key, email: `${key}@${brand.emailDomain}`, secret: `lab-${key}` };
}

export type DepartmentSnapshot =
  | { department: string; known: false }
  | ({ known: true } & DepartmentProjection);

export interface LabSnapshot {
  inviteState: LaneUiState | null;
  department: DepartmentSnapshot | null;
}

export interface LabClient {
  key: LabKey;
  iframe: HTMLIFrameElement;
  registry: PlanRegistry;
  account: LabAccount;
  snapshot(signal: AbortSignal): Promise<LabSnapshot>;
}

/** Usable dimensions for the live-app frame (the browser default 300x150 hides the app UI). */
export function sizeLabFrame(frame: Pick<HTMLIFrameElement, "style">): void {
  frame.style.width = "100%";
  frame.style.height = "720px";
  frame.style.border = "0";
  frame.style.display = "block";
}

/** One storage session per page load (D4): every load boots fresh. */
function createSessionId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 8);
}

/**
 * Delete previous loads' directories before any iframe boots. Best-effort
 * and never blocking: enumeration is not portable, so stale sessions simply
 * remain where it is not. The join path never prunes — sibling mesh workers
 * in this profile hold live databases under the same key prefix.
 */
export async function pruneStaleSessions(brand: LabBrand, session: string): Promise<void> {
  let names: string[] = [];
  try {
    const databases = await indexedDB.databases?.();
    if (Array.isArray(databases)) names = databases.map(entry => entry.name ?? "");
  } catch {
    return;
  }
  const deletions: Promise<void>[] = [];
  for (const key of LAB_KEYS) {
    const keep = `${brand.storagePrefix}-${key}-${session}`;
    for (const name of staleSessionDirectories(brand, key, keep, names)) {
      deletions.push(
        new Promise<void>(resolve => {
          try {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          } catch {
            resolve();
          }
        }),
      );
    }
  }
  await Promise.all(deletions);
}

/**
 * Sign the admin in through its own session plan. The readiness probe waits
 * for session.waitUntilReady to EXIST (retrying only "not found" via
 * callWhenRegistered): its "still booting" rejection proves the plan is up
 * with a null model — exactly when to sign in. registerAndSetup always runs
 * because the directory is always fresh.
 */
export async function ensureLabAccount(
  client: LabClient,
  signal: AbortSignal,
): Promise<{ ownerId: string; instanceId: string }> {
  await callWhenRegistered<LaneUiState>(
    client,
    signal,
    "model registration",
    "session",
    "waitUntilReady",
    { timeoutMs: 1_500 },
    5_000,
  ).catch(error => {
    if (!String((error as Error)?.message ?? error).includes("still booting")) throw error;
  });
  const result = await callPlan<{ readyState: LaneUiState }>(
    client.registry,
    signal,
    "session",
    "registerAndSetup",
    { email: client.account.email, secret: client.account.secret, instanceName: client.key, timeoutMs: 120_000 },
    125_000,
  );
  const ready = result.readyState;
  if (!ready.ownerId || !ready.instanceId || !ready.postLoginPlansReady) {
    throw new Error(`Lab ${client.key}: instance is not fully initialized.`);
  }
  return { ownerId: ready.ownerId, instanceId: ready.instanceId };
}

/** Create the brand department on a fresh boot (always unknown there). */
export async function seedDepartment(admin: LabClient, brand: LabBrand, signal: AbortSignal): Promise<void> {
  await callPlan(admin.registry, signal, "lab", "createDepartment", {
    department: brand.department.id,
    name: brand.department.name,
  });
}

/**
 * Mint a mesh (IoP) invite for one role: primed pairing parts from the
 * admin, redialed at the admin's lab:// listener through the host switch.
 */
export async function createRoleInvite(
  admin: LabClient,
  key: LabKey,
  email: string,
  appBaseUrl: string,
  signal: AbortSignal,
): Promise<{ url: string }> {
  const invite = await callPlan<{ url: string; publicKey: string; token: string; pairingMode?: string }>(
    admin.registry,
    signal,
    "connection",
    "createInvite",
    { mode: "primed" },
  );
  if (invite.pairingMode !== "primed") throw new Error(`Lab ${key}: mesh invite is not primed.`);
  const url = encodeMeshInviteUrl({
    appBaseUrl,
    email,
    token: invite.token,
    url: labUrl("admin"),
    publicKey: invite.publicKey,
    pairingMode: "primed",
  });
  return { url };
}

/**
 * Register one role through its invite, plan-driven (no test-ID clicking):
 * load the pending invitation, accept it, then read the post-handoff owner.
 */
export async function acceptRoleInvite(
  client: LabClient,
  url: string,
  registration: { secret: string; displayName: string; expectedEmail: string },
  signal: AbortSignal,
): Promise<string> {
  const loaded = await callPlan<{ loaded?: boolean; pendingInvitationPresent?: boolean }>(
    client.registry,
    signal,
    "ui",
    "loadPendingInvitation",
    { url },
    20_000,
  );
  if (loaded.loaded !== true || loaded.pendingInvitationPresent !== true) {
    throw new Error(`Lab ${client.key}: invitation did not load.`);
  }
  await callPlan(client.registry, signal, "ui", "acceptPendingInvitation", registration, 120_000);
  const status = await callWhenRegistered<{ ownerId?: string }>(
    client,
    signal,
    "post-handoff owner",
    "onecore",
    "getStatus",
    {},
  );
  const ownerId = String(status.ownerId ?? "");
  if (!ownerId) throw new Error(`Lab ${client.key}: no owner after invite pairing.`);
  return ownerId;
}

/**
 * Wait until the admin observes the accepted owner on the new mesh
 * connection: the pairing introduces exactly the invited person.
 */
async function waitForMeshPerson(
  admin: LabClient,
  key: LabKey,
  ownerId: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<string> {
  let seen: string | null = null;
  await poll(signal, `${key} invite pairing`, timeoutMs, async () => {
    const connections = await callPlan<{ remotePersonId?: string }[]>(
      admin.registry,
      signal,
      "connection",
      "listConnections",
      {},
    );
    const match = connections.find(entry => entry?.remotePersonId === ownerId);
    if (match?.remotePersonId) {
      seen = match.remotePersonId;
      return true;
    }
    return false;
  });
  return seen ?? "";
}

/**
 * Pair one role through the full invite path: mint the admin invite, accept
 * it, then assert the owner is the exact invited Person. No seed records, no
 * reuse branch, no foreign-identity check — a fresh directory cannot hold a
 * foreign identity, so those would be dead code.
 */
export async function seedRole(
  admin: LabClient,
  client: LabClient,
  key: LabKey,
  email: string,
  appBaseUrl: string,
  signal: AbortSignal,
  meshTimeoutMs = 30_000,
): Promise<string> {
  const { url } = await createRoleInvite(admin, key, email, appBaseUrl, signal);
  const ownerId = await acceptRoleInvite(
    client,
    url,
    { secret: client.account.secret, displayName: key, expectedEmail: email },
    signal,
  );
  const personId = await waitForMeshPerson(admin, key, ownerId, signal, meshTimeoutMs);
  if (ownerId !== personId) {
    throw new Error(`Lab ${key}: account owner is not the exact invited Person.`);
  }
  return `${key} paired as ${email}`;
}

/**
 * Pair the three remaining role-to-role pairs (D3 full mesh; the admin pairs
 * with each role through its invite above), each exactly once per boot.
 */
export async function pairMesh(clients: Record<LabKey, LabClient>, signal: AbortSignal): Promise<void> {
  const pairs = [["manager", "seller"], ["manager", "customer"], ["seller", "customer"]] as const;
  for (const [a, b] of pairs) {
    const invite = await callPlan<{ url: string; publicKey: string; token: string; pairingMode?: string }>(
      clients[a].registry,
      signal,
      "connection",
      "createInvite",
      { mode: "primed" },
      30_000,
    );
    await callPlan(clients[b].registry, signal, "connection", "connectWithInvite", {
      url: labUrl(a),
      publicKey: invite.publicKey,
      token: invite.token,
      pairingMode: invite.pairingMode,
    }, 90_000);
  }
}

/** One column's snapshot: invite state plus department, each degrading to null independently. */
export async function snapshotColumn(
  brand: LabBrand,
  registry: PlanRegistry,
  signal: AbortSignal,
): Promise<LabSnapshot> {
  const inviteState = await callPlan<LaneUiState>(registry, signal, "ui", "getInviteState").catch(() => null);
  const department = await callPlan<DepartmentSnapshot>(registry, signal, "lab", "getDepartment", {
    department: brand.department.id,
  }).catch(() => null);
  return { inviteState, department };
}

function asLabClient(
  key: LabKey,
  iframe: HTMLIFrameElement,
  registry: PlanRegistry,
  account: LabAccount,
  brand: LabBrand,
): LabClient {
  return { key, iframe, registry, account, snapshot: signal => snapshotColumn(brand, registry, signal) };
}

export interface BootLabOptions {
  document: Document;
  mount: (key: LabKey) => HTMLElement;
  onStage?: (stage: string) => void;
}

/**
 * Boot all four lane-app iframes one after another, then sign the admin in;
 * the roles stay pre-login until they register through their invites.
 * Sequential boot is load-bearing: the instances share one renderer, and
 * parallel full-app module graphs exhaust it while each sequential instance
 * reuses the cached transforms of the previous one.
 */
export async function bootLab(
  brand: LabBrand,
  options: BootLabOptions,
): Promise<{ clients: Record<LabKey, LabClient>; setSwitch(key: LabKey, open: boolean): void; stop: () => Promise<void> }> {
  const stage = (text: string) => {
    console.info(`[lab boot] ${text}`);
    options.onStage?.(text);
  };
  const controller = new AbortController();
  const session = createSessionId();
  const frames = {} as Record<LabKey, HTMLIFrameElement>;
  const clients = {} as Record<LabKey, LabClient>;
  // Holder (not a narrowed local): the attach promise resolves after bootLab
  // returns, when role readies arrive during seeding.
  const switchBox: { host: LabHost<LabKey> | null; pending: Map<LabKey, boolean> } = {
    host: null,
    pending: new Map(),
  };
  try {
    stage("pruning previous sessions");
    await pruneStaleSessions(brand, session);
    // Attach the lab:// switch before any instance can post routing-ready or
    // ready (both fire during iframe boot and a transferred MessagePort has
    // no replay). Frames mount without a src; the sequential loop below
    // navigates them one at a time. The attach promise is NOT awaited here:
    // role readies only arrive during seeding, after bootLab returns — the
    // spawn calls (and their listener attach) run synchronously on call.
    stage("attaching lab switch");
    const origin = new URL(options.document.location.href).origin;
    const hostPromise = startLabHost({
      keys: [...LAB_KEYS],
      spawn: (key: LabKey) => {
        const iframe = options.document.createElement("iframe");
        iframe.title = `${brand.label} Lab – ${key}`;
        sizeLabFrame(iframe);
        options.mount(key).appendChild(iframe);
        frames[key] = iframe;
        return {
          port: iframeHostPort(iframe, origin),
          terminate: async () => iframe.remove(),
          onError: (callback: (error: Error) => void) => {
            iframe.addEventListener("error", () => callback(new Error(`Lab ${key}: iframe failed to load.`)));
          },
        };
      },
    });
    void hostPromise.then(
      booted => {
        for (const [key, open] of switchBox.pending) booted.setSwitch(key, open);
        switchBox.pending.clear();
        switchBox.host = booted;
      },
      error => {
        console.error(`[lab boot] switch attach failed: ${error instanceof Error ? error.message : String(error)}`);
      },
    );
    for (const key of LAB_KEYS) {
      stage(`booting ${key}`);
      const iframe = frames[key];
      iframe.src = labAppUrl(options.document.location.href, brand, key, session);
      const app = iframe.contentWindow as unknown as InstrumentedWindow | null;
      if (!app) throw new Error(`Lab ${key}: iframe window is unavailable.`);
      stage(`waiting for ${key} registry`);
      const registry = await waitForRegistry(app, controller.signal, 120_000);
      clients[key] = asLabClient(key, iframe, registry, labAccount(key, brand), brand);
      stage(key === "admin" ? "signing in admin" : `${key} pre-login`);
      if (key === "admin") await ensureLabAccount(clients[key], controller.signal);
    }
    stage("ready");
    return {
      clients,
      setSwitch: (key, open) => {
        if (switchBox.host) switchBox.host.setSwitch(key, open);
        else switchBox.pending.set(key, open);
      },
      stop: async () => {
        controller.abort();
        if (switchBox.host) await switchBox.host.stop().catch(() => {});
        else for (const key of LAB_KEYS) frames[key]?.remove();
      },
    };
  } catch (error) {
    controller.abort();
    if (switchBox.host) await switchBox.host.stop().catch(() => {});
    else {
      for (const key of LAB_KEYS) {
        try {
          frames[key]?.remove();
        } catch {
          // Removal is best-effort; the error below already reports the failure.
        }
      }
    }
    throw error;
  }
}

export interface BootJoinOptions {
  document: Document;
  mount: (key: LabKey) => HTMLElement;
  onStage?: (stage: string) => void;
}

/**
 * Boot one lane-app iframe for a joining device: same role credentials
 * (hence the same Person), fresh session storage, no pruning and no seed.
 * The caller then accepts the IoM invitation through the client's registry.
 */
export async function bootJoinInstance(
  brand: LabBrand,
  key: LabKey,
  options: BootJoinOptions,
): Promise<{ client: LabClient; stop: () => void }> {
  const stage = (text: string) => {
    console.info(`[lab join] ${text}`);
    options.onStage?.(text);
  };
  const controller = new AbortController();
  const session = createSessionId();
  let iframe: HTMLIFrameElement | null = null;
  try {
    stage("booting join iframe");
    iframe = options.document.createElement("iframe");
    iframe.src = labAppUrl(options.document.location.href, brand, key, session);
    iframe.title = `${brand.label} Lab – ${key} (join)`;
    sizeLabFrame(iframe);
    options.mount(key).appendChild(iframe);
    const app = iframe.contentWindow as unknown as InstrumentedWindow | null;
    if (!app) throw new Error(`Lab ${key}: iframe window is unavailable.`);
    stage("waiting for join registry");
    const registry = await waitForRegistry(app, controller.signal, 120_000);
    const client = asLabClient(key, iframe, registry, labAccount(key, brand), brand);
    stage("join ready");
    return {
      client,
      stop: () => {
        controller.abort();
        iframe?.remove();
      },
    };
  } catch (error) {
    controller.abort();
    iframe?.remove();
    throw error;
  }
}
