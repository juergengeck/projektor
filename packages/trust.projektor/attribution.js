export const ACT_PARTICIPATION_STATEMENT_TYPE = "ProjektorActParticipationStatement";
export const ACT_PARTICIPATION_BUNDLE_TYPE = "ProjektorActParticipationAttestationBundle";
export const ACT_PARTICIPATION_STATUS_TYPE = "ProjektorActParticipationBundleStatus";
export const ACT_ATTRIBUTION_ASSESSMENT_TYPE = "ProjektorActAttributionAssessment";
export const RELIANCE_CERTIFICATE_TYPE = "ProjektorRelianceCertificate";
export const RELIANCE_BUNDLE_TYPE = "ProjektorRelianceAttestationBundle";

export const ACT_PARTICIPATION_PURPOSE = "act-participation";
export const RELIANCE_PURPOSE = "act-reliance";

const ACT_TYPES = new Set([
  "Assembly",
  "GroupMembershipAttestationBundle",
  "GroupDisclosureAttestationBundle",
]);

const actReference = itemprop => ({
  itemprop,
  itemtype: {type: "referenceToObj", allowedTypes: ACT_TYPES},
});

const referenceSet = (itemprop, allowedTypes) => ({
  itemprop,
  itemtype: {
    type: "set",
    item: {type: "referenceToObj", allowedTypes: new Set(allowedTypes)},
  },
});

const standardAttestationRules = claimType => [
  {itemprop: "claim", itemtype: {type: "referenceToObj", allowedTypes: new Set([claimType])}},
  {itemprop: "signature", itemtype: {type: "referenceToObj", allowedTypes: new Set(["Signature"])}},
  {itemprop: "signingKeys", itemtype: {type: "referenceToObj", allowedTypes: new Set(["Keys"])}},
  referenceSet("issuerKeyBundles", ["IssuerKeyCertificateBundle"]),
  {itemprop: "purpose", itemtype: {type: "string"}},
  {itemprop: "authoredAt", itemtype: {type: "number"}},
  {itemprop: "attributionTier", itemtype: {type: "string", regexp: /^(custody|participation-backed)$/}},
  referenceSet("participationEvidence", ["*"]),
];

export const ActParticipationLicense = {
  $type$: "License",
  name: "ProjektorActParticipation",
  description:
    "The [signature.issuer] [value] authorship of exact act [act] at [statedAt].",
};

export const ActParticipationStatementRecipe = {
  $type$: "Recipe",
  name: ACT_PARTICIPATION_STATEMENT_TYPE,
  rule: [
    actReference("act"),
    {itemprop: "person", itemtype: {type: "referenceToId", allowedTypes: new Set(["Person"])}},
    {itemprop: "value", itemtype: {type: "string", regexp: /^(affirmed|repudiated)$/}},
    {itemprop: "statedAt", itemtype: {type: "number"}},
    {itemprop: "license", itemtype: {type: "referenceToObj", allowedTypes: new Set(["License"])}},
  ],
};

export const ActParticipationAttestationBundleRecipe = {
  $type$: "Recipe",
  name: ACT_PARTICIPATION_BUNDLE_TYPE,
  rule: standardAttestationRules(ACT_PARTICIPATION_STATEMENT_TYPE),
};

export const ActParticipationBundleStatusRecipe = {
  $type$: "Recipe",
  name: ACT_PARTICIPATION_STATUS_TYPE,
  rule: [
    {itemprop: "$version$", itemtype: {type: "string", regexp: /^1$/}},
    {itemprop: "receiver", isId: true, itemtype: {type: "referenceToId", allowedTypes: new Set(["Person"])}},
    {itemprop: "bundle", isId: true, itemtype: {type: "referenceToObj", allowedTypes: new Set([ACT_PARTICIPATION_BUNDLE_TYPE])}},
    {itemprop: "state", itemtype: {type: "string", regexp: /^(verified|pending-authority|rejected)$/}},
    {itemprop: "evaluatedAt", itemtype: {type: "number"}},
    referenceSet("trustEvidence", ["*"]),
    {itemprop: "requiredRootAuthority", optional: true, itemtype: {type: "referenceToObj", allowedTypes: new Set(["IssuerKeyRootAuthority"])}},
    {itemprop: "rejectionCode", optional: true, itemtype: {type: "string"}},
  ],
};

export const ActAttributionAssessmentRecipe = {
  $type$: "Recipe",
  name: ACT_ATTRIBUTION_ASSESSMENT_TYPE,
  rule: [
    {itemprop: "receiver", itemtype: {type: "referenceToId", allowedTypes: new Set(["Person"])}},
    actReference("act"),
    {itemprop: "person", itemtype: {type: "referenceToId", allowedTypes: new Set(["Person"])}},
    {itemprop: "asOfTime", itemtype: {type: "number"}},
    {itemprop: "baseTier", itemtype: {type: "string", regexp: /^(custody|participation-backed)$/}},
    {itemprop: "state", itemtype: {type: "string", regexp: /^(affirmed|repudiated|neither)$/}},
    {itemprop: "effectiveTier", itemtype: {type: "string", regexp: /^(custody|participation-backed)$/}},
    referenceSet("statementBundles", [ACT_PARTICIPATION_BUNDLE_TYPE]),
    referenceSet("statementStatuses", [ACT_PARTICIPATION_STATUS_TYPE]),
  ],
};

export const RelianceLicense = {
  $type$: "License",
  name: "ProjektorReliance",
  description:
    "The [signature.issuer] relied on exact act [act] at [reliedAt] under assessment [assessment].",
};

export const RelianceCertificateRecipe = {
  $type$: "Recipe",
  name: RELIANCE_CERTIFICATE_TYPE,
  rule: [
    actReference("act"),
    {itemprop: "attributedPerson", itemtype: {type: "referenceToId", allowedTypes: new Set(["Person"])}},
    {itemprop: "relyingParty", itemtype: {type: "referenceToId", allowedTypes: new Set(["Person"])}},
    {itemprop: "assessment", itemtype: {type: "referenceToObj", allowedTypes: new Set([ACT_ATTRIBUTION_ASSESSMENT_TYPE])}},
    {itemprop: "tierAtReliance", itemtype: {type: "string", regexp: /^(custody|participation-backed)$/}},
    {itemprop: "statementStateAtReliance", itemtype: {type: "string", regexp: /^(affirmed|repudiated|neither)$/}},
    {itemprop: "reliedAt", itemtype: {type: "number"}},
    {itemprop: "license", itemtype: {type: "referenceToObj", allowedTypes: new Set(["License"])}},
  ],
};

export const RelianceAttestationBundleRecipe = {
  $type$: "Recipe",
  name: RELIANCE_BUNDLE_TYPE,
  rule: standardAttestationRules(RELIANCE_CERTIFICATE_TYPE),
};

export const ProjektorAttributionRecipes = [
  ActParticipationStatementRecipe,
  ActParticipationAttestationBundleRecipe,
  ActParticipationBundleStatusRecipe,
  ActAttributionAssessmentRecipe,
  RelianceCertificateRecipe,
  RelianceAttestationBundleRecipe,
];

export const ProjektorAttributionReverseMaps = [
  [ACT_PARTICIPATION_STATEMENT_TYPE, new Set(["act", "person"])],
  [ACT_PARTICIPATION_BUNDLE_TYPE, new Set(["claim"])],
  [ACT_PARTICIPATION_STATUS_TYPE, new Set(["bundle", "receiver"])],
  [ACT_ATTRIBUTION_ASSESSMENT_TYPE, new Set(["act", "person", "receiver"])],
  [RELIANCE_CERTIFICATE_TYPE, new Set(["act", "relyingParty", "assessment"])],
  [RELIANCE_BUNDLE_TYPE, new Set(["claim"])],
];

function hash(value, field) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${field} must be a ONE hash`);
  }
  return value;
}

function time(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function hashSet(values, field, {allowEmpty = false} = {}) {
  if (!Array.isArray(values) && !(values instanceof Set)) {
    throw new Error(`${field} must be an array or Set`);
  }
  const result = new Set(values);
  if (Array.isArray(values) && result.size !== values.length) {
    throw new Error(`${field} must not contain duplicates`);
  }
  if (!allowEmpty && result.size === 0) throw new Error(`${field} must not be empty`);
  for (const value of result) hash(value, field);
  return result;
}

function tier(value, field = "attributionTier") {
  if (value !== "custody" && value !== "participation-backed") {
    throw new Error(`${field} must be custody or participation-backed`);
  }
  return value;
}

export function createActParticipationStatementData({act, person, value, statedAt} = {}) {
  if (value !== "affirmed" && value !== "repudiated") {
    throw new Error("value must be affirmed or repudiated");
  }
  return {
    act: hash(act, "act"),
    person: hash(person, "person"),
    value,
    statedAt: time(statedAt, "statedAt"),
  };
}

export function createAttributionBundle(type, authored) {
  if (type !== ACT_PARTICIPATION_BUNDLE_TYPE && type !== RELIANCE_BUNDLE_TYPE) {
    throw new Error("Unsupported attribution bundle type");
  }
  const attributionTier = tier(authored.attributionTier);
  const participationEvidence = hashSet(
    authored.participationEvidenceHashes,
    "participationEvidenceHashes",
    {allowEmpty: attributionTier === "custody"},
  );
  if (attributionTier === "custody" && participationEvidence.size !== 0) {
    throw new Error("custody authorship must not carry participation evidence");
  }
  if (typeof authored.purpose !== "string" || authored.purpose.trim() === "") {
    throw new Error("purpose is required");
  }
  return {
    $type$: type,
    claim: hash(authored.claimHash, "claimHash"),
    signature: hash(authored.signatureHash, "signatureHash"),
    signingKeys: hash(authored.signingKeysHash, "signingKeysHash"),
    issuerKeyBundles: hashSet(authored.issuerKeyBundleHashes, "issuerKeyBundleHashes"),
    purpose: authored.purpose,
    authoredAt: time(authored.authoredAt, "authoredAt"),
    attributionTier,
    participationEvidence,
  };
}

export function createActParticipationStatus({receiver, bundle, result, evaluatedAt} = {}) {
  if (!["verified", "pending-authority", "rejected"].includes(result?.state)) {
    throw new Error("result.state must be verified, pending-authority or rejected");
  }
  const status = {
    $type$: ACT_PARTICIPATION_STATUS_TYPE,
    $version$: "1",
    receiver: hash(receiver, "receiver"),
    bundle: hash(bundle, "bundle"),
    state: result.state,
    evaluatedAt: time(evaluatedAt, "evaluatedAt"),
    trustEvidence: hashSet(result.evidenceHashes ?? [], "trustEvidence", {allowEmpty: true}),
  };
  if (result.state === "verified" && status.trustEvidence.size === 0) {
    throw new Error("verified status requires trust evidence");
  }
  if (result.requiredRootAuthority) {
    status.requiredRootAuthority = hash(result.requiredRootAuthority, "requiredRootAuthority");
  }
  if (result.rejectionCode) status.rejectionCode = String(result.rejectionCode);
  return status;
}

export function deriveActAttribution({baseTier, statements, asOfTime} = {}) {
  const originalTier = tier(baseTier, "baseTier");
  const evaluatedAt = time(asOfTime, "asOfTime");
  if (!Array.isArray(statements)) throw new Error("statements must be an array");
  const eligible = statements.filter(statement => {
    if (statement?.$type$ !== ACT_PARTICIPATION_STATEMENT_TYPE) {
      throw new Error("statements must contain ProjektorActParticipationStatement objects");
    }
    time(statement.statedAt, "statement.statedAt");
    return statement.statedAt <= evaluatedAt;
  });
  if (eligible.length === 0) {
    return {
      state: originalTier === "participation-backed" ? "affirmed" : "neither",
      effectiveTier: originalTier,
    };
  }
  const newestAt = Math.max(...eligible.map(statement => statement.statedAt));
  const newestValues = new Set(
    eligible.filter(statement => statement.statedAt === newestAt).map(statement => statement.value),
  );
  if (newestValues.size !== 1) {
    throw new Error("Concurrent opposite participation statements require causal resolution");
  }
  const state = [...newestValues][0];
  return {
    state,
    effectiveTier: state === "affirmed" ? "participation-backed" : originalTier,
  };
}

export function createActAttributionAssessment({
  receiver,
  act,
  person,
  asOfTime,
  baseTier,
  statements,
  statementBundles,
  statementStatuses,
} = {}) {
  const derived = deriveActAttribution({baseTier, statements, asOfTime});
  return {
    $type$: ACT_ATTRIBUTION_ASSESSMENT_TYPE,
    receiver: hash(receiver, "receiver"),
    act: hash(act, "act"),
    person: hash(person, "person"),
    asOfTime: time(asOfTime, "asOfTime"),
    baseTier: tier(baseTier, "baseTier"),
    state: derived.state,
    effectiveTier: derived.effectiveTier,
    statementBundles: hashSet(statementBundles ?? [], "statementBundles", {allowEmpty: true}),
    statementStatuses: hashSet(statementStatuses ?? [], "statementStatuses", {allowEmpty: true}),
  };
}

export function createRelianceCertificateData({assessment, relyingParty, reliedAt} = {}) {
  if (assessment?.$type$ !== ACT_ATTRIBUTION_ASSESSMENT_TYPE) {
    throw new Error("assessment must be a ProjektorActAttributionAssessment");
  }
  const relied = time(reliedAt, "reliedAt");
  if (assessment.asOfTime !== relied) {
    throw new Error("reliance must use an assessment made exactly at reliedAt");
  }
  return {
    act: hash(assessment.act, "assessment.act"),
    attributedPerson: hash(assessment.person, "assessment.person"),
    relyingParty: hash(relyingParty, "relyingParty"),
    assessment: hash(assessment.hash, "assessment.hash"),
    tierAtReliance: tier(assessment.effectiveTier, "assessment.effectiveTier"),
    statementStateAtReliance: assessment.state,
    reliedAt: relied,
  };
}
