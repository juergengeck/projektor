// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/lab/transport.test.ts (5e0370c5b); replace with the shared lane-shell package in Phase 4.
import test from "node:test";
import assert from "node:assert/strict";
import { observeAppTransitions, type AppTransitionObserver } from "./transitions.ts";

test("re-snapshots on app transitions instead of a timer", async () => {
  let callback!: () => void;
  const observed: unknown[] = [];
  let disconnected = 0;
  let transitions = 0;
  const stop = observeAppTransitions(
    next => {
      callback = next;
      const observer: AppTransitionObserver = {
        observe: target => {
          observed.push(target);
        },
        disconnect: () => {
          disconnected += 1;
        },
      };
      return observer;
    },
    "app-root",
    () => {
      transitions += 1;
    },
    20,
  );
  assert.deepEqual(observed, ["app-root"]);
  callback();
  callback();
  callback();
  assert.equal(transitions, 0);
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(transitions, 1);
  callback();
  stop();
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(transitions, 1);
  assert.equal(disconnected, 1);
});
