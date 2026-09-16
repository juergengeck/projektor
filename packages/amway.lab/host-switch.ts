// packages/amway.lab/host-switch.ts
/**
 * The web host's only job between workers: switch `lab:` dials to the
 * target worker's port. Shared by the node integration test and the browser
 * LabHost; it never reads Amway data.
 */
import { PortApiClient } from "./port-ipc.ts";
import type { LabPort } from "./port-ipc.ts";

export interface SpawnedWorker {
  port: LabPort;
  terminate(): Promise<unknown> | unknown;
  onError(callback: (error: Error) => void): void;
}

interface ControlMessage {
  kind: string;
  key?: string;
  person?: string;
  error?: string;
  from?: string;
  url?: string;
  port?: MessagePort;
}

interface DialMessage {
  from: string;
  url: string;
  port: MessagePort;
}

export interface LabHost<K extends string = string> {
  clients: Record<K, PortApiClient>;
  persons: Record<K, string>;
  setSwitch(key: K, value: boolean): void;
  pairAll(): Promise<void>;
  stop(): Promise<void>;
}

export async function startLabHost<K extends string>({ keys, spawn }: {
  keys: K[];
  spawn: (key: K) => SpawnedWorker;
}): Promise<LabHost<K>> {
  const workers = new Map<string, SpawnedWorker>();
  const open = new Map<string, boolean>(keys.map(key => [key, true]));
  const routable = new Map<string, boolean>(keys.map(key => [key, false]));
  const pendingDials = new Map<string, DialMessage[]>(keys.map(key => [key, []]));
  const clients = {} as Record<K, PortApiClient>;
  const persons = {} as Record<K, string>;

  const ready = keys.map(key => new Promise<void>((resolve, reject) => {
    const handle = spawn(key);
    const client = new PortApiClient(handle.port);
    workers.set(key, handle);
    clients[key] = client;
    handle.onError(error => {
      client.fail(error);
      reject(error);
    });
    client.onControl(message => {
      // Control traffic arrives on the owning worker's own port, so the
      // closure key — not the message body — identifies the sender.
      const msg = message as ControlMessage;
      if (msg?.kind === "routing-ready") {
        routable.set(key, true);
        flushDials(key);
      } else if (msg?.kind === "ready") {
        if (typeof msg.person !== "string") return;
        persons[key] = msg.person;
        resolve();
      } else if (msg?.kind === "boot-failed") {
        reject(new Error(`Lab ${key} failed to boot: ${msg.error}`));
      } else if (msg?.kind === "chum-accept-failed") {
        // A competing persisted route can win while the other is still being
        // accepted. ConnectionsModel owns that retry/replacement lifecycle;
        // throwing here only turns an internally handled race into an uncaught
        // window error and can strand unrelated startup work.
        console.warn(`Lab ${key} rejected an incoming connection: ${msg.error}`);
      } else if (msg?.kind === "chum-dial") {
        switchDial(msg as unknown as DialMessage);
      }
    });
  }));

  function deliverDial({ from, url, port }: DialMessage, target: string): void {
    const handle = workers.get(target);
    if (!handle || !open.get(target) || !open.get(from)) {
      port.postMessage({ t: "close", reason: `lab host: ${target} unreachable from ${from}` });
      port.close();
      return;
    }
    handle.port.postMessage({ kind: "chum-accept", url, port }, [port]);
  }

  function flushDials(target: string): void {
    const queued = pendingDials.get(target) ?? [];
    pendingDials.set(target, []);
    for (const dial of queued) deliverDial(dial, target);
  }

  function switchDial(dial: DialMessage): void {
    const { from, url, port } = dial;
    const target = new URL(url).host;
    const handle = workers.get(target);
    if (!handle || !open.get(target) || !open.get(from)) {
      port.postMessage({ t: "close", reason: `lab host: ${target} unreachable from ${from}` });
      port.close();
      return;
    }
    // Workers restore persisted routes independently. A fast worker can dial a
    // slower peer before that peer has installed its chum-accept listener. A
    // transferred MessagePort has no replay, so hold it here until the target
    // explicitly announces that the listener exists.
    if (!routable.get(target)) {
      pendingDials.get(target)?.push(dial);
      return;
    }
    deliverDial(dial, target);
  }

  await Promise.all(ready);

  return {
    clients,
    persons,
    setSwitch(key: string, value: boolean) {
      if (!open.has(key)) throw new Error(`Lab host: unknown worker ${key}.`);
      open.set(key, value);
    },
    async pairAll() {
      for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
          // Primed pairing reuses the authenticated socket for CHUM instead
          // of closing it and dialing a second connection. The mode lives on
          // the invitation: createInvite sets it, and the acceptor hands the
          // invitation through unchanged — no second knob to disagree.
          const invite = await clients[keys[i]].call<{ url: string; publicKey: string; token: string; pairingMode?: string }>("connection", "createInvite", { mode: "primed" });
          await clients[keys[j]].call("connection", "connectWithInvite", {
            url: invite.url, publicKey: invite.publicKey, token: invite.token, pairingMode: invite.pairingMode,
          });
        }
      }
    },
    async stop() {
      for (const [target, queued] of pendingDials) {
        for (const { from, port } of queued) {
          port.postMessage({ t: "close", reason: `lab host stopped before ${target} became reachable from ${from}` });
          port.close();
        }
      }
      await Promise.all([...workers.values()].map(handle => handle.terminate()));
    },
  };
}
