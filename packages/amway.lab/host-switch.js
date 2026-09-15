// packages/amway.lab/host-switch.js
/**
 * The web host's only job between workers: switch `lab:` dials to the
 * target worker's port. Shared by the node integration test and the browser
 * LabHost; it never reads Amway data.
 */
import { PortApiClient } from "./port-ipc.js";

export async function startLabHost({ keys, spawn }) {
  const workers = new Map();
  const open = new Map(keys.map(key => [key, true]));
  const clients = {};
  const persons = {};

  const ready = keys.map(key => new Promise((resolve, reject) => {
    const handle = spawn(key);
    const client = new PortApiClient(handle.port);
    workers.set(key, handle);
    clients[key] = client;
    handle.onError(error => {
      client.fail(error);
      reject(error);
    });
    client.onControl(message => {
      if (message?.kind === "ready") {
        persons[key] = message.person;
        resolve();
      } else if (message?.kind === "boot-failed") {
        reject(new Error(`Lab ${key} failed to boot: ${message.error}`));
      } else if (message?.kind === "chum-accept-failed") {
        throw new Error(`Lab ${key} rejected an incoming connection: ${message.error}`);
      } else if (message?.kind === "chum-dial") {
        switchDial(message);
      }
    });
  }));

  function switchDial({ from, url, port }) {
    const target = new URL(url).host;
    const handle = workers.get(target);
    if (!handle || !open.get(target) || !open.get(from)) {
      port.postMessage({ t: "close", reason: `lab host: ${target} unreachable from ${from}` });
      port.close();
      return;
    }
    handle.port.postMessage({ kind: "chum-accept", url, port }, [port]);
  }

  await Promise.all(ready);

  return {
    clients,
    persons,
    setSwitch(key, value) {
      if (!open.has(key)) throw new Error(`Lab host: unknown worker ${key}.`);
      open.set(key, value);
    },
    async pairAll() {
      for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
          const invite = await clients[keys[i]].call("connection", "createInvite", {});
          await clients[keys[j]].call("connection", "connectWithInvite", {
            url: invite.url, publicKey: invite.publicKey, token: invite.token,
          });
        }
      }
    },
    async stop() {
      await Promise.all([...workers.values()].map(handle => handle.terminate()));
    },
  };
}
