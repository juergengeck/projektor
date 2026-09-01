import assert from "node:assert/strict";
import {
  ProjektorTrustModel,
  ProjektorTrustRecipes,
  ProjektorTrustReverseMaps,
} from "./index.js";

const ids = {
  receiver: "1".repeat(64),
  owner: "2".repeat(64),
  member: "3".repeat(64),
  recipient: "4".repeat(64),
  group: "5".repeat(64),
  roster: "6".repeat(64),
};

function createHarness() {
  let serial = 0;
  let now = 1_000;
  const objects = new Map();
  const latest = new Map();
  const storedVersioned = [];
  const hash = () => (++serial).toString(16).padStart(64, "0");
  const idKey = object => {
    if (object.$type$ === "GroupMembershipBundleStatus") {
      return `${object.$type$}:${object.receiver}:${object.bundle}`;
    }
    if (object.$type$ === "EffectiveGroupMembership") {
      return [object.$type$, object.receiver, object.group, object.hashGroup, object.person, object.validFrom].join(":");
    }
    throw new Error(`No fake ID key for ${object.$type$}`);
  };
  const storage = {
    async getObject(objectHash) {
      if (!objects.has(objectHash)) {
        const error = new Error(`Object ${objectHash} not found`);
        error.name = "FileNotFoundError";
        throw error;
      }
      return objects.get(objectHash);
    },
    async storeUnversioned(object) {
      const objectHash = hash();
      objects.set(objectHash, object);
      return objectHash;
    },
    async storeVersioned(object) {
      const objectHash = hash();
      objects.set(objectHash, object);
      const result = {hash: objectHash, obj: object};
      latest.set(idKey(object), result);
      storedVersioned.push(result);
      return objectHash;
    },
    async getLatestByIdObj(object) {
      const result = latest.get(idKey(object));
      if (!result) {
        const error = new Error("Object not found");
        error.name = "FileNotFoundError";
        throw error;
      }
      return result;
    },
    async findLatestReferencing(target, type) {
      return [...latest.values()]
        .filter(({obj}) => obj.$type$ === type && obj.group === target)
        .map(({hash: objectHash, obj}) => ({hash: objectHash, object: obj}));
    },
  };
  objects.set(ids.roster, {$type$: "HashGroup", person: new Set([ids.member])});
  const issuerBundleHash = hash();
  objects.set(issuerBundleHash, {$type$: "IssuerKeyCertificateBundle"});

  let verifyResult = {state: "verified", evidenceHashes: [issuerBundleHash]};
  const verifyCalls = [];
  const attestations = {
    async attest(params) {
      const license = hash();
      objects.set(license, {$type$: "License", name: params.type});
      const claimHash = hash();
      objects.set(claimHash, {$type$: params.type, ...params.certData, license});
      const signatureHash = hash();
      objects.set(signatureHash, {$type$: "Signature", data: claimHash, issuer: params.issuer, signature: "sig"});
      const signingKeysHash = hash();
      objects.set(signingKeysHash, {$type$: "Keys", owner: params.issuer, publicKey: "enc", publicSignKey: "sign"});
      return {
        claimHash,
        signatureHash,
        signingKeysHash,
        issuerKeyBundleHashes: [issuerBundleHash],
        purpose: params.purpose,
        authoredAt: params.assertedAt,
      };
    },
    async verify(params) {
      verifyCalls.push(params);
      return verifyResult;
    },
  };
  const model = new ProjektorTrustModel({
    attestations,
    storage,
    receiver: ids.receiver,
    now: () => now,
    selectGroupVersion: async (group, atTime) => {
      assert.equal(group, ids.group);
      assert.ok(Number.isSafeInteger(atTime));
      return {
        group: {$type$: "Group", name: "engineering", owner: ids.owner, hashGroup: ids.roster},
        versionHash: "7".repeat(64),
        creationTime: 0,
      };
    },
  });
  return {
    model,
    objects,
    storedVersioned,
    verifyCalls,
    setVerifyResult(value) { verifyResult = value; },
    setNow(value) { now = value; },
  };
}

assert.equal(ProjektorTrustRecipes.length, 8);
assert.deepEqual(
  new Map(ProjektorTrustReverseMaps).get("GroupMembershipCertificate"),
  new Set(["group"]),
);
assert.deepEqual(
  new Map(ProjektorTrustReverseMaps).get("EffectiveGroupMembership"),
  new Set(["group", "receiver", "person", "hashGroup"]),
);

{
  const h = createHarness();
  const issued = await h.model.issueMembership({
    groupIdHash: ids.group,
    hashGroup: ids.roster,
    person: ids.member,
    mayReshare: true,
    validFrom: 900,
    validUntil: 2_000,
    assertedAt: 1_000,
  });
  const statusHash = await h.model.importMembershipBundle({bundleHash: issued.bundleHash});
  assert.equal(h.objects.get(statusHash).state, "verified");
  assert.equal(h.verifyCalls[0].receiver, ids.receiver);
  assert.equal(h.verifyCalls[0].expectedIssuer, ids.owner);
  assert.equal(h.verifyCalls[0].authorityMode, "evidence-time");

  const authorized = await h.model.authorizeDisclosure({
    groupIdHash: ids.group,
    hashGroup: ids.roster,
    sharer: ids.member,
    atTime: 1_100,
  });
  assert.equal(authorized.projection.person, ids.member);
  const disclosure = await h.model.discloseGroup({
    groupIdHash: ids.group,
    hashGroup: ids.roster,
    sharer: ids.member,
    recipient: ids.recipient,
    atTime: 1_100,
  });
  const disclosureBundle = h.objects.get(disclosure.bundleHash);
  const disclosureClaim = h.objects.get(disclosureBundle.claim);
  assert.equal(disclosureClaim.authorizingProjection, authorized.projectionHash);
  assert.deepEqual(disclosureClaim.membershipBundles, authorized.projection.sourceBundles);
  assert.deepEqual(disclosureClaim.membershipStatuses, authorized.projection.sourceStatuses);
  const verified = await h.model.verifyDisclosure({bundleHash: disclosure.bundleHash, atTime: 1_200});
  assert.equal(verified.state, "verified");
  assert.ok(h.verifyCalls.some(call => call.expectedIssuer === ids.member));
  assert.equal(h.verifyCalls.at(-1).expectedIssuer, ids.owner);
}

{
  const h = createHarness();
  const issued = await h.model.issueMembership({
    groupIdHash: ids.group,
    hashGroup: ids.roster,
    person: ids.member,
    mayReshare: true,
    validFrom: 900,
    validUntil: 2_000,
    assertedAt: 1_000,
  });
  h.objects.get(issued.bundleHash).authoredAt = 1_001;
  const statusHash = await h.model.importMembershipBundle({bundleHash: issued.bundleHash});
  assert.equal(h.objects.get(statusHash).state, "rejected");
  assert.equal(h.objects.get(statusHash).rejectionCode, "membership-bundle-metadata-mismatch");
  assert.equal(h.verifyCalls.length, 0, "unsigned bundle time never reaches trust verification");
}

{
  const h = createHarness();
  h.setVerifyResult({
    state: "rejected",
    evidenceHashes: ["8".repeat(64)],
    rejectionCode: "issuer-authority-conflicted",
  });
  const issued = await h.model.issueMembership({
    groupIdHash: ids.group,
    hashGroup: ids.roster,
    person: ids.member,
    mayReshare: true,
    validFrom: 900,
    validUntil: 2_000,
    assertedAt: 1_000,
  });
  await h.model.importMembershipBundle({bundleHash: issued.bundleHash});
  const projection = h.storedVersioned.find(
    ({obj}) => obj.$type$ === "EffectiveGroupMembership",
  ).obj;
  assert.equal(projection.state, "conflicted");
  await assert.rejects(
    h.model.authorizeDisclosure({
      groupIdHash: ids.group,
      hashGroup: ids.roster,
      sharer: ids.member,
      atTime: 1_100,
    }),
    /No effective membership/,
  );
}

{
  const h = createHarness();
  const issued = await h.model.issueMembership({
    groupIdHash: ids.group,
    hashGroup: ids.roster,
    person: ids.member,
    mayReshare: true,
    validFrom: 900,
    validUntil: 2_000,
    assertedAt: 1_000,
  });
  const bundle = h.objects.get(issued.bundleHash);
  h.objects.delete(bundle.signature);
  const before = h.storedVersioned.length;
  await assert.rejects(
    h.model.importMembershipBundle({bundleHash: issued.bundleHash}),
    /not found/,
  );
  assert.equal(h.storedVersioned.length, before, "incomplete evidence stores no status");
}

{
  const h = createHarness();
  h.setVerifyResult({
    state: "pending-authority",
    evidenceHashes: ["8".repeat(64)],
    requiredRootAuthority: "9".repeat(64),
  });
  const issued = await h.model.issueMembership({
    groupIdHash: ids.group,
    hashGroup: ids.roster,
    person: ids.member,
    mayReshare: true,
    validFrom: 900,
    validUntil: 2_000,
    assertedAt: 1_000,
  });
  const statusHash = await h.model.importMembershipBundle({bundleHash: issued.bundleHash});
  assert.equal(h.objects.get(statusHash).state, "pending-authority");
  await assert.rejects(
    h.model.authorizeDisclosure({
      groupIdHash: ids.group,
      hashGroup: ids.roster,
      sharer: ids.member,
      atTime: 1_100,
    }),
    /No effective membership/,
  );
}

{
  const h = createHarness();
  const base = {
    groupIdHash: ids.group,
    hashGroup: ids.roster,
    person: ids.member,
    validFrom: 900,
    assertedAt: 1_000,
  };
  const first = await h.model.issueMembership({...base, mayReshare: true, validUntil: 2_000});
  await h.model.importMembershipBundle({bundleHash: first.bundleHash});
  const amendment = await h.model.issueMembership({...base, mayReshare: false, validUntil: 1_500});
  await h.model.importMembershipBundle({bundleHash: amendment.bundleHash});
  const projection = [...h.storedVersioned].reverse().find(({obj}) => obj.$type$ === "EffectiveGroupMembership").obj;
  assert.equal(projection.validUntil, 1_500);
  assert.equal(projection.mayReshare, false);
  await assert.rejects(
    h.model.authorizeDisclosure({
      groupIdHash: ids.group,
      hashGroup: ids.roster,
      sharer: ids.member,
      atTime: 1_100,
    }),
    /No effective membership/,
  );
}

console.log("trust.projektor issuance tests passed");
