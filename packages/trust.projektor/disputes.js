export const PROJEKTOR_EVIDENCE_DISPUTE_TYPE = "ProjektorEvidenceDispute";

export const ProjektorEvidenceDisputeLicense = {
  $type$: "License",
  name: "ProjektorEvidenceDispute",
  description:
    "The [signature.issuer] states that evidence authored by [person] from [compromisedSince] is disputed, stated at [claimedAt].",
};

export const ProjektorEvidenceDisputeRecipe = {
  $type$: "Recipe",
  name: PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
  rule: [
    { itemprop: "person", itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } },
    { itemprop: "compromisedSince", itemtype: { type: "number" } },
    { itemprop: "claimedAt", itemtype: { type: "number" } },
    { itemprop: "reason", itemtype: { type: "string" } },
    { itemprop: "license", itemtype: { type: "referenceToObj", allowedTypes: new Set(["License"]) } },
  ],
};

export const ProjektorEvidenceDisputeReverseMap = [
  PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
  new Set(["person"]),
];

export function createProjektorEvidenceDisputeData({
  person,
  compromisedSince,
  claimedAt,
  reason,
} = {}) {
  if (typeof person !== "string" || !/^[0-9a-f]{64}$/.test(person)) {
    throw new Error("ProjektorEvidenceDispute: person must be a ONE id hash");
  }
  if (!Number.isSafeInteger(compromisedSince) || compromisedSince < 0) {
    throw new Error("ProjektorEvidenceDispute: compromisedSince is required");
  }
  if (!Number.isSafeInteger(claimedAt) || claimedAt < 0) {
    throw new Error("ProjektorEvidenceDispute: claimedAt is required");
  }
  if (compromisedSince > claimedAt) {
    throw new Error("ProjektorEvidenceDispute: compromisedSince must not be after claimedAt");
  }
  if (typeof reason !== "string" || reason.trim() === "") {
    throw new Error("ProjektorEvidenceDispute: reason is required");
  }
  return { person, compromisedSince, claimedAt, reason: reason.trim() };
}

export function markDisputedAssertions(claim, assertions) {
  if (claim?.$type$ !== PROJEKTOR_EVIDENCE_DISPUTE_TYPE) {
    throw new Error("markDisputedAssertions: claim must be a ProjektorEvidenceDispute");
  }
  if (!Array.isArray(assertions)) {
    throw new Error("markDisputedAssertions: assertions must be an array");
  }
  return assertions.map((assertion) => {
    if (!Number.isSafeInteger(assertion.assertedAt) || assertion.assertedAt < 0) {
      throw new Error("markDisputedAssertions: each assertion needs assertedAt");
    }
    return {
      assertion,
      disputed:
        assertion.person === claim.person && assertion.assertedAt >= claim.compromisedSince,
    };
  });
}
