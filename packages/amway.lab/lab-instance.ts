// packages/amway.lab/lab-instance.ts
/**
 * One ONE instance per worker realm. The caller loads the one.core platform
 * (browser or nodejs) before importing this module's dependencies' side
 * effects run; this module only composes models, the refinio.api registry,
 * the `lab:` dialer and the feed-forward stream on the given port.
 */
import MultiUser from "../../../one/packages/one.models/lib/models/Authenticator/MultiUser.js";
import LeuteModel from "../../../one/packages/one.models/lib/models/Leute/LeuteModel.js";
import ChannelManager from "../../../one/packages/one.models/lib/models/ChannelManager.js";
import ConnectionsModel from "../../../one/packages/one.models/lib/models/ConnectionsModel.js";
import Connection from "../../../one/packages/one.models/lib/misc/Connection/Connection.js";
import MessagePortPlugin from "../../../one/packages/one.models/lib/misc/Connection/plugins/MessagePortPlugin.js";
import PromisePlugin from "../../../one/packages/one.models/lib/misc/Connection/plugins/PromisePlugin.js";
import { registerConnectionDialer } from "../../../one/packages/one.models/lib/misc/ConnectionEstablishment/ConnectionDialers.js";
import { PAIRING_PROTOCOL_VERSION } from "../../../one/packages/one.models/lib/misc/ConnectionEstablishment/PairingManager.js";
import { objectEvents } from "../../../one/packages/one.models/lib/misc/ObjectEventDispatcher.js";
import RecipesStable from "../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import { ReverseMapsStable, ReverseMapsForIdObjectsStable } from "../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } from "../../../one/packages/one.models/lib/recipes/reversemaps-experimental.js";
import { onVersionedObj } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { getInstanceOwnerIdHash } from "../../../one/packages/one.core/lib/instance.js";
import { OperationRegistry } from "../../../one/packages/refinio.api/dist/src/registry/index.js";
import { IpcTransport } from "../../../one/packages/refinio.api/dist/src/transports/IpcTransport.js";
import { OneConnectionPlan } from "../../../one/packages/refinio.api/dist/src/plans/OneConnectionPlan.js";
import { AccessRightsRecipes } from "../../../one/packages/refinio.api/dist/src/helpers/AccessRightsHelper.js";
import { AmwayLabRecipes, AmwayLabReverseMapsForIdObjects } from "./recipes.ts";
import { createLabPlan } from "./lab-plan.ts";
import { createPortIpcMain, postFeed } from "./port-ipc.ts";
import type { LabPort } from "./port-ipc.ts";
import type { Recipe } from "../../../one/packages/one.core/lib/recipes.js";

export const labUrl = (key: string): string => `lab://${key}`;

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
  port: LabPort;
  key: string;
  email: string;
  secret: string;
  directory: string;
  createMessageChannel: () => MessageChannel;
}

interface AcceptMessage {
  kind: string;
  url?: string;
  port?: unknown;
}

export async function startLabInstance({ port, key, email, secret, directory, createMessageChannel }: LabInstanceOptions): Promise<{ shutdown(): Promise<void> }> {
  const url = labUrl(key);
  const multiUser = new MultiUser({
    directory,
    // AccessRightsRecipes registers the pairing audit certificate that
    // OneConnectionPlan.connectWithInvite mints via grantAccessRightsAfterPairing.
    // Without it every pairing throws (node) or logs SVO-SO2 noise (browser).
    recipes: [...RecipesStable, ...RecipesExperimental, ...AccessRightsRecipes, ...(AmwayLabRecipes as unknown as Recipe[])],
    reverseMaps: merge(ReverseMapsStable, ReverseMapsExperimental),
    reverseMapsForIdObjects: merge(ReverseMapsForIdObjectsStable, ReverseMapsForIdObjectsExperimental, AmwayLabReverseMapsForIdObjects),
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

  const unregisterDialer = registerConnectionDialer("lab:", (target: string) => {
    const { port1, port2 } = createMessageChannel();
    port.postMessage({ kind: "chum-dial", from: key, url: target, port: port2 }, [port2]);
    return Connection.fromPlugin(new MessagePortPlugin(port1));
  });

  // Install the accept side before activating any persisted peer routes.
  port.addEventListener("message", event => {
    const message = event.data as AcceptMessage;
    if (message?.kind !== "chum-accept") return;
    if (message.url !== url) throw new Error(`Lab ${key}: accept for foreign url ${message.url}.`);
    // The outgoing side gains its PromisePlugin in connectWithEncryption; the
    // accepted side needs it added explicitly (websocket listeners do the same).
    const incoming = Connection.fromPlugin(new MessagePortPlugin(message.port as MessagePort));
    incoming.addPlugin(new PromisePlugin());
    connections.acceptExternalConnection(incoming, url)
      .catch(error => port.postMessage({ kind: "chum-accept-failed", key, error: (error as Error).message }));
  });
  // The host must not transfer a dial before the listener above exists. This
  // separate readiness phase prevents restored peers from racing one another
  // during browser startup (and losing a MessagePort before it can be accepted).
  port.postMessage({ kind: "routing-ready", key });
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

  const plan = createLabPlan({ connections, listenerUrl: url, email });
  const registry = new OperationRegistry();
  registry.register("amwayLab", plan, {
    description: "Amway lab department operations over ONE storage",
    methods: ["whoAmI", "createDepartment", "assignRole", "publishContact", "publishOffer", "stockUp", "shareOffer", "shareOfferWithSeller", "placeOrder", "admitOrder", "getDepartment", "setOnline", "createIoMInvite", "awaitIoMInvite", "acceptIoMInvite"]
      .map(name => ({ name, description: `amwayLab.${name}` })),
  });
  registry.register("connection", new OneConnectionPlan(leuteModel, connections, channelManager), {
    description: "Pairing and connection status",
    methods: ["createInvite", "connectWithInvite", "listConnections", "getStatus"].map(name => ({ name, description: `connection.${name}` })),
  });
  new IpcTransport(registry).register(createPortIpcMain(port));

  // Feed-forward fires on the semantic versioned-object event, which is
  // dispatched after the version head is selected. The bytes-available event
  // (onVersionedObjStored) fires while CHUM is still materializing the version
  // graph, so rows derived from it are not yet readable via getObjectByIdHash.
  const stopFeed = onVersionedObj.addListener(result => {
    const row = plan.feedRow(result);
    if (row) postFeed(port, row);
  });

  port.postMessage({ kind: "ready", key, person: getInstanceOwnerIdHash() });

  return {
    async shutdown() {
      stopFeed();
      unregisterDialer();
      await connections.shutdown();
      await channelManager.shutdown();
      await leuteModel.shutdown();
      await multiUser.logout();
    },
  };
}
