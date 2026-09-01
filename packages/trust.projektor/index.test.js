import assert from "node:assert/strict";
import {
  GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  createGroupMembershipCertificateData,
  effectiveMembershipWindow,
  revokeMembershipCertificate,
  createProjectAccessAssertionData,
  createProjektorEvidenceDisputeData,
  markDisputedAssertions,
  mergeReverseMaps,
} from "./index.js";

const hash = character => character.repeat(64);
const group = hash("1");
const roster = hash("2");
const person = hash("3");

const data = createGroupMembershipCertificateData({
  group,
  hashGroup: roster,
  person,
  mayReshare: true,
  issuedAt: 100,
  validFrom: 100,
  validUntil: 500,
});
assert.deepEqual(data, {
  group,
  hashGroup: roster,
  person,
  mayReshare: true,
  issuedAt: 100,
  validFrom: 100,
  validUntil: 500,
});
await assert.rejects(
  async () => createGroupMembershipCertificateData({...data, validUntil: 100}),
  /after validFrom/,
);

const original = {$type$: GROUP_MEMBERSHIP_CERTIFICATE_TYPE, ...data, license: hash("4")};
const revocation = {
  $type$: GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  ...revokeMembershipCertificate(original, {
    revokedAt: 300,
    endAt: 300,
    learnedAt: 450,
    reason: "role ended",
  }),
  license: hash("4"),
};
assert.deepEqual(effectiveMembershipWindow([original, revocation]), {
  validFrom: 100,
  validUntil: 300,
  mayReshare: true,
});
assert.equal(revocation.learnedAt, 450, "learnedAt does not backdate validity");
assert.equal(revocation.issuedAt, 300, "revocation issuance is signed at revokedAt");

assert.deepEqual(
  createProjectAccessAssertionData({
    group,
    binding: "living",
    record: "schedule",
    projectId: "demo",
    grantedAt: 200,
  }),
  {group, binding: "living", record: "schedule", projectId: "demo", grantedAt: 200},
);
assert.throws(
  () => createProjectAccessAssertionData({
    group,
    binding: "pinned",
    record: "schedule",
    projectId: "demo",
    grantedAt: 200,
  }),
  /requires hashGroup/,
);

const dispute = {
  $type$: "ProjektorEvidenceDispute",
  ...createProjektorEvidenceDisputeData({
    person,
    compromisedSince: 250,
    claimedAt: 400,
    reason: "key loss",
  }),
};
assert.deepEqual(markDisputedAssertions(dispute, [
  {person, assertedAt: 249},
  {person, assertedAt: 250},
  {person: hash("5"), assertedAt: 300},
]).map(entry => entry.disputed), [false, true, false]);

assert.deepEqual(
  mergeReverseMaps(
    [["Type", new Set(["a"])]],
    [["Type", new Set(["b"])]],
  ),
  [["Type", new Set(["a", "b"])]],
);

console.log("trust.projektor object tests passed");
