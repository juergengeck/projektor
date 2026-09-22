// packages/lab.core/iframe-port.ts
/**
 * LabPort over same-origin iframe postMessage, so the lab:// switch
 * (host-switch.ts) routes CHUM MessagePorts between iframes exactly as it
 * does between workers. The data plane stays local; nothing here touches a
 * commserver.
 */
import type { LabPort } from "./port-ipc.ts";

export function iframeChildPort(win: Window, origin: string): LabPort {
  return {
    postMessage: (message, transfer) => win.parent.postMessage(message, origin, (transfer ?? []) as Transferable[]),
    addEventListener: (type, listener) => win.addEventListener(type, event => {
      if ((event as MessageEvent).source === win.parent) listener(event as MessageEvent);
    }),
  };
}

export function iframeHostPort(iframe: HTMLIFrameElement, origin: string, host: Window = window) {
  const target = () => {
    const child = iframe.contentWindow;
    if (!child) throw new Error("lab.core: iframe has no window.");
    return child;
  };
  return {
    postMessage: (message: unknown, transfer?: unknown[]) => target().postMessage(message, origin, (transfer ?? []) as Transferable[]),
    // Typed as string (not "message") so the result satisfies LabPort.
    addEventListener: (type: string, listener: (event: MessageEvent) => void) => host.addEventListener(type, event => {
      if ((event as MessageEvent).source === iframe.contentWindow) listener(event as MessageEvent);
    }),
  };
}
