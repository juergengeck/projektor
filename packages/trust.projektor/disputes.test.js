import assert from "node:assert/strict";
import {
  PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
  ProjektorEvidenceDisputeReverseMap,
  createProjektorEvidenceDisputeData,
  markDisputedAssertions,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);
const ANNA = "2".repeat(64);
const BEN = "4".repeat(64);

const claimData = createProjektorEvidenceDisputeData({
  person: ANNA,
  compromisedSince: FEB,
  claimedAt: MAR,
  reason: "Laptop stolen, reported in March",
});
assert.equal("$type$" in claimData, false);
assert.equal("license" in claimData, false);
assert.equal("signature" in claimData, false);
const claim = {$type$: PROJEKTOR_EVIDENCE_DISPUTE_TYPE, ...claimData};
assert.equal("validUntil" in claim, false);

const marked = markDisputedAssertions(claim, [
  {person: ANNA, assertedAt: JAN},
  {person: ANNA, assertedAt: MAR},
  {person: BEN, assertedAt: MAR},
]);
assert.deepEqual(marked.map(entry => entry.disputed), [false, true, false]);
assert.throws(
  () => createProjektorEvidenceDisputeData({
    person: ANNA,
    compromisedSince: MAR,
    claimedAt: FEB,
    reason: "impossible",
  }),
  /compromisedSince must not be after claimedAt/,
);
assert.deepEqual(ProjektorEvidenceDisputeReverseMap, [
  PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
  new Set(["person"]),
]);

console.log("trust.projektor dispute tests passed");
