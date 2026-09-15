// packages/amway.lab/lab-instance.js
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
import { registerConnectionDialer } from "../../../one/packages/one.models/lib/misc/ConnectionEstablishment/ConnectionDialers.js";
import { objectEvents } from "../../../one/packages/one.models/lib/misc/ObjectEventDispatcher.js";
import RecipesStable from "../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import { ReverseMapsStable, ReverseMapsForIdObjectsStable } from "../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } from "../../../one/packages/one.models/lib/recipes/reversemaps-experimental.js";
import { onVersionedObjStored } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { getInstanceOwnerIdHash } from "../../../one/packages/one.core/lib/instance.js";
import { OperationRegistry } from "../../../one/packages/refinio.api/dist/src/registry/index.js";
import { IpcTransport } from "../../../one/packages/refinio.api/dist/src/transports/IpcTransport.js";
import { OneConnectionPlan } from "../../../one/packages/refinio.api/dist/src/plans/OneConnectionPlan.js";
import { AmwayLabRecipes, AmwayLabReverseMapsForIdObjects } from "./recipes.js";
import { createLabPlan } from "./lab-plan.js";
import { createPortIpcMain, postFeed } from "./port-ipc.js";

export const labUrl = key => `lab://${key}`;

function merge(...sources) {
  const merged = new Map();
  for (const source of sources) {
    for (const [type, props] of source) merged.set(type, new Set([...(merged.get(type) ?? []), ...props]));
  }
  return merged;
}

export async function startLabInstance({ port, key, email, secret, directory, createMessageChannel }) {
  const url = labUrl(key);
  const multiUser = new MultiUser({
    directory,
    recipes: [...RecipesStable, ...RecipesExperimental, ...AmwayLabRecipes],
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
    incomingConnectionConfigurations: [{ type: "external", url }],
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

  const unregisterDialer = registerConnectionDialer("lab:", target => {
    const { port1, port2 } = createMessageChannel();
    port.postMessage({ kind: "chum-dial", from: key, url: target, port: port2 }, [port2]);
    return Connection.fromPlugin(new MessagePortPlugin(port1));
  });

  const plan = createLabPlan({ connections });
  const registry = new OperationRegistry();
  registry.register("amwayLab", plan, {
    description: "Amway lab department operations over ONE storage",
    methods: ["whoAmI", "createDepartment", "assignRole", "publishContact", "publishOffer", "admitOrder", "getDepartment", "setOnline"]
      .map(name => ({ name, description: `amwayLab.${name}` })),
  });
  registry.register("connection", new OneConnectionPlan(leuteModel, connections, channelManager), {
    description: "Pairing and connection status",
    methods: ["createInvite", "connectWithInvite", "listConnections", "getStatus"].map(name => ({ name, description: `connection.${name}` })),
  });
  new IpcTransport(registry).register(createPortIpcMain(port));

  const stopFeed = onVersionedObjStored.addListener(result => {
    const row = plan.feedRow(result);
    if (row) postFeed(port, row);
  });

  port.addEventListener("message", event => {
    const message = event.data;
    if (message?.kind !== "chum-accept") return;
    if (message.url !== url) throw new Error(`Lab ${key}: accept for foreign url ${message.url}.`);
    connections.acceptExternalConnection(Connection.fromPlugin(new MessagePortPlugin(message.port)), url)
      .catch(error => port.postMessage({ kind: "chum-accept-failed", key, error: error.message }));
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
