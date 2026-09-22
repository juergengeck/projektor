// packages/lab.core/worker/lab-instance.ts
/**
 * One ONE instance per worker realm. The caller loads the one.core platform
 * (browser or nodejs) before importing this module's dependencies' side
 * effects run; this module only composes models, the refinio.api registry,
 * the `lab:` dialer and the feed-forward stream on the given port.
 *
 * Boot is lazy: the shell registers the `session`/`ui`/`onecore` plans and
 * the `chum-accept` listener immediately, then waits. `credentials` signs in
 * eagerly (today's worker behavior); without them the host drives
 * `session.registerAndSetup` / `ui.acceptPendingInvitation` through the
 * registry, which is how invite seeding (D3) boots roles one by one.
 */
import MultiUser from "../../../../one/packages/one.models/lib/models/Authenticator/MultiUser.js";
import LeuteModel from "../../../../one/packages/one.models/lib/models/Leute/LeuteModel.js";
import ChannelManager from "../../../../one/packages/one.models/lib/models/ChannelManager.js";
import TopicModel from "../../../../one/packages/one.models/lib/models/Chat/TopicModel.js";
import ConnectionsModel from "../../../../one/packages/one.models/lib/models/ConnectionsModel.js";
import Connection from "../../../../one/packages/one.models/lib/misc/Connection/Connection.js";
import MessagePortPlugin from "../../../../one/packages/one.models/lib/misc/Connection/plugins/MessagePortPlugin.js";
import PromisePlugin from "../../../../one/packages/one.models/lib/misc/Connection/plugins/PromisePlugin.js";
import { registerConnectionDialer } from "../../../../one/packages/one.models/lib/misc/ConnectionEstablishment/ConnectionDialers.js";
import { PAIRING_PROTOCOL_VERSION } from "../../../../one/packages/one.models/lib/misc/ConnectionEstablishment/PairingManager.js";
import { objectEvents } from "../../../../one/packages/one.models/lib/misc/ObjectEventDispatcher.js";
import RecipesStable from "../../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import { ReverseMapsStable, ReverseMapsForIdObjectsStable } from "../../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } from "../../../../one/packages/one.models/lib/recipes/reversemaps-experimental.js";
import { onVersionedObj } from "../../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { getInstanceIdHash, getInstanceOwnerIdHash } from "../../../../one/packages/one.core/lib/instance.js";
import { OperationRegistry } from "../../../../one/packages/refinio.api/dist/src/registry/index.js";
import { IpcTransport } from "../../../../one/packages/refinio.api/dist/src/transports/IpcTransport.js";
import { OneConnectionPlan } from "../../../../one/packages/refinio.api/dist/src/plans/OneConnectionPlan.js";
import { AccessRightsRecipes } from "../../../../one/packages/refinio.api/dist/src/helpers/AccessRightsHelper.js";
import { createLabRecipes } from "../recipes.ts";
import { createLabPlan } from "../lab-plan.ts";
import { createChatPlan } from "../chat-plan.ts";
import { DEFAULT_COMM_SERVER_URL } from "../iom.ts";
import { decodeMeshInvite, inviteMode } from "../invite-url.ts";
import { createSessionPlans } from "../session-plan.ts";
import type { BootedInstance } from "../session-plan.ts";
import { createPortIpcMain, postFeed } from "../port-ipc.ts";
import type { LabPort } from "../port-ipc.ts";
import type { LabBrand } from "../brand.ts";
import type { Recipe } from "../../../../one/packages/one.core/lib/recipes.js";
import { labUrl } from "../invite-url.ts";

export { labUrl };

// Framework reverse-map tables are keyed by its closed type-name unions;
// lab tables add custom names. Merging is key-wise disjoint in practice,
// so the boundary cast below documents that instead of pretending membership.
function merge(...sources: Array<Iterable<readonly [PropertyKey, Set<string>]>>): Map<PropertyKey, Set<string>> {
  const merged = new Map<PropertyKey, Set<string>>();
  for (const source of sources) {
    for (const [type, props] of source) merged.set(type, new Set([...(merged.get(type) ?? []), ...props]));
  }
  return merged;
}

export interface LabInstanceOptions {
  brand: LabBrand;
  port: LabPort;
  key: string;
  directory: string;
  createMessageChannel: () => MessageChannel;
  /** Commserver carrying IoM discovery and pairing; defaults to the glue service. */
  commServerUrl?: string;
  /** Lane entry URL prefix the QR-encoded IoM invitation links back to. */
  appBaseUrl?: string;
  /**
   * Eager sign-in (today's worker behavior): boot completes before `ready`.
   * Absent, the shell waits for `session.registerAndSetup` through the
   * registry and posts `ready` unbooted.
   */
  credentials?: { email: string; secret: string; instanceName: string };
}

interface AcceptMessage {
  kind: string;
  url?: string;
  port?: unknown;
}

export async function startLabInstance({ brand, port, key, directory, createMessageChannel, commServerUrl, appBaseUrl, credentials }: LabInstanceOptions): Promise<{
  shutdown(): Promise<void>;
  /** Direct registry dispatch for same-realm callers (the lane app bridge). */
  call(plan: string, method: string, params?: unknown): Promise<unknown>;
}> {
  const label = brand.label;
  const { recipes: labRecipes, reverseMapsForIdObjects: labReverseMaps } = createLabRecipes(brand);
  const url = labUrl(key);
  const registry = new OperationRegistry();
  let acceptExternal: ((port: MessagePort) => void) | null = null;
  const pendingAccepts: MessagePort[] = [];
  let tornDown: (() => Promise<void>) | null = null;

  // Install the accept side before anything can dial us. Accepts that arrive
  // before boot are queued, never dropped: a transferred MessagePort has no
  // replay, and the host only routes after `routing-ready` below.
  port.addEventListener("message", event => {
    const message = event.data as AcceptMessage;
    if (message?.kind !== "chum-accept") return;
    if (message.url !== url) throw new Error(`Lab ${key}: accept for foreign url ${message.url}.`);
    const incoming = message.port as MessagePort;
    if (acceptExternal) acceptExternal(incoming);
    else pendingAccepts.push(incoming);
  });
  // The host must not transfer a dial before the listener above exists. This
  // separate readiness phase prevents restored peers from racing one another
  // during browser startup (and losing a MessagePort before it can be accepted).
  port.postMessage({ kind: "routing-ready", key });

  const boot = async ({ email, secret }: { email: string; secret: string; instanceName: string }): Promise<BootedInstance> => {
    const multiUser = new MultiUser({
      directory,
      // AccessRightsRecipes registers the pairing audit certificate that
      // OneConnectionPlan.connectWithInvite mints via grantAccessRightsAfterPairing.
      // Without it every pairing throws (node) or logs SVO-SO2 noise (browser).
      recipes: [...RecipesStable, ...RecipesExperimental, ...AccessRightsRecipes, ...(labRecipes as unknown as Recipe[])],
      reverseMaps: merge(ReverseMapsStable, ReverseMapsExperimental),
      reverseMapsForIdObjects: merge(ReverseMapsForIdObjectsStable, ReverseMapsForIdObjectsExperimental, labReverseMaps),
    });
    await multiUser.loginOrRegister(email, secret, key);
    await objectEvents.init();

    // The instance endpoint published in our profile is the lab URL: peers'
    // outgoing routes dial it through the `lab:` dialer below.
    const leuteModel = new LeuteModel(url, true);
    const channelManager = new ChannelManager(leuteModel);
    const connections = new ConnectionsModel(leuteModel, {
      commServerUrl: url,
      publicCommServerUrl: url,
      // catchAll pre-registers this worker's credential for the lab:// listener at
      // init (pairing itself stays demand-driven and invite-gated). Without it the
      // external listener has no local credential until the first createInvite,
      // so waitForIncomingConnectionReady — and any early accept — would fail.
      incomingConnectionConfigurations: [{ type: "external", url, catchAll: true }],
      acceptIncomingConnections: true,
      acceptUnknownInstances: false,
      acceptUnknownPersons: false,
      allowPairing: true,
      allowDebugRequests: false,
      pairingTokenExpirationDuration: 600_000,
      establishOutgoingConnections: true,
      noImport: false,
      noExport: false,
    });
    await leuteModel.init();
    await channelManager.init();
    await connections.init();
    await connections.waitForIncomingConnectionReady();

    // OneConnectionPlan.connectWithInvite rebuilds its invitation from
    // {url, publicKey, token} and drops pairingProtocolVersion, which
    // PairingManager.connectUsingInvitation asserts. Restore the local protocol
    // version on the way through (instance-only; the wire token already carries it).
    const pairing = connections.pairing as unknown as {
      connectUsingInvitation(invitation: Record<string, unknown>, ...rest: unknown[]): Promise<unknown>;
    };
    const connectUsingInvitation = pairing.connectUsingInvitation.bind(pairing);
    pairing.connectUsingInvitation = (invitation: Record<string, unknown>, ...rest: unknown[]) =>
      connectUsingInvitation({ pairingProtocolVersion: PAIRING_PROTOCOL_VERSION, ...invitation }, ...rest);

    // IoM discovery and pairing ride a commserver (browsers cannot listen and
    // the mesh lab:// endpoints are unreachable across devices) through a
    // dedicated connections model whose pairing listener lives there. The mesh
    // above stays on the local lab:// switch: hermetic, offline-capable, fast.
    // Initialized eagerly like the mesh model; init registers no routes and
    // dials nothing — the commserver socket opens on first pairing use.
    const iomCommServer = commServerUrl ?? DEFAULT_COMM_SERVER_URL;
    const iomConnections = new ConnectionsModel(leuteModel, {
      commServerUrl: iomCommServer,
      publicCommServerUrl: iomCommServer,
      acceptIncomingConnections: true,
      acceptUnknownInstances: false,
      acceptUnknownPersons: false,
      allowPairing: true,
      allowDebugRequests: false,
      pairingTokenExpirationDuration: 600_000,
      establishOutgoingConnections: true,
      noImport: false,
      noExport: false,
    });
    await iomConnections.init();
    const iomPairing = iomConnections.pairing as unknown as {
      connectUsingInvitation(invitation: Record<string, unknown>, ...rest: unknown[]): Promise<unknown>;
    };
    const iomConnectUsingInvitation = iomPairing.connectUsingInvitation.bind(iomPairing);
    iomPairing.connectUsingInvitation = (invitation: Record<string, unknown>, ...rest: unknown[]) =>
      iomConnectUsingInvitation({ pairingProtocolVersion: PAIRING_PROTOCOL_VERSION, ...invitation }, ...rest);

    const unregisterDialer = registerConnectionDialer("lab:", (target: string) => {
      const { port1, port2 } = createMessageChannel();
      port.postMessage({ kind: "chum-dial", from: key, url: target, port: port2 }, [port2]);
      return Connection.fromPlugin(new MessagePortPlugin(port1));
    });

    acceptExternal = (incomingPort: MessagePort) => {
      // The outgoing side gains its PromisePlugin in connectWithEncryption; the
      // accepted side needs it added explicitly (websocket listeners do the same).
      const incoming = Connection.fromPlugin(new MessagePortPlugin(incomingPort));
      incoming.addPlugin(new PromisePlugin());
      connections.acceptExternalConnection(incoming, url)
        .catch(error => port.postMessage({ kind: "chum-accept-failed", key, error: (error as Error).message }));
    };
    for (const queued of pendingAccepts.splice(0)) acceptExternal(queued);

    // Connection routes are demand-driven. Pairing records demand for the live
    // generation, but that in-memory demand intentionally is not persisted by
    // one.models. The lab is an always-connected four-instance topology, so
    // restore that product-level intent from its persisted peer endpoints on
    // every boot. A global enable only starts routes that are already
    // materialized; it cannot recreate this missing demand.
    // (The browser never hits this path with stale state: it boots workers
    // into session-scoped directories, so every page load is a fresh boot.
    // The restart regression test in lab.integration.test.ts guards this path
    // for persistent workers instead.)
    const persistedPeerIds = new Set(
      (await leuteModel.findAllOneInstanceEndpointsForOthers()).map(endpoint => endpoint.personId),
    );
    await Promise.all(
      [...persistedPeerIds].map(personId => connections.enableConnectionsToPerson(personId)),
    );

    const plan = createLabPlan({
      brand,
      connections,
      iomConnections,
      email,
      appBaseUrl: appBaseUrl ?? "http://localhost/",
    });
    // Chat rides the commserver channel stack every ONE app uses: 1:1 topics
    // between lane persons, synced over the mesh connections.
    const topicModel = new TopicModel(channelManager, leuteModel);
    await topicModel.init();
    const chatPlan = createChatPlan({
      brand,
      topicModel,
      channelManager,
      self: () => {
        const owner = getInstanceOwnerIdHash();
        if (!owner) throw new Error(`${label}: instance has no owner.`);
        return owner;
      },
      notify: (peer, message) => postFeed(port, {
        type: `${brand.typePrefix}Chat`, id: peer, hash: message.id, kind: "chat",
        obj: { incoming: message.incoming },
      }),
    });
    registry.register("lab", plan, {
      description: `${label} department operations over ONE storage`,
      methods: ["whoAmI", "createDepartment", "assignRole", "publishContact", "publishOffer", "stockUp", "shareOffer", "shareOfferWithSeller", "placeOrder", "buy", "admitOrder", "getDepartment", "setOnline", "createIoMInvite", "awaitIoMInvite", "acceptIoMInvite"]
        .map(name => ({ name, description: `lab.${name}` })),
    });
    registry.register("chat", chatPlan, {
      description: `${label} 1:1 chat over topic channels`,
      methods: ["openChat", "sendChat", "readChat"]
        .map(name => ({ name, description: `chat.${name}` })),
    });
    // The lane pairs over two transports: the local lab:// mesh above and the
    // commserver for IoM below. The status surface covers both, so the IoM
    // link is visible next to the mesh lanes.
    const connectionPlan = new OneConnectionPlan(leuteModel, connections, channelManager);
    const meshListConnections = connectionPlan.listConnections.bind(connectionPlan);
    connectionPlan.listConnections = () => [
      ...meshListConnections(),
      ...(iomConnections.connectionsInfo() as unknown as {
        id: string;
        remotePersonId: string;
        remoteInstanceId: string;
        isOnline: boolean;
        established: string;
      }[]).map(conn => ({
        connectionId: conn.id,
        remotePersonId: conn.remotePersonId,
        remoteInstanceId: conn.remoteInstanceId,
        isOnline: conn.isOnline,
        established: conn.established,
      })),
    ];
    registry.register("connection", connectionPlan, {
      description: "Pairing and connection status",
      methods: ["createInvite", "connectWithInvite", "listConnections", "getStatus"].map(name => ({ name, description: `connection.${name}` })),
    });

    // Feed-forward fires on the semantic versioned-object event, which is
    // dispatched after the version head is selected. The bytes-available event
    // (onVersionedObjStored) fires while CHUM is still materializing the version
    // graph, so rows derived from it are not yet readable via getObjectByIdHash.
    const stopFeed = onVersionedObj.addListener(result => {
      const row = plan.feedRow(result);
      if (row) postFeed(port, row);
      void plan.processAutomaticPurchase(result).catch(error => {
        console.error(`${label}: automatic purchase processing failed.`, error);
      });
    });
    // Semantic object events are live-only. Replay the seller's typed request
    // roots once after attaching the listener so a crash between request
    // persistence and admission cannot leave a purchase pending forever.
    await plan.recoverAutomaticPurchases();

    const ownerId = getInstanceOwnerIdHash();
    if (!ownerId) throw new Error(`${label}: instance has no owner after boot.`);
    const instanceId = getInstanceIdHash();
    if (!instanceId) throw new Error(`${label}: instance has no id after boot.`);
    port.postMessage({ kind: "ready", key, person: ownerId });

    tornDown = async () => {
      stopFeed();
      unregisterDialer();
      await topicModel.shutdown();
      await iomConnections.shutdown();
      await connections.shutdown();
      await channelManager.shutdown();
      await leuteModel.shutdown();
      await multiUser.logout();
    };

    return {
      ownerId,
      instanceId,
      instanceName: key,
      connectWithInvite: async (invitationUrl: string): Promise<void> => {
        const mode = inviteMode(invitationUrl, brand);
        if (mode === "IoM") {
          await plan.acceptIoMInvite({ invitationUrl });
          return;
        }
        const invite = decodeMeshInvite(invitationUrl, brand);
        await connectionPlan.connectWithInvite({
          url: invite.url,
          publicKey: invite.publicKey,
          token: invite.token,
          pairingMode: invite.pairingMode,
        });
      },
    };
  };

  const { session, ui, onecore } = createSessionPlans({ boot });
  registry.register("session", session, {
    description: `${label} sign-in lifecycle`,
    methods: ["registerAndSetup", "loginAndInit", "waitUntilReady"].map(name => ({ name, description: `session.${name}` })),
  });
  registry.register("ui", ui, {
    description: `${label} invite entry`,
    methods: ["getInviteState", "loadPendingInvitation", "acceptPendingInvitation"].map(name => ({ name, description: `ui.${name}` })),
  });
  registry.register("onecore", onecore, {
    description: `${label} instance status`,
    methods: ["getStatus"].map(name => ({ name, description: `onecore.${name}` })),
  });
  new IpcTransport(registry).register(createPortIpcMain(port));

  if (credentials) {
    // Eager path: boot completes before `ready`, exactly as before.
    await session.registerAndSetup(credentials);
  } else {
    // Lazy path: the shell is alive for session/ui/onecore calls; `ready`
    // carries no person until boot posts it.
    port.postMessage({ kind: "ready", key });
  }

  const call = async (plan: string, method: string, params?: unknown): Promise<unknown> => {
    const result = await registry.execute(plan, method, params ?? {});
    return (result as { product?: unknown }).product;
  };

  return {
    async shutdown() {
      if (tornDown) await tornDown();
    },
    call,
  };
}
