// packages/projektor.browser/src/lab/transport.test.ts
// Host transport unit tests: URL building, deterministic accounts, the
// owner-equals-invited-Person assertion, and the three pairMesh pairings —
// all against a fake PlanRegistry. iframe boot itself needs a DOM and is
// covered by the lane ceremony browser spec instead.
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK } from "../../../lab.core/brand.ts";
import { labAppUrl } from "../../../lab.core/shell/urls.ts";
import {
  acceptRoleInvite,
  createRoleInvite,
  labAccount,
  pairMesh,
  seedRole,
  type LabClient,
  type LabKey,
} from "./transport.ts";
import type { PlanRegistry } from "../../../lab.core/shell/plan-client.ts";

type Handler = (plan: string, method: string, params?: unknown) => unknown;

function fakeRegistry(calls: string[][], handler: Handler): PlanRegistry {
  return {
    call: async (plan, method, params) => {
      calls.push([plan, method]);
      return { success: true, data: await handler(plan, method, params) };
    },
  };
}

function fakeClient(key: LabKey, calls: string[][], handler: Handler): LabClient {
  const account = labAccount(key, AMWAY);
  return {
    key,
    iframe: {} as HTMLIFrameElement,
    registry: fakeRegistry(calls, handler),
    account,
    snapshot: async () => ({ inviteState: null, department: null }),
  };
}

test("iframe URLs carry lane, instance and session", () => {
  assert.equal(
    labAppUrl("https://example.com/browser/lab/?lane=amway", AMWAY, "admin", "abc12345"),
    "https://example.com/browser/app/?lane=amway&labInstance=admin&labSession=abc12345",
  );
  assert.equal(
    labAppUrl("https://example.com/browser/lab/?lane=ek", EK, "seller", "s01e02f3"),
    "https://example.com/browser/app/?lane=ek&labInstance=seller&labSession=s01e02f3",
  );
});

test("accounts are deterministic per role and brand", () => {
  assert.deepEqual(labAccount("seller", AMWAY), {
    key: "seller",
    email: "seller@lab.local",
    secret: "lab-seller",
    displayName: "Seller",
  });
  assert.deepEqual(labAccount("seller", AMWAY), labAccount("seller", AMWAY));
  assert.equal(labAccount("manager", EK).email, "manager@ek.local");
  assert.notEqual(labAccount("seller", AMWAY).email, labAccount("seller", EK).email);
});

test("seedRole asserts the owner is the exact invited person", async () => {
  const adminCalls: string[][] = [];
  const roleCalls: string[][] = [];
  const admin = fakeClient("admin", adminCalls, (plan, method) => {
    if (plan === "connection" && method === "createInvite") {
      return { url: "lab://admin", publicKey: "pub", token: "tok", pairingMode: "primed" };
    }
    if (plan === "connection" && method === "listConnections") {
      return [{ remotePersonId: "person-1" }];
    }
    throw new Error(`unexpected admin call ${plan}.${method}`);
  });
  const seller = fakeClient("seller", roleCalls, (plan, method) => {
    if (plan === "ui" && method === "loadPendingInvitation") {
      return { loaded: true, pendingInvitationPresent: true };
    }
    if (plan === "ui" && method === "acceptPendingInvitation") {
      return { ownerId: "person-1" };
    }
    if (plan === "onecore" && method === "getStatus") {
      return { ownerId: "person-1", instanceId: "i-1", instanceName: "seller" };
    }
    throw new Error(`unexpected role call ${plan}.${method}`);
  });
  const log = await seedRole(admin, seller, "seller", "seller@lab.local", "https://example.com/browser/lab/?lane=amway", new AbortController().signal);
  assert.match(log, /seller paired as seller@lab.local/);
  assert.ok(adminCalls.some(([plan, method]) => plan === "connection" && method === "listConnections"));
});

test("seedRole fails when the invited person never appears on the mesh", async () => {
  const adminCalls: string[][] = [];
  const admin = fakeClient("admin", adminCalls, (plan, method) => {
    if (plan === "connection" && method === "createInvite") {
      return { url: "lab://admin", publicKey: "pub", token: "tok", pairingMode: "primed" };
    }
    if (plan === "connection" && method === "listConnections") {
      return [{ remotePersonId: "someone-else" }];
    }
    throw new Error(`unexpected admin call ${plan}.${method}`);
  });
  const seller = fakeClient("seller", [], (plan, method) => {
    if (plan === "ui" && method === "loadPendingInvitation") {
      return { loaded: true, pendingInvitationPresent: true };
    }
    if (plan === "ui" && method === "acceptPendingInvitation") {
      return { ownerId: "person-1" };
    }
    if (plan === "onecore" && method === "getStatus") {
      return { ownerId: "person-1", instanceId: "i-1", instanceName: "seller" };
    }
    throw new Error(`unexpected role call ${plan}.${method}`);
  });
  await assert.rejects(
    seedRole(admin, seller, "seller", "seller@lab.local", "https://example.com/", new AbortController().signal, 300),
    /timed out/,
  );
});

test("acceptRoleInvite rejects an invitation that did not load", async () => {
  const client = fakeClient("seller", [], async () => ({ loaded: false }));
  await assert.rejects(
    acceptRoleInvite(client, "https://example.com/", { secret: "lab-seller", displayName: "seller", expectedEmail: "seller@lab.local" }, new AbortController().signal),
    /invitation did not load/,
  );
});

test("createRoleInvite builds a mesh URL for the admin endpoint", async () => {
  const admin = fakeClient("admin", [], (plan, method) => {
    if (plan === "connection" && method === "createInvite") {
      return { url: "lab://admin", publicKey: "pub", token: "tok", pairingMode: "primed" };
    }
    throw new Error(`unexpected admin call ${plan}.${method}`);
  });
  const { url } = await createRoleInvite(admin, "seller", "seller@lab.local", "https://example.com/browser/lab/?lane=amway", new AbortController().signal);
  const parsed = new URL(url);
  assert.equal(parsed.searchParams.get("invited"), "true");
  assert.equal(parsed.searchParams.get("fe"), "seller@lab.local");
  const fragment = JSON.parse(decodeURIComponent(parsed.hash.slice(1))) as { url: string; mode: string };
  assert.equal(fragment.url, "lab://admin");
  assert.equal(fragment.mode, "IoP");
});

test("pairMesh pairs the three non-admin pairs exactly once each", async () => {
  const calls: { key: string; plan: string; method: string; params: unknown }[] = [];
  const clients = {} as Record<LabKey, LabClient>;
  for (const key of ["admin", "manager", "seller", "customer"] as const) {
    const keyCalls: string[][] = [];
    clients[key] = fakeClient(key, keyCalls, (plan, method, params) => {
      calls.push({ key, plan, method, params });
      if (plan === "connection" && method === "createInvite") {
        return { url: `lab://${key}`, publicKey: `${key}-pub`, token: `${key}-tok`, pairingMode: "primed" };
      }
      if (plan === "connection" && method === "connectWithInvite") {
        return {};
      }
      throw new Error(`unexpected call ${plan}.${method}`);
    });
  }
  await pairMesh(clients, new AbortController().signal);
  const invites = calls.filter(entry => entry.method === "createInvite");
  const connects = calls.filter(entry => entry.method === "connectWithInvite");
  assert.deepEqual(invites.map(entry => entry.key), ["manager", "manager", "seller"]);
  assert.deepEqual(
    connects.map(entry => [entry.key, (entry.params as { url: string }).url]),
    [["seller", "lab://manager"], ["customer", "lab://manager"], ["customer", "lab://seller"]],
  );
  assert.equal(calls.length, 6);
});
