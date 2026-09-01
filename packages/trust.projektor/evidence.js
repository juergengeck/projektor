export const GROUP_MEMBERSHIP_BUNDLE_TYPE = "GroupMembershipAttestationBundle";
export const GROUP_MEMBERSHIP_STATUS_TYPE = "GroupMembershipBundleStatus";
export const EFFECTIVE_GROUP_MEMBERSHIP_TYPE = "EffectiveGroupMembership";
export const GROUP_DISCLOSURE_CERTIFICATE_TYPE = "GroupDisclosureCertificate";
export const GROUP_DISCLOSURE_BUNDLE_TYPE = "GroupDisclosureAttestationBundle";

const referenceSet = (itemprop, allowedTypes) => ({
  itemprop,
  itemtype: {
    type: "set",
    item: { type: "referenceToObj", allowedTypes: new Set(allowedTypes) },
  },
});

export const GroupMembershipAttestationBundleRecipe = {
  $type$: "Recipe",
  name: GROUP_MEMBERSHIP_BUNDLE_TYPE,
  rule: [
    { itemprop: "claim", itemtype: { type: "referenceToObj", allowedTypes: new Set(["GroupMembershipCertificate"]) } },
    { itemprop: "signature", itemtype: { type: "referenceToObj", allowedTypes: new Set(["Signature"]) } },
    { itemprop: "signingKeys", itemtype: { type: "referenceToObj", allowedTypes: new Set(["Keys"]) } },
    referenceSet("issuerKeyBundles", ["IssuerKeyCertificateBundle"]),
    { itemprop: "purpose", itemtype: { type: "string" } },
    { itemprop: "authoredAt", itemtype: { type: "number" } },
    { itemprop: "assemblyOccurrence", optional: true, itemtype: { type: "referenceToObj", allowedTypes: new Set(["Assembly"]) } },
  ],
};

export const GroupMembershipBundleStatusRecipe = {
  $type$: "Recipe",
  name: GROUP_MEMBERSHIP_STATUS_TYPE,
  rule: [
    { itemprop: "$version$", itemtype: { type: "string", regexp: /^1$/ } },
    { itemprop: "receiver", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } },
    { itemprop: "bundle", isId: true, itemtype: { type: "referenceToObj", allowedTypes: new Set([GROUP_MEMBERSHIP_BUNDLE_TYPE]) } },
    { itemprop: "state", itemtype: { type: "string", regexp: /^(verified|pending-authority|rejected)$/ } },
    { itemprop: "evaluatedAt", itemtype: { type: "number" } },
    referenceSet("trustEvidence", [
      "Certificate",
      "IssuerKeyCertificateBundle",
      "IssuerKeyBundleStatus",
      "IssuerKeyRootAuthority",
      "IssuerKeyRootSelection",
      "EffectiveIssuerKeyHead",
      "Assembly",
    ]),
    { itemprop: "requiredRootAuthority", optional: true, itemtype: { type: "referenceToObj", allowedTypes: new Set(["IssuerKeyRootAuthority"]) } },
    { itemprop: "rejectionCode", optional: true, itemtype: { type: "string" } },
  ],
};

export const EffectiveGroupMembershipRecipe = {
  $type$: "Recipe",
  name: EFFECTIVE_GROUP_MEMBERSHIP_TYPE,
  rule: [
    { itemprop: "$version$", itemtype: { type: "string", regexp: /^1$/ } },
    { itemprop: "receiver", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } },
    { itemprop: "group", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set(["Group"]) } },
    { itemprop: "hashGroup", isId: true, itemtype: { type: "referenceToObj", allowedTypes: new Set(["HashGroup"]) } },
    { itemprop: "person", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } },
    { itemprop: "validFrom", isId: true, itemtype: { type: "number" } },
    { itemprop: "state", itemtype: { type: "string", regexp: /^(current|non-current|conflicted)$/ } },
    { itemprop: "validUntil", itemtype: { type: "number" } },
    { itemprop: "mayReshare", itemtype: { type: "boolean" } },
    referenceSet("sourceBundles", [GROUP_MEMBERSHIP_BUNDLE_TYPE]),
    referenceSet("sourceStatuses", [GROUP_MEMBERSHIP_STATUS_TYPE]),
    { itemprop: "evaluatedAt", itemtype: { type: "number" } },
  ],
};

export const GroupDisclosureLicense = {
  $type$: "License",
  name: "GroupDisclosure",
  description:
    "The [signature.issuer] disclosed roster [hashGroup] of group [group] to [recipient] at [disclosedAt].",
};

export const GroupDisclosureCertificateRecipe = {
  $type$: "Recipe",
  name: GROUP_DISCLOSURE_CERTIFICATE_TYPE,
  rule: [
    { itemprop: "group", itemtype: { type: "referenceToId", allowedTypes: new Set(["Group"]) } },
    { itemprop: "hashGroup", itemtype: { type: "referenceToObj", allowedTypes: new Set(["HashGroup"]) } },
    { itemprop: "recipient", itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } },
    { itemprop: "sharer", itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } },
    { itemprop: "disclosedAt", itemtype: { type: "number" } },
    { itemprop: "authorizingProjection", itemtype: { type: "referenceToObj", allowedTypes: new Set([EFFECTIVE_GROUP_MEMBERSHIP_TYPE]) } },
    referenceSet("membershipBundles", [GROUP_MEMBERSHIP_BUNDLE_TYPE]),
    referenceSet("membershipStatuses", [GROUP_MEMBERSHIP_STATUS_TYPE]),
    { itemprop: "license", itemtype: { type: "referenceToObj", allowedTypes: new Set(["License"]) } },
  ],
};

export const GroupDisclosureAttestationBundleRecipe = {
  $type$: "Recipe",
  name: GROUP_DISCLOSURE_BUNDLE_TYPE,
  rule: [
    { itemprop: "claim", itemtype: { type: "referenceToObj", allowedTypes: new Set([GROUP_DISCLOSURE_CERTIFICATE_TYPE]) } },
    { itemprop: "signature", itemtype: { type: "referenceToObj", allowedTypes: new Set(["Signature"]) } },
    { itemprop: "signingKeys", itemtype: { type: "referenceToObj", allowedTypes: new Set(["Keys"]) } },
    referenceSet("issuerKeyBundles", ["IssuerKeyCertificateBundle"]),
    { itemprop: "purpose", itemtype: { type: "string" } },
    { itemprop: "authoredAt", itemtype: { type: "number" } },
    { itemprop: "assemblyOccurrence", optional: true, itemtype: { type: "referenceToObj", allowedTypes: new Set(["Assembly"]) } },
  ],
};

export const ProjektorEvidenceRecipes = [
  GroupMembershipAttestationBundleRecipe,
  GroupMembershipBundleStatusRecipe,
  EffectiveGroupMembershipRecipe,
  GroupDisclosureCertificateRecipe,
  GroupDisclosureAttestationBundleRecipe,
];

export const ProjektorEvidenceReverseMaps = [
  [GROUP_MEMBERSHIP_BUNDLE_TYPE, new Set(["claim"])],
  [GROUP_MEMBERSHIP_STATUS_TYPE, new Set(["bundle", "receiver"])],
  [EFFECTIVE_GROUP_MEMBERSHIP_TYPE, new Set(["group", "receiver", "person", "hashGroup"])],
  [GROUP_DISCLOSURE_CERTIFICATE_TYPE, new Set(["group", "recipient", "sharer"])],
  [GROUP_DISCLOSURE_BUNDLE_TYPE, new Set(["claim"])],
];

function required(value, field) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${field} is required`);
  }
  return value;
}

function timestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function hash(value, field) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`${field} must be a ONE hash`);
  }
  return value;
}

function exactSet(values, field) {
  if (!Array.isArray(values) && !(values instanceof Set)) {
    throw new Error(`${field} must be an array or Set`);
  }
  const result = new Set(values);
  if (result.size === 0) {
    throw new Error(`${field} must not be empty`);
  }
  for (const value of result) hash(value, field);
  return result;
}

export function createMembershipBundle(authored) {
  const bundle = {
    $type$: GROUP_MEMBERSHIP_BUNDLE_TYPE,
    claim: hash(authored.claimHash, "claimHash"),
    signature: hash(authored.signatureHash, "signatureHash"),
    signingKeys: hash(authored.signingKeysHash, "signingKeysHash"),
    issuerKeyBundles: exactSet(authored.issuerKeyBundleHashes, "issuerKeyBundleHashes"),
    purpose: required(authored.purpose, "purpose"),
    authoredAt: timestamp(authored.authoredAt, "authoredAt"),
  };
  if (authored.assemblyOccurrence) {
    bundle.assemblyOccurrence = hash(authored.assemblyOccurrence, "assemblyOccurrence");
  }
  return bundle;
}

export function createMembershipStatus({
  receiver,
  bundle,
  result,
  evaluatedAt,
}) {
  const trustEvidence = new Set(result.evidenceHashes ?? []);
  for (const value of trustEvidence) hash(value, "result.evidenceHashes");
  if (!["verified", "pending-authority", "rejected"].includes(result.state)) {
    throw new Error("result.state must be verified, pending-authority or rejected");
  }
  if (result.state === "verified" && trustEvidence.size === 0) {
    throw new Error("verified membership status requires exact trust evidence");
  }
  const status = {
    $type$: GROUP_MEMBERSHIP_STATUS_TYPE,
    $version$: "1",
    receiver: hash(receiver, "receiver"),
    bundle: hash(bundle, "bundle"),
    state: result.state,
    evaluatedAt: timestamp(evaluatedAt, "evaluatedAt"),
    trustEvidence,
  };
  if (result.requiredRootAuthority) {
    status.requiredRootAuthority = hash(result.requiredRootAuthority, "requiredRootAuthority");
  }
  if (result.rejectionCode) status.rejectionCode = result.rejectionCode;
  return status;
}

export function createDisclosureCertificateData({
  group,
  hashGroup,
  recipient,
  sharer,
  disclosedAt,
  authorizingProjection,
  membershipBundles,
  membershipStatuses,
}) {
  return {
    group: hash(group, "group"),
    hashGroup: hash(hashGroup, "hashGroup"),
    recipient: hash(recipient, "recipient"),
    sharer: hash(sharer, "sharer"),
    disclosedAt: timestamp(disclosedAt, "disclosedAt"),
    authorizingProjection: hash(authorizingProjection, "authorizingProjection"),
    membershipBundles: exactSet(membershipBundles, "membershipBundles"),
    membershipStatuses: exactSet(membershipStatuses, "membershipStatuses"),
  };
}

export function createDisclosureBundle(authored) {
  const bundle = {
    $type$: GROUP_DISCLOSURE_BUNDLE_TYPE,
    claim: hash(authored.claimHash, "claimHash"),
    signature: hash(authored.signatureHash, "signatureHash"),
    signingKeys: hash(authored.signingKeysHash, "signingKeysHash"),
    issuerKeyBundles: exactSet(authored.issuerKeyBundleHashes, "issuerKeyBundleHashes"),
    purpose: required(authored.purpose, "purpose"),
    authoredAt: timestamp(authored.authoredAt, "authoredAt"),
  };
  if (authored.assemblyOccurrence) {
    bundle.assemblyOccurrence = hash(authored.assemblyOccurrence, "assemblyOccurrence");
  }
  return bundle;
}
