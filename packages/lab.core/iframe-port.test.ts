// packages/lab.core/iframe-port.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { iframeChildPort, iframeHostPort } from "./iframe-port.ts";

function fakeWindow() {
  const listeners: ((event: MessageEvent) => void)[] = [];
  const sent: { message: unknown; origin: string; transfer?: unknown[] }[] = [];
  const win = {
    postMessage: (message: unknown, origin: string, transfer?: unknown[]) => sent.push({ message, origin, transfer }),
    addEventListener: (_type: string, listener: (event: MessageEvent) => void) => listeners.push(listener),
    dispatch: (data: unknown, source: unknown) => listeners.forEach(listener => listener({ data, source } as MessageEvent)),
  };
  return { win, sent };
}

test("child port posts to its parent with the origin and transfer list", () => {
  const parent = fakeWindow();
  const self = fakeWindow();
  const port = iframeChildPort({ ...self.win, parent: parent.win } as unknown as Window, "http://lab.test");
  const transfer = [{}];
  port.postMessage({ kind: "chum-dial" }, transfer as unknown as Transferable[]);
  assert.deepEqual(parent.sent, [{ message: { kind: "chum-dial" }, origin: "http://lab.test", transfer }]);
});

test("host port only delivers messages from its own iframe", () => {
  const host = fakeWindow();
  const child = fakeWindow();
  const other = fakeWindow();
  const iframe = { contentWindow: child.win, remove() {} } as unknown as HTMLIFrameElement;
  const port = iframeHostPort(iframe, "http://lab.test", host.win as unknown as Window);
  const got: unknown[] = [];
  port.addEventListener("message", event => got.push(event.data));
  host.win.dispatch({ kind: "ready" }, child.win);
  host.win.dispatch({ kind: "ready" }, other.win);
  assert.deepEqual(got, [{ kind: "ready" }]);
});
