// packages/lab.core/iom.test.ts
/**
 * IoM device pairing through a commserver.
 *
 * Two seller instances hold the same Person (same deterministic lab email,
 * separate storage directories) on separate worker runtimes. Instance A
 * restores grant-free persisted domain roots and creates a same-person pairing
 * invitation (registering its pairing listener
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
import { startLabHost } from "./worker/host-switch.ts";
import { labTypes } from "./recipes.ts";

const brand = testBrand();
const COMM_SERVER_PORT = Number(process.env.LAB_IOM_PORT ?? commServerPortFor(brand));
const laneEntry = `/lab/${brand.lane}`;

/** Fixed lane logins: the same email always reproduces the same Person. */
const loginFor = (key: string) => ({ email: `${key}@${brand.emailDomain}`, secret: `lab-${key}`, instanceName: key });

let root = "";
let commServerUrl = "";

function spawnWorker(key: string, directory: string) {
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
  return { worker, port };
}

function spawnInstance(key: string, directory: string) {
  const { worker, port } = spawnWorker(key, directory);
  const client = new PortApiClient(port);
  // Shells post `ready` unbooted; sign-in runs through the session plan below.
  const ready = new Promise<void>((resolve, reject) => {
    const off = client.onControl(message => {
      const msg = message as { kind?: string };
      if (msg?.kind === "ready") {
        off();
        resolve();
      }
    });
    worker.on("error", reject);
  });
  return { worker, client, ready, port };
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

test("boot restores owner access to persisted roots before same-person IoM pairing", async (t) => {
  root = await mkdtemp(path.join(tmpdir(), `${brand.storagePrefix}-iom-`));

  const commserver = await startCommServer(COMM_SERVER_PORT);
  commServerUrl = commserver.url;

  const workers: Worker[] = [];
  t.after(async () => {
    await Promise.all(workers.map(worker => worker.terminate()));
    await settle();
    await commserver.stop();
    await removeTree(root);
  });
  const history = new Worker(new URL("./test/iom-history-worker.ts", import.meta.url), {
    workerData: { brand: brand.id, directory: path.join(root, "device-a") },
  });
  workers.push(history);
  try {
    await new Promise<void>((resolve, reject) => {
      const guard = setTimeout(() => reject(new Error("grant-free history fixture did not finish")), 30_000);
      history.once("message", () => { clearTimeout(guard); resolve(); });
      history.once("error", error => { clearTimeout(guard); reject(error); });
    });
  } finally {
    await history.terminate();
  }

  const deviceA = spawnInstance("seller", path.join(root, "device-a"));
  const deviceB = spawnInstance("seller", path.join(root, "device-b"));
  workers.push(deviceA.worker, deviceB.worker);
  await Promise.all([deviceA.ready, deviceB.ready]);
  const setupA = await deviceA.client.call<{ readyState: { ownerId: string | null } }>("session", "registerAndSetup", loginFor("seller"));
  const setupB = await deviceB.client.call<{ readyState: { ownerId: string | null } }>("session", "registerAndSetup", loginFor("seller"));
  const personA = setupA.readyState.ownerId;
  const personB = setupB.readyState.ownerId;
  assert.ok(personA && personB, "both devices boot with an owner");
  assert.equal(personB, personA, "same email reproduces the same Person on the second device");

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

  const view = await departmentUntil(deviceB.client, view => view.known && view.roles?.includes("seller"), "second device receives department and seller role");
  assert.equal(view.known, true, "department replicates to the second device");
  assert.ok(view.roles?.includes("seller"), "seller role projects on the second device");

  const connections = await deviceA.client.call("connection", "listConnections", {}) as { remotePersonId?: string }[];
  assert.ok(
    connections.some(entry => entry.remotePersonId === personA),
    "inviter sees the joiner as the same person (native IoM condition)",
  );
});

interface DepartmentView {
  known: boolean;
  roles: string[];
  offers: { offerId: string; unitAmount: number }[];
  contacts: { person: string; name: string }[];
  orders: { idempotencyKey: string; quantity: number }[];
  availability: { stocked: number; available: number } | null;
}

/** A bounded deterministic watcher waits for the actual readable projection. */
async function departmentUntil(client: PortApiClient, predicate: (view: DepartmentView) => boolean, label: string): Promise<DepartmentView> {
  const deadline = Date.now() + 30_000;
  let view: DepartmentView;
  do {
    view = await client.call<DepartmentView>("lab", "getDepartment", { department: brand.department.id });
    if (predicate(view)) return view;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw new Error(`${label}: ${JSON.stringify(view)}`);
}

test("IoM forwards received mesh content historically and live in both directions", async (t) => {
  const localRoot = await mkdtemp(path.join(tmpdir(), `${brand.storagePrefix}-iom-mesh-`));
  const commserver = await startCommServer(COMM_SERVER_PORT);
  commServerUrl = commserver.url;
  const host = await startLabHost({
    keys: ["admin", "manager", "seller", "customer"],
    spawn(key) {
      const instance = spawnWorker(key, path.join(localRoot, key));
      return { port: instance.port, terminate: () => instance.worker.terminate(), onError: listener => instance.worker.on("error", listener) };
    },
  });
  const deviceB = spawnInstance("seller", path.join(localRoot, "seller-device-b"));
  t.after(async () => {
    await Promise.all([host.stop(), deviceB.worker.terminate()]);
    await commserver.stop();
    await removeTree(localRoot);
  });
  await deviceB.ready;
  const people: Record<string, string> = {};
  for (const key of ["admin", "manager", "seller", "customer"]) {
    const setup = await host.clients[key].call<{ readyState: { ownerId: string } }>("session", "registerAndSetup", loginFor(key));
    people[key] = setup.readyState.ownerId;
  }
  const setupB = await deviceB.client.call<{ readyState: { ownerId: string } }>("session", "registerAndSetup", loginFor("seller"));
  assert.equal(setupB.readyState.ownerId, people.seller);
  await host.pairAll();
  const { admin, manager, seller, customer } = host.clients;
  const receivedA: string[] = [];
  const receivedB: string[] = [];
  const privateStaffContacts: string[] = [];
  const stopStaff = [admin, manager].map((client, index) => client.onFeed(row => {
    if (row.type === labTypes(brand).Contact && row.id === people.customer) privateStaffContacts.push(index === 0 ? "admin" : "manager");
  }));
  const stopA = seller.onFeed(row => receivedA.push(row.type));
  const stopB = deviceB.client.onFeed(row => receivedB.push(row.type));
  t.after(() => { stopA(); stopB(); for (const stop of stopStaff) stop(); });
  const stockType = labTypes(brand).StockReceipt;
  const department = brand.department.id;
  await admin.call("lab", "createDepartment", { department, name: brand.department.name });
  await admin.call("lab", "assignRole", { department, subject: people.manager, role: "manager" });
  await departmentUntil(manager, view => view.roles?.includes("manager"), "manager receives appointment");
  if (brand.appointmentAuthority === "admin") {
    await admin.call("lab", "assignRole", { department, subject: people.customer, role: "customer" });
    await departmentUntil(customer, view => view.roles?.includes("customer"), "customer receives early appointment");
    await customer.call("lab", "publishContact", { department, name: "Early customer", role: "customer" });
  }
  await (brand.appointmentAuthority === "admin" ? admin : manager).call("lab", "assignRole", { department, subject: people.seller, role: "seller" });
  await departmentUntil(seller, view => view.roles?.includes("seller"), "first seller device receives appointment");
  if (brand.appointmentAuthority === "admin") {
    await departmentUntil(seller, view => view.contacts?.some(row => row.person === people.customer && row.name === "Early customer"),
      "late seller appointment discloses the customer-owned contact");
    const staff = await admin.call<DepartmentView>("lab", "getDepartment", { department });
    assert.equal(staff.contacts.some(row => row.person === people.customer), false, "private customer contact stays out of the staff directory");
  }
  await admin.call("lab", "stockUp", { department, receiptId: "iom-received-stock", quantity: 10 });
  const offer = { department, offerId: "iom-received-offer", item: "ITEM@1", priceList: "iom-test", unitAmount: 100, currency: "EUR" };
  await manager.call("lab", "publishOffer", offer);
  await manager.call("lab", "shareOfferWithSeller", { department, offerId: offer.offerId, seller: people.seller });
  await departmentUntil(seller, view => view.offers?.some(row => row.offerId === offer.offerId) && receivedA.includes(stockType),
    "first seller device receives offer and stock");

  const invite = await seller.call<{ invitationUrl: string; token: string }>("lab", "createIoMInvite", {});
  const paired = seller.call("lab", "awaitIoMInvite", { token: invite.token, timeoutMs: 60_000 });
  await deviceB.client.call("lab", "acceptIoMInvite", { invitationUrl: invite.invitationUrl, timeoutMs: 60_000 });
  await paired;
  const historical = await departmentUntil(deviceB.client, view => view.roles?.includes("seller") &&
    view.offers?.some(row => row.offerId === offer.offerId) && receivedB.includes(stockType),
  "second device receives historical department, assignments, offer and stock");
  assert.equal(historical.known, true);

  if (brand.id === "igm") {
    type AcceptanceView = DepartmentView & { acceptableOffers: string[]; offerAcceptances: { idempotencyKey: string; acceptedFrom: string; quantity: number }[] };
    await departmentUntil(deviceB.client, view => (view as AcceptanceView).acceptableOffers?.includes(offer.offerId),
      "second seller device receives share provenance required to accept");
    const accepted = await deviceB.client.call<{ idempotencyKey: string }>("lab", "acceptOffer", { department, offerId: offer.offerId, quantity: 3 });
    for (const [client, label] of [[seller, "original seller"], [manager, "upstream manager"], [admin, "admin"]] as const) {
      const view = await departmentUntil(client, view => (view as AcceptanceView).offerAcceptances?.some(row => row.idempotencyKey === accepted.idempotencyKey),
        `${label} receives second-device acceptance`);
      const row = (view as AcceptanceView).offerAcceptances.find(row => row.idempotencyKey === accepted.idempotencyKey)!;
      assert.equal(row.acceptedFrom, people.manager);
      assert.equal(row.quantity, 3);
    }
    assert.deepEqual(await seller.call("lab", "acceptOffer", { department, offerId: offer.offerId, quantity: 3 }), accepted,
      "retry from original device reuses the same persisted acceptance");
  }

  // Manager edits received content after the IoM connection is live.
  await manager.call("lab", "publishOffer", { ...offer, unitAmount: 250 });
  await departmentUntil(deviceB.client, view => view.offers?.some(row => row.offerId === offer.offerId && row.unitAmount === 250),
    "second device receives live offer edit through the first device");
  if (brand.appointmentAuthority !== "admin") {
    await deviceB.client.call("lab", "assignRole", { department, subject: people.customer, role: "customer" });
    await departmentUntil(customer, view => view.roles?.includes("customer"),
      "second seller device appointment forwards department and membership to the mesh customer");
  }
  await deviceB.client.call("lab", "shareOffer", { department, offerId: offer.offerId, customer: people.customer });
  await departmentUntil(customer, view => view.offers?.some(row => row.offerId === offer.offerId && row.unitAmount === 250),
    "second seller device shares a new offer through its first device to the mesh customer");

  const customerB = spawnInstance("customer", path.join(localRoot, "customer-device-b"));
  t.after(() => customerB.worker.terminate());
  await customerB.ready;
  await customerB.client.call("session", "registerAndSetup", loginFor("customer"));
  const customerInvite = await customer.call<{ invitationUrl: string; token: string }>("lab", "createIoMInvite", {});
  const customerPaired = customer.call("lab", "awaitIoMInvite", { token: customerInvite.token, timeoutMs: 60_000 });
  await customerB.client.call("lab", "acceptIoMInvite", { invitationUrl: customerInvite.invitationUrl, timeoutMs: 60_000 });
  await customerPaired;
  await departmentUntil(customerB.client, view => view.roles?.includes("customer") && view.offers?.some(row => row.offerId === offer.offerId),
    "second customer device receives membership and shared offer");
  await customerB.client.call("lab", "buy", { department, offer: offer.offerId, quantity: 2, idempotencyKey: "iom-customer-b-buy" });
  await departmentUntil(seller, view => view.orders?.some(row => row.idempotencyKey === "iom-customer-b-buy"),
    "second customer device purchase reaches the mesh seller for automatic admission");
  await departmentUntil(customerB.client, view => view.orders?.some(row => row.idempotencyKey === "iom-customer-b-buy"),
    "admission returns through the first customer device to the second");

  // The first contact originates on B: A has no older audience grant to reuse.
  await deviceB.client.call("lab", "publishContact", { department, name: "Device B", role: "seller" });
  await departmentUntil(seller, view => view.contacts?.some(row => row.person === people.seller && row.name === "Device B"),
    "first device receives second device write");
  await departmentUntil(manager, view => view.contacts?.some(row => row.person === people.seller && row.name === "Device B"),
    "first device forwards its own second-device contact to its mesh audience");
  await seller.call("lab", "publishContact", { department, name: "Device A", role: "seller" });
  await departmentUntil(deviceB.client, view => view.contacts?.some(row => row.person === people.seller && row.name === "Device A"),
    "second device receives first device write");
  assert.deepEqual(privateStaffContacts, [], "private customer contact never enters admin or manager storage via the raw feed");
});

test("an IoM manager's new offer forwards through its first device to the admin", async (t) => {
  const localRoot = await mkdtemp(path.join(tmpdir(), `${brand.storagePrefix}-iom-manager-`));
  const commserver = await startCommServer(COMM_SERVER_PORT);
  commServerUrl = commserver.url;
  const host = await startLabHost({
    keys: ["admin", "manager"],
    spawn(key) {
      const instance = spawnWorker(key, path.join(localRoot, key));
      return { port: instance.port, terminate: () => instance.worker.terminate(), onError: listener => instance.worker.on("error", listener) };
    },
  });
  const deviceB = spawnInstance("manager", path.join(localRoot, "manager-device-b"));
  t.after(async () => {
    await Promise.all([host.stop(), deviceB.worker.terminate()]);
    await commserver.stop();
    await removeTree(localRoot);
  });
  await deviceB.ready;
  const people: Record<string, string> = {};
  for (const key of ["admin", "manager"]) {
    const setup = await host.clients[key].call<{ readyState: { ownerId: string } }>("session", "registerAndSetup", loginFor(key));
    people[key] = setup.readyState.ownerId;
  }
  await deviceB.client.call("session", "registerAndSetup", loginFor("manager"));
  await host.pairAll();
  const { admin, manager } = host.clients;
  const department = brand.department.id;
  await admin.call("lab", "createDepartment", { department, name: brand.department.name });
  await admin.call("lab", "assignRole", { department, subject: people.manager, role: "manager" });
  await departmentUntil(manager, view => view.roles?.includes("manager"), "first manager device receives appointment");
  const invite = await manager.call<{ invitationUrl: string; token: string }>("lab", "createIoMInvite", {});
  const paired = manager.call("lab", "awaitIoMInvite", { token: invite.token, timeoutMs: 60_000 });
  await deviceB.client.call("lab", "acceptIoMInvite", { invitationUrl: invite.invitationUrl, timeoutMs: 60_000 });
  await paired;
  await departmentUntil(deviceB.client, view => view.roles?.includes("manager"), "second manager device receives appointment");
  await deviceB.client.call("lab", "publishOffer", {
    department, offerId: "iom-manager-b-offer", item: "ITEM@1", priceList: "iom-test", unitAmount: 300, currency: "EUR",
  });
  await departmentUntil(manager, view => view.offers?.some(row => row.offerId === "iom-manager-b-offer"),
    "first manager device receives second device offer");
  await departmentUntil(admin, view => view.offers?.some(row => row.offerId === "iom-manager-b-offer"),
    "first manager device forwards its own second-device offer to admin");
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
  await deviceA.client.call("session", "registerAndSetup", loginFor("seller"));
  await stranger.client.call("session", "registerAndSetup", loginFor("customer"));

  const invite = await deviceA.client.call("lab", "createIoMInvite", {}) as { invitationUrl: string };
  await assert.rejects(
    stranger.client.call("lab", "acceptIoMInvite", { invitationUrl: invite.invitationUrl }),
    /different person/,
  );
});
