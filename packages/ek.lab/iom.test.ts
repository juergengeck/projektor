// packages/ek.lab/iom.test.ts
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
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PortApiClient } from "./port-ipc.ts";
import { decodeIoMInvite, PAIRING_PROTOCOL_VERSION } from "./iom.ts";

const COMM_SERVER_PORT = 18332;
const commServerBundle = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..", "..", "..", "one", "packages", "one.models", "comm_server.bundle.js",
);

let root = "";
let commServerUrl = "";

function spawnInstance(key: string, directory: string) {
  const worker = new Worker(new URL("./test/node-worker.ts", import.meta.url), {
    workerData: {
      key,
      directory,
      commServerUrl,
      appBaseUrl: "http://127.0.0.1/browser/eklab/",
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

async function startCommServer() {
  const child = spawn(process.execPath, [commServerBundle, "-h", "127.0.0.1", "-p", String(COMM_SERVER_PORT)], {
    stdio: "ignore",
  });
  const deadline = Date.now() + 30_000;
  for (;;) {
    const reachable = await new Promise<boolean>(resolve => {
      const socket = connect(COMM_SERVER_PORT, "127.0.0.1");
      socket.on("connect", () => { socket.end(); resolve(true); });
      socket.on("error", () => resolve(false));
    });
    if (reachable) break;
    if (Date.now() > deadline) {
      child.kill();
      throw new Error("local commserver never came up");
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  commServerUrl = `ws://127.0.0.1:${COMM_SERVER_PORT}`;
  return child;
}

async function stopCommServer(child: { kill(): void }) {
  child.kill();
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
  root = await mkdtemp(path.join(tmpdir(), "ek-lab-iom-"));

  const commserver = await startCommServer();

  const deviceA = spawnInstance("seller", path.join(root, "device-a"));
  const deviceB = spawnInstance("seller", path.join(root, "device-b"));
  t.after(async () => {
    await Promise.all([deviceA.worker.terminate(), deviceB.worker.terminate()]);
    await settle();
    await stopCommServer(commserver);
    await removeTree(root);
  });
  const [personA, personB] = await Promise.all([deviceA.ready, deviceB.ready]);
  assert.equal(personB, personA, "same email reproduces the same Person on the second device");

  await deviceA.client.call("ekLab", "createDepartment", { department: "ek-de", name: "Demo DE" });
  await deviceA.client.call("ekLab", "assignRole", { department: "ek-de", subject: personA, role: "seller" });

  const invite = await deviceA.client.call("ekLab", "createIoMInvite", {}) as { invitationUrl: string; token: string; person: string };
  assert.equal(invite.person, personA);
  const parsed = new URL(invite.invitationUrl);
  assert.equal(parsed.pathname, "/browser/eklab/", "the invitation links back to the lane entry");
  assert.equal(parsed.searchParams.get("invited"), "true");
  assert.equal(parsed.searchParams.get("connectionMode"), "primed");
  assert.equal(parsed.searchParams.get("fe"), "seller@ek.local");
  assert.equal(parsed.searchParams.get("fdi"), personA);
  // The fragment stays consumable by the canonical parser shape:
  // decodeURIComponent JSON carrying the pairing token and commserver URL.
  const fragment = JSON.parse(decodeURIComponent(parsed.hash.slice(1))) as Record<string, unknown>;
  assert.equal(fragment.mode, "IoM");
  assert.equal(fragment.token, invite.token);
  assert.equal(String(fragment.url), commServerUrl);
  const payload = decodeIoMInvite(invite.invitationUrl);
  assert.equal(payload.mode, "IoM");
  assert.equal(payload.deviceEnrollmentPersonId, personA);
  assert.equal(payload.email, "seller@ek.local");
  assert.equal(payload.identityRelation, "same-person");
  assert.equal(payload.pairingMode, "primed");

  const paired = deviceA.client.call("ekLab", "awaitIoMInvite", { token: invite.token, timeoutMs: 60_000 });
  await deviceB.client.call("ekLab", "acceptIoMInvite", { invitationUrl: invite.invitationUrl, timeoutMs: 60_000 });
  await paired;

  // Under full-suite load CHUM replication lags; poll the real condition.
  const deadline = Date.now() + 90_000;
  let view: { known?: boolean; roles?: string[] } | undefined;
  while (Date.now() < deadline) {
    view = await deviceB.client.call("ekLab", "getDepartment", { department: "ek-de" }) as typeof view;
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
    params: Record<string, string> = { fe: "seller@ek.local", fdi: "1".repeat(64) },
    path = "/invites/inviteDevice/",
  ): string => {
    const url = new URL(`http://x${path}`);
    url.searchParams.set("invited", "true");
    url.searchParams.set("connectionMode", "primed");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.hash = encodeURIComponent(JSON.stringify({ ...fragment, ...fragmentOverride }));
    return url.toString();
  };
  assert.equal(decodeIoMInvite(encode()).deviceEnrollmentPersonId, fragment.deviceEnrollmentPersonId);
  // A bare invitedevice path without an embedded mode still resolves to IoM.
  const { mode: _dropped, ...noMode } = fragment;
  assert.equal(decodeIoMInvite(encode(noMode)).mode, "IoM");
  const cases: [string, string][] = [
    ["missing payload", "http://x/invites/inviteDevice/?invited=true"],
    ["wrong mode path", encode({}, { fe: "seller@ek.local" }, "/invites/invitePartner/")],
    ["wrong embedded mode", encode({ mode: "IoP" })],
    ["path payload conflict", encode({ mode: "IoP" }, { fe: "seller@ek.local" }, "/invites/inviteDevice/")],
    ["bad rendezvous", encode({ url: "http://x/y" })],
    ["bad token", encode({ token: "short" })],
    ["bad public key", encode({ publicKey: "short" })],
    ["protocol mismatch", encode({ pairingProtocolVersion: 999 })],
    ["not primed", encode({ pairingMode: "standard" })],
    ["not same-person", encode({ identityRelation: "distinct-person" })],
    ["bad person", encode({}, { fe: "seller@ek.local", fdi: "xyz" })],
    ["person conflict", encode({}, { fe: "seller@ek.local", fdi: "2".repeat(64) })],
    ["bad email", encode({}, { fe: "not-an-email" })],
    ["missing email", encode({}, {})],
  ];
  for (const [name, url] of cases) {
    assert.throws(() => decodeIoMInvite(url), /not a lab IoM invitation/, name);
  }
});

test("a different person is refused before any network traffic", async (t) => {
  const localRoot = await mkdtemp(path.join(tmpdir(), "ek-lab-iom-"));
  const commserver = await startCommServer();
  const deviceA = spawnInstance("seller", path.join(localRoot, "stranger-a"));
  const stranger = spawnInstance("customer", path.join(localRoot, "stranger-c"));
  t.after(async () => {
    await Promise.all([deviceA.worker.terminate(), stranger.worker.terminate()]);
    await stopCommServer(commserver);
    await removeTree(localRoot);
  });
  await Promise.all([deviceA.ready, stranger.ready]);

  const invite = await deviceA.client.call("ekLab", "createIoMInvite", {}) as { invitationUrl: string };
  await assert.rejects(
    stranger.client.call("ekLab", "acceptIoMInvite", { invitationUrl: invite.invitationUrl }),
    /different person/,
  );
});
