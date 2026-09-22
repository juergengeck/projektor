// packages/lab.core/invite-url.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { decodeMeshInvite, encodeMeshInviteUrl, inviteMode } from "./invite-url.ts";
import { testBrand } from "./test/brand.ts";
import { PAIRING_PROTOCOL_VERSION } from "../../../one/packages/one.models/lib/misc/ConnectionEstablishment/PairingManager.js";

const brand = testBrand();

function valid(override: Record<string, unknown> = {}, params = "invited=true&connectionMode=primed&fe=seller%40x.local"): string {
  const fragment = {
    token: "abCD09_-".repeat(4),
    url: "lab://manager",
    publicKey: "0".repeat(64),
    pairingProtocolVersion: PAIRING_PROTOCOL_VERSION,
    pairingMode: "primed",
    mode: "IoP",
    ...override,
  };
  return `http://x/lane/?${params}#${encodeURIComponent(JSON.stringify(fragment))}`;
}

test("mesh invites round-trip through the lane URL", () => {
  const url = encodeMeshInviteUrl({
    appBaseUrl: "http://127.0.0.1/browser/lab/",
    email: "seller@lab.local",
    token: "abCD09_-".repeat(4),
    url: "lab://admin",
    publicKey: "0".repeat(64),
    pairingMode: "primed",
  });
  const invite = decodeMeshInvite(url, brand);
  assert.equal(invite.mode, "IoP");
  assert.equal(invite.url, "lab://admin");
  assert.equal(invite.token, "abCD09_-".repeat(4));
  assert.equal(invite.email, "seller@lab.local");
});

test("inviteMode reads the pairing mode off lane URLs", () => {
  assert.equal(inviteMode(valid(), brand), "IoP");
  assert.equal(inviteMode(valid({ mode: "IoM" }), brand), "IoM");
  assert.throws(() => inviteMode("http://x/lane/", brand), /not a lane invitation/);
  assert.throws(() => inviteMode(valid({ mode: "IoP2" }), brand), /wrong mode/);
});

test("mesh invitation URLs validate strictly", () => {
  assert.equal(decodeMeshInvite(valid(), brand).url, "lab://manager");
  const cases: [string, string][] = [
    ["missing payload", "http://x/lane/?invited=true"],
    ["not an invitation", "http://x/lane/"],
    ["wrong embedded mode", valid({ mode: "IoM" })],
    ["bad token", valid({ token: "short" })],
    // The rendezvous must be the local switch: a commserver URL pairs
    // across the wrong transport (the pairAll redial bug class).
    ["commserver rendezvous", valid({ url: "ws://127.0.0.1:9/comm" })],
    ["unparseable rendezvous", valid({ url: "http://[invalid" })],
    ["bad public key", valid({ publicKey: "short" })],
    ["protocol mismatch", valid({ pairingProtocolVersion: 999 })],
    ["not primed", valid({ pairingMode: "standard" })],
    ["bad email", valid({}, "invited=true&fe=not-an-email")],
  ];
  for (const [name, url] of cases) {
    assert.throws(() => decodeMeshInvite(url, brand), /not a lab mesh invitation/, name);
  }
});
