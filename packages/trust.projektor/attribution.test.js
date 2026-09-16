import assert from "node:assert/strict";
import {
  ACT_ATTRIBUTION_ASSESSMENT_TYPE,
  ACT_PARTICIPATION_STATEMENT_TYPE,
  ProjektorAttributionModel,
  deriveActAttribution,
} from "./index.js";

const ids = {
  receiver: "1".repeat(64),
  person: "2".repeat(64),
  other: "3".repeat(64),
  act: "4".repeat(64),
  issuerBundle: "e".repeat(64),
  participationProof: "f".repeat(64),
};

function createHarness() {
  let serial = 0;
  let now = 100;
  const latest = new Map();
  const objects = new Map([
    [ids.act, {$type$: "Assembly", $version$: "2", signer: ids.person}],
    [ids.issuerBundle, {$type$: "IssuerKeyCertificateBundle"}],
    [ids.participationProof, {$type$: "License", name: "user-verifying proof"}],
  ]);
  const calls = [];
  const nextHash = () => (++serial).toString(16).padStart(64, "0");
  const storage = {
    async getObject(hash) {
      if (!objects.has(hash)) throw new Error(`Object ${hash} not found`);
      return objects.get(hash);
    },
    async storeUnversioned(object) {
      const hash = nextHash();
      objects.set(hash, object);
      return hash;
    },
    async storeVersioned(object) {
      const hash = nextHash();
      objects.set(hash, object);
      const result = {hash, obj: object};
      latest.set(`${object.$type$}:${object.receiver}:${object.bundle}`, result);
      return hash;
    },
    async getLatestByIdObj(object) {
      const result = latest.get(`${object.$type$}:${object.receiver}:${object.bundle}`);
      if (!result) {
        const error = new Error("Object not found");
        error.name = "FileNotFoundError";
        throw error;
      }
      return result;
    },
    async findReferencing(target, type, property) {
      return [...objects.entries()]
        .filter(([, object]) => object.$type$ === type && object[property] === target)
        .map(([hash, object]) => ({hash, object}));
    },
  };
  const attestations = {
    async findByType(params) {
      calls.push({operation: "findByType", ...params});
      return [...objects.entries()]
        .filter(([, object]) => object.$type$ === params.type && object.act === params.subject)
        .map(([hash]) => hash);
    },
    async attest(params) {
      calls.push({operation: "attest", ...params});
      assert.equal(params.attributionTier, "participation-backed");
      const license = nextHash();
      objects.set(license, {$type$: "License", name: params.type});
      const claimHash = nextHash();
      objects.set(claimHash, {$type$: params.type, ...params.certData, license});
      const signatureHash = nextHash();
      objects.set(signatureHash, {
        $type$: "Signature",
        data: claimHash,
        issuer: params.issuer,
        signature: "signature",
      });
      const signingKeysHash = nextHash();
      objects.set(signingKeysHash, {
        $type$: "Keys",
        owner: params.issuer,
        publicKey: "public-key",
        publicSignKey: "public-sign-key",
      });
      return {
        claimHash,
        signatureHash,
        signingKeysHash,
        issuerKeyBundleHashes: [ids.issuerBundle],
        purpose: params.purpose,
        authoredAt: params.assertedAt,
        attributionTier: params.attributionTier,
        participationEvidenceHashes: [ids.participationProof],
      };
    },
    async verify(params) {
      calls.push({operation: "verify", ...params});
      assert.equal(params.attributionTier, "participation-backed");
      assert.deepEqual(params.participationEvidenceHashes, [ids.participationProof]);
      return {
        state: "verified",
        evidenceHashes: [ids.issuerBundle, ids.participationProof],
      };
    },
  };
  const assemblyAuthorshipVerifier = {
    async verifyAssemblyAuthorship({assembly}) {
      calls.push({operation: "verifyAssemblyAuthorship", assembly});
      const object = objects.get(assembly);
      if (object?.$type$ !== "Assembly") throw new Error("Assembly verification failed");
      return {assembly, signer: object.signer};
    },
  };
  const createModel = receiver => new ProjektorAttributionModel({
    attestations,
    assemblyAuthorshipVerifier,
      storage,
      receiver,
      now: () => now,
    });
  return {
    model: createModel(ids.receiver),
    createModel,
    attestations,
    storage,
    objects,
    calls,
    setNow(value) { now = value; },
  };
}

assert.deepEqual(deriveActAttribution({
  baseTier: "custody",
  statements: [],
  asOfTime: 100,
}), {state: "neither", effectiveTier: "custody"});

const h = createHarness();
assert.throws(
  () => new ProjektorAttributionModel({
    attestations: h.attestations,
    storage: h.storage,
    receiver: ids.receiver,
  }),
  /requires assembly.core authorship verification/,
);
const mismatchedAssembly = new ProjektorAttributionModel({
  attestations: h.attestations,
  storage: h.storage,
  receiver: ids.receiver,
  now: () => 100,
  assemblyAuthorshipVerifier: {
    verifyAssemblyAuthorship: async () => ({assembly: ids.act, signer: ids.other}),
  },
});
await assert.rejects(
  mismatchedAssembly.loadAttributedAct(ids.act),
  /does not match the exact act/,
);
const initial = await h.model.assessAct({
  act: ids.act,
  person: ids.person,
  asOfTime: 100,
});
assert.equal(initial.assessment.$type$, ACT_ATTRIBUTION_ASSESSMENT_TYPE);
assert.equal(initial.assessment.state, "neither");
assert.equal(initial.assessment.effectiveTier, "custody");
assert.equal(initial.assessment.statementBundles.size, 0, "neither is explicit, not missing data");
assert.equal(
  h.calls.some(call => call.operation === "verifyAssemblyAuthorship" && call.assembly === ids.act),
  true,
);

await assert.rejects(
  h.model.affirmOrRepudiate({
    act: ids.act,
    person: ids.other,
    value: "affirmed",
    statedAt: 109,
  }),
  /only the person attributed/,
);

const affirmation = await h.model.affirmOrRepudiate({
  act: ids.act,
  person: ids.person,
  value: "affirmed",
  statedAt: 110,
});
h.setNow(111);
const affirmationStatus = await h.model.importActParticipationBundle({
  bundleHash: affirmation.bundleHash,
});
assert.equal(h.objects.get(affirmationStatus).state, "verified");

const reliedAt = 112;
h.setNow(reliedAt);
const affirmed = await h.model.assessAct({
  act: ids.act,
  person: ids.person,
  asOfTime: reliedAt,
});
assert.equal(affirmed.assessment.state, "affirmed");
assert.equal(affirmed.assessment.effectiveTier, "participation-backed");

await assert.rejects(
  h.model.recordReliance({
    relyingParty: ids.other,
    assessmentHash: affirmed.assessmentHash,
    reliedAt,
  }),
  /relying party's own receiver-local assessment/,
);

const reliance = await h.model.recordReliance({
  relyingParty: ids.receiver,
  assessmentHash: affirmed.assessmentHash,
  reliedAt,
});
assert.equal((await h.model.verifyReliance({bundleHash: reliance.bundleHash})).state, "verified");
const relianceBundle = h.objects.get(reliance.bundleHash);
const relianceClaim = h.objects.get(relianceBundle.claim);
assert.equal(relianceClaim.tierAtReliance, "participation-backed");
assert.equal(relianceClaim.statementStateAtReliance, "affirmed");

const otherReceiver = h.createModel(ids.other);
await otherReceiver.importActParticipationBundle({bundleHash: affirmation.bundleHash});

const repudiation = await h.model.affirmOrRepudiate({
  act: ids.act,
  person: ids.person,
  value: "repudiated",
  statedAt: 120,
});
h.setNow(121);
const repudiationStatus = await h.model.importActParticipationBundle({
  bundleHash: repudiation.bundleHash,
});

const notYetReceived = await otherReceiver.assessAct({
  act: ids.act,
  person: ids.person,
  asOfTime: 121,
});
assert.equal(notYetReceived.assessment.state, "affirmed");

const afterRepudiation = await h.model.assessAct({
  act: ids.act,
  person: ids.person,
  asOfTime: 121,
});
assert.equal(afterRepudiation.assessment.state, "repudiated");
assert.equal(afterRepudiation.assessment.effectiveTier, "custody");

assert.equal(
  (await h.model.verifyReliance({bundleHash: reliance.bundleHash})).state,
  "verified",
  "later repudiation does not rewrite an earlier exact reliance assessment",
);
assert.equal(
  h.calls.filter(call => call.operation === "attest" && call.type === ACT_PARTICIPATION_STATEMENT_TYPE).length,
  2,
);
assert.ok(
  h.calls.filter(call => call.operation === "findByType").every(call =>
    call.type === ACT_PARTICIPATION_STATEMENT_TYPE && call.subject === ids.act
  ),
  "assessment uses one informed trust.core claim type, never wildcard discovery",
);

console.log("trust.projektor attribution and reliance tests passed");
