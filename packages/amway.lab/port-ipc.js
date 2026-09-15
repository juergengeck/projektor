/**
 * refinio.api over a MessagePort. The worker side is an `ipcMain`-shaped
 * object for the existing IpcTransport; the host side is a thin client for
 * its `handler:*` channels. Feed-forward rows and control messages share the
 * port but never the request/response path.
 */

export function createPortIpcMain(port) {
  const handlers = new Map();
  port.addEventListener("message", async event => {
    const message = event.data;
    if (message?.kind !== "ipc-invoke") return;
    const handler = handlers.get(message.channel);
    if (!handler) {
      port.postMessage({ kind: "ipc-result", id: message.id, ok: false, error: `No IPC handler for ${message.channel}` });
      return;
    }
    try {
      const value = await handler({ sender: "lab-host" }, ...message.args);
      port.postMessage({ kind: "ipc-result", id: message.id, ok: true, value });
    } catch (error) {
      port.postMessage({ kind: "ipc-result", id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
  port.start?.();
  return {
    handle(channel, fn) {
      if (handlers.has(channel)) throw new Error(`IPC handler ${channel} is already registered.`);
      handlers.set(channel, fn);
    },
  };
}

export function postFeed(port, row) {
  port.postMessage({ kind: "feed", row });
}

export class PortApiClient {
  #port;
  #seq = 0;
  #pending = new Map();
  #feed = new Set();
  #control = new Set();

  constructor(port) {
    this.#port = port;
    port.addEventListener("message", event => this.#route(event.data));
    port.start?.();
  }

  #route(message) {
    if (message?.kind === "ipc-result") {
      const task = this.#pending.get(message.id);
      if (!task) throw new Error(`Lab IPC: result for unknown call ${message.id}.`);
      this.#pending.delete(message.id);
      if (message.ok) task.resolve(message.value);
      else task.reject(new Error(message.error));
      return;
    }
    if (message?.kind === "feed") {
      for (const callback of this.#feed) callback(message.row);
      return;
    }
    for (const callback of this.#control) callback(message);
  }

  #invoke(channel, ...args) {
    const id = (this.#seq += 1);
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#port.postMessage({ kind: "ipc-invoke", id, channel, args });
    });
  }

  async call(handler, method, params = {}) {
    const response = await this.#invoke("handler:call", { handler, method, params });
    if (!response.success) throw new Error(`${handler}.${method}: ${response.error}`);
    return response.data;
  }

  list() {
    return this.#invoke("handler:list");
  }

  onFeed(callback) {
    this.#feed.add(callback);
    return () => this.#feed.delete(callback);
  }

  onControl(callback) {
    this.#control.add(callback);
    return () => this.#control.delete(callback);
  }

  fail(error) {
    for (const task of this.#pending.values()) task.reject(error);
    this.#pending.clear();
  }
}
