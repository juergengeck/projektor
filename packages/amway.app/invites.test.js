import assert from "node:assert/strict";
import { test } from "node:test";
import { AmwayDirectory } from "./departments.js";
import { AmwayPhoneBook } from "./phonebook.js";
import {
  AmwayInvites,
  AMWAY_INVITE_URL_BASE,
  invitationTokenFromUrl,
  invitationUrl,
} from "./invites.js";

function staffed() {
  const directory = new AmwayDirectory({ bootstrapIssuers: ["person:root"], now: () => 1_000 });
  directory.createDepartment({
    id: "nord", name: "Nord", manager: "person:manager",
    createdBy: "person:root", createdAt: 1_000,
  });
  directory.assignRole({ issuer: "person:root", subject: "person:admin", role: "admin", department: "nord", validFrom: 1_000 });
  const phonebook = new AmwayPhoneBook({ directory, now: () => 1_000 });
  return { directory, phonebook, invites: new AmwayInvites({ directory, phonebook, now: () => 1_500 }) };
}

test("invitation URLs carry metadata and reject foreign URLs", () => {
  assert.ok(invitationUrl("abc123").startsWith(`${AMWAY_INVITE_URL_BASE}/`));
  assert.equal(invitationTokenFromUrl(`${AMWAY_INVITE_URL_BASE}/abc123`), "abc123");
  assert.equal(invitationTokenFromUrl(`${AMWAY_INVITE_URL_BASE}/abc123?x=1`), "abc123");
  assert.throws(() => invitationTokenFromUrl("https://evil.example/abc"), /not an Amway invitation/);
});

test("managers invite sellers; acceptance pairs identity, contact, and signed role", () => {
  const { directory, invites } = staffed();
  assert.throws(() => invites.createInvite({
    issuer: "person:outsider", department: "nord", role: "seller",
  }), /may not invite/);
  assert.throws(() => invites.createInvite({
    issuer: "person:manager", department: "nord", role: "manager",
  }), /sellers and customers/);
  const invite = invites.createInvite({ issuer: "person:manager", department: "nord", role: "seller" });
  assert.ok(invite.url.startsWith(AMWAY_INVITE_URL_BASE));
  const paired = invites.acceptInvite({
    invitationUrl: invite.url, person: "person:neu", name: "Neu Seller",
  });
  assert.equal(paired.pairing.role, "seller");
  assert.ok(directory.effectiveRoles({ subject: "person:neu", department: "nord", atTime: 1_500 }).has("seller"));
  const assignment = directory.assignments.get(paired.pairing.assignment);
  assert.equal(assignment.issuer, "person:manager");
  assert.throws(() => invites.acceptInvite({
    invitationUrl: invite.url, person: "person:other", name: "Other",
  }), /already used/);
});

test("transport pairing lands through listeners with a primed intent", () => {
  const { directory, invites } = staffed();
  const invite = invites.createInvite({
    issuer: "person:manager", department: "nord", role: "seller", pairing: {},
  });
  assert.deepEqual(invite.pairing, { topic: "amway.department:nord", connectionMode: "primed" });
  assert.throws(() => invites.createInvite({
    issuer: "person:manager", department: "nord", role: "seller", pairing: { connectionMode: "turbo" },
  }), /connectionMode/);
  assert.throws(() => invites.onPairingComplete("nope"), /must be a function/);
  const seen = [];
  const off = invites.onPairingComplete(detail => seen.push(detail));
  const result = invites.pairingComplete({
    token: invite.token, person: "person:paar", name: "Paar Seller",
    topicId: "amway.department:nord", remotePerson: "person:fern",
  });
  assert.equal(result.pairing.role, "seller");
  assert.equal(result.pairing.pairedBy, "person:fern");
  assert.ok(result.pairing.pairedAt !== null);
  assert.ok(directory.effectiveRoles({ subject: "person:paar", department: "nord", atTime: 1_500 }).has("seller"));
  assert.equal(seen.length, 1);
  assert.equal(seen[0].person, "person:paar");
  assert.equal(seen[0].invite.token, invite.token);
  off();
  assert.throws(() => invites.pairingComplete({
    token: invite.token, person: "person:z", name: "Zed",
  }), /already used/);
  const other = invites.createInvite({
    issuer: "person:manager", department: "nord", role: "customer",
    pairing: { topic: "amway.department:west" },
  });
  assert.throws(() => invites.pairingComplete({
    token: other.token, person: "person:q", name: "Quinn", topicId: "amway.department:nord",
  }), /different topic/);
  assert.throws(() => invites.pairingComplete({ person: "person:q", name: "Quinn" }), /token or invitation URL/);
});

test("revoked and expired invitations never pair", () => {
  const { invites } = staffed();
  const invite = invites.createInvite({ issuer: "person:manager", department: "nord", role: "customer" });
  invites.revokeInvite({ issuer: "person:manager", token: invite.token });
  assert.throws(() => invites.acceptInvite({
    invitationUrl: invite.url, person: "person:x", name: "X",
  }), /revoked/);
  const short = invites.createInvite({
    issuer: "person:manager", department: "nord", role: "customer", ttlMs: 1,
  });
  invites.now = () => 1_000_000_000;
  assert.throws(() => invites.acceptInvite({
    invitationUrl: short.url, person: "person:y", name: "Y",
  }), /expired/);
});
