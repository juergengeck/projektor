// packages/lab.core/iom.test.ts
/**
 * IoM device pairing through a commserver.
 *
 * Two seller instances hold the same Person (same deterministic lab email,
 * separate storage directories) on separate worker runtimes. Instance A
 * creates a same-person pairing invitation (registering its pairing listener
 * on the commserver); instance B accepts it with the standard pairing
 * handshake routed there. Afterwards B projects the department through
 * person-scoped grants, and A sees the link as the same person (the native
 * isInternetOfMe condition). A third, different person is refused before
 * any network traffic.
 *
 * Discovery rides a locally spawned commserver (the one.models bundle also
 * backing the glue service), so the suite stays hermetic: no hosted relay,
 * no custom rendezvous protocol.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PortApiClient } from "./port-ipc.ts";
import { decodeIoMInvite, PAIRING_PROTOCOL_VERSION } from "./iom.ts";
import { testBrand, commServerPortFor } from "./test/brand.ts";
import { startCommServer } from "./test/commserver.ts";

const brand = testBrand();
const COMM_SERVER_PORT = commServerPortFor(brand);
const laneEntry = brand.id === "amway" ? "/browser/lab/" : "/browser/eklab/";

let root = "";
let commServerUrl = "";

function spawnInstance(key: string, directory: string) {
  const worker = new Worker(new URL("./test/node-worker.ts", import.meta.url), {
    workerData: {
      key,
      directory,
      brand: brand.id,
      commServerUrl,
      appBaseUrl: `http://127.0.0.1${laneEntry}`,
    },
  });
  const port = {
    postMessage: (message: unknown, transfer?: unknown[]) => worker.postMessage(message, transfer as []),
    addEventListener: (_type: string, listener: (event: { data: unknown }) => void) => worker.on("message", data => listener({ data })),
    removeEventListener: () => { throw new Error("lab host never removes worker listeners"); },
    start() {},
    close() {},
  };
  const client = new PortApiClient(port);
  const ready = new Promise<string>((resolve, reject) => {
    const off = client.onControl(message => {
      const msg = message as { kind?: string; person?: string };
      if (msg?.kind === "ready" && typeof msg.person === "string") {
        off();
        resolve(msg.person);
      }
    });
    worker.on("error", reject);
  });
  return { worker, client, ready };
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 500));
}

async function removeTree(root: string): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(root, { recursive: true, force: true });
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  // Temp cleanup is best-effort: a passing pairing must not fail on it.
  try {
    await rm(root, { recursive: true, force: true });
  } catch (error) {
    console.warn(`[iom-test] best-effort cleanup of ${root} failed:`, (error as Error).message);
  }
}

test("same-person second instance pairs over the commserver and projects the department", async (t) => {
  root = await mkdtemp(path.join(tmpdir(), `${brand.storagePrefix}-iom-`));

  const commserver = await startCommServer(COMM_SERVER_PORT);
  commServerUrl = commserver.url;

  const deviceA = spawnInstance("seller", path.join(root, "device-a"));
  const deviceB = spawnInstance("seller", path.join(root, "device-b"));
  t.after(async () => {
    await Promise.all([deviceA.worker.terminate(), deviceB.worker.terminate()]);
    await settle();
    await commserver.stop();
    await removeTree(root);
  });
  const [personA, personB] = await Promise.all([deviceA.ready, deviceB.ready]);
  assert.equal(personB, personA, "same email reproduces the same Person on the second device");

  await deviceA.client.call("lab", "createDepartment", { department: brand.department.id, name: brand.department.name });
  await deviceA.client.call("lab", "assignRole", { department: brand.department.id, subject: personA, role: "seller" });

  const invite = await deviceA.client.call("lab", "createIoMInvite", {}) as { invitationUrl: string; token: string; person: string };
  assert.equal(invite.person, personA);
  const parsed = new URL(invite.invitationUrl);
  assert.equal(parsed.pathname, laneEntry, "the invitation links back to the lane entry");
  assert.equal(parsed.searchParams.get("invited"), "true");
  assert.equal(parsed.searchParams.get("connectionMode"), "primed");
  assert.equal(parsed.searchParams.get("fe"), `seller@${brand.emailDomain}`);
  assert.equal(parsed.searchParams.get("fdi"), personA);
  // The fragment stays consumable by the canonical parser shape:
  // decodeURIComponent JSON carrying the pairing token and commserver URL.
  const fragment = JSON.parse(decodeURIComponent(parsed.hash.slice(1))) as Record<string, unknown>;
  assert.equal(fragment.mode, "IoM");
  assert.equal(fragment.token, invite.token);
  assert.equal(String(fragment.url), commServerUrl);
  const payload = decodeIoMInvite(invite.invitationUrl, brand);
  assert.equal(payload.mode, "IoM");
  assert.equal(payload.deviceEnrollmentPersonId, personA);
  assert.equal(payload.email, `seller@${brand.emailDomain}`);
  assert.equal(payload.identityRelation, "same-person");
  assert.equal(payload.pairingMode, "primed");

  const paired = deviceA.client.call("lab", "awaitIoMInvite", { token: invite.token, timeoutMs: 60_000 });
  await deviceB.client.call("lab", "acceptIoMInvite", { invitationUrl: invite.invitationUrl, timeoutMs: 60_000 });
  await paired;

  // Under full-suite load CHUM replication lags; poll the real condition.
  const deadline = Date.now() + 90_000;
  let view: { known?: boolean; roles?: string[] } | undefined;
  while (Date.now() < deadline) {
    view = await deviceB.client.call("lab", "getDepartment", { department: brand.department.id }) as typeof view;
    if (view?.known && view?.roles?.includes("seller")) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.equal(view?.known, true, "department replicates to the second device");
  assert.ok(view?.roles?.includes("seller"), "seller role projects on the second device");

  const connections = await deviceA.client.call("connection", "listConnections", {}) as { remotePersonId?: string }[];
  assert.ok(
    connections.some(entry => entry.remotePersonId === personA),
    "inviter sees the joiner as the same person (native IoM condition)",
  );
});

test("invitation URLs validate strictly and reject impostors", () => {
  const fragment = {
    token: "abCD09_-".repeat(4),
    url: "ws://127.0.0.1:9/comm",
    publicKey: "0".repeat(64),
    pairingProtocolVersion: PAIRING_PROTOCOL_VERSION,
    pairingMode: "primed",
    identityRelation: "same-person",
    deviceEnrollmentPersonId: "1".repeat(64),
    mode: "IoM",
  };
  const encode = (
    fragmentOverride: Record<string, unknown> = {},
    params: Record<string, string> = { fe: `seller@${brand.emailDomain}`, fdi: "1".repeat(64) },
    path = "/invites/inviteDevice/",
  ): string => {
    const url = new URL(`http://x${path}`);
    url.searchParams.set("invited", "true");
    url.searchParams.set("connectionMode", "primed");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.hash = encodeURIComponent(JSON.stringify({ ...fragment, ...fragmentOverride }));
    return url.toString();
  };
  assert.equal(decodeIoMInvite(encode(), brand).deviceEnrollmentPersonId, fragment.deviceEnrollmentPersonId);
  // A bare invitedevice path without an embedded mode still resolves to IoM.
  const { mode: _dropped, ...noMode } = fragment;
  assert.equal(decodeIoMInvite(encode(noMode), brand).mode, "IoM");
  const cases: [string, string][] = [
    ["missing payload", "http://x/invites/inviteDevice/?invited=true"],
    ["wrong mode path", encode({}, { fe: `seller@${brand.emailDomain}` }, "/invites/invitePartner/")],
    ["wrong embedded mode", encode({ mode: "IoP" })],
    ["path payload conflict", encode({ mode: "IoP" }, { fe: `seller@${brand.emailDomain}` }, "/invites/inviteDevice/")],
    ["bad rendezvous", encode({ url: "http://x/y" })],
    ["bad token", encode({ token: "short" })],
    ["bad public key", encode({ publicKey: "short" })],
    ["protocol mismatch", encode({ pairingProtocolVersion: 999 })],
    ["not primed", encode({ pairingMode: "standard" })],
    ["not same-person", encode({ identityRelation: "distinct-person" })],
    ["bad person", encode({}, { fe: `seller@${brand.emailDomain}`, fdi: "xyz" })],
    ["person conflict", encode({}, { fe: `seller@${brand.emailDomain}`, fdi: "2".repeat(64) })],
    ["bad email", encode({}, { fe: "not-an-email" })],
    ["missing email", encode({}, {})],
  ];
  for (const [name, url] of cases) {
    assert.throws(() => decodeIoMInvite(url, brand), /not a lab IoM invitation/, name);
  }
});

test("a different person is refused before any network traffic", async (t) => {
  const localRoot = await mkdtemp(path.join(tmpdir(), `${brand.storagePrefix}-iom-`));
  const commserver = await startCommServer(COMM_SERVER_PORT);
  commServerUrl = commserver.url;
  const deviceA = spawnInstance("seller", path.join(localRoot, "stranger-a"));
  const stranger = spawnInstance("customer", path.join(localRoot, "stranger-c"));
  t.after(async () => {
    await Promise.all([deviceA.worker.terminate(), stranger.worker.terminate()]);
    await commserver.stop();
    await removeTree(localRoot);
  });
  await Promise.all([deviceA.ready, stranger.ready]);

  const invite = await deviceA.client.call("lab", "createIoMInvite", {}) as { invitationUrl: string };
  await assert.rejects(
    stranger.client.call("lab", "acceptIoMInvite", { invitationUrl: invite.invitationUrl }),
    /different person/,
  );
});
