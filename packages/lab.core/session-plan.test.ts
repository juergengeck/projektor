// packages/lab.core/session-plan.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createSessionPlans } from "./session-plan.ts";

function fakeBoot() {
  const calls: string[] = [];
  return {
    calls,
    boot: async ({ email }: { email: string }) => {
      calls.push(email);
      return { ownerId: "o".repeat(64), instanceId: "i".repeat(64), instanceName: "n", connectWithInvite: async () => {} };
    },
  };
}

test("waitUntilReady rejects with 'still booting' before any instance", async () => {
  const { boot } = fakeBoot();
  const { session } = createSessionPlans({ boot });
  await assert.rejects(session.waitUntilReady({ timeoutMs: 10 }), /still booting/);
});

test("registerAndSetup boots once and reports logged_in", async () => {
  const { boot, calls } = fakeBoot();
  const { session, ui } = createSessionPlans({ boot });
  const { readyState } = await session.registerAndSetup({ email: "a@lab.local", secret: "s", instanceName: "n" });
  assert.equal(readyState.authState, "logged_in");
  assert.equal(readyState.postLoginPlansReady, true);
  assert.deepEqual(calls, ["a@lab.local"]);
  await assert.rejects(session.registerAndSetup({ email: "b@lab.local", secret: "s", instanceName: "n" }), /already signed in/);
  assert.equal((await ui.getInviteState()).ownerId, "o".repeat(64));
});

test("loadPendingInvitation rejects URLs that are not lane invitations", async () => {
  const { boot } = fakeBoot();
  const { ui } = createSessionPlans({ boot });
  await assert.rejects(ui.loadPendingInvitation({ url: "https://example.com/" }), /not a lane invitation/);
});
