export const GROUP_MEMBERSHIP_CERTIFICATE_TYPE = "GroupMembershipCertificate";

export const GroupMembershipLicense = {
  $type$: "License",
  name: "GroupMembership",
  description:
    "The [signature.issuer] certifies at [issuedAt] that [person] was a member of roster [hashGroup] of group [group] from [validFrom] until [validUntil].",
};

export const GroupMembershipCertificateRecipe = {
  $type$: "Recipe",
  name: GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  rule: [
    {
      itemprop: "group",
      itemtype: { type: "referenceToId", allowedTypes: new Set(["Group"]) },
    },
    {
      itemprop: "hashGroup",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["HashGroup"]) },
    },
    {
      itemprop: "person",
      itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) },
    },
    { itemprop: "mayReshare", itemtype: { type: "boolean" } },
    { itemprop: "issuedAt", itemtype: { type: "number" } },
    { itemprop: "validFrom", itemtype: { type: "number" } },
    { itemprop: "validUntil", itemtype: { type: "number" } },
    { itemprop: "learnedAt", itemtype: { type: "number" }, optional: true },
    { itemprop: "revocationReason", itemtype: { type: "string" }, optional: true },
    {
      itemprop: "license",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["License"]) },
    },
  ],
};

export const GroupMembershipCertificateReverseMap = [
  GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  new Set(["group"]),
];

export const GroupMembershipRecipes = [GroupMembershipCertificateRecipe];
export const GroupMembershipReverseMaps = [GroupMembershipCertificateReverseMap];

function required(value, field) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`GroupMembershipCertificate: ${field} is required`);
  }
  return value;
}

function hash(value, field) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`GroupMembershipCertificate: ${field} must be a ONE hash`);
  }
  return value;
}

function timestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`GroupMembershipCertificate: ${field} must be a non-negative integer`);
  }
  return value;
}

export function createGroupMembershipCertificateData({
  group,
  hashGroup,
  person,
  mayReshare = false,
  issuedAt,
  validFrom,
  validUntil,
} = {}) {
  const from = timestamp(validFrom, "validFrom");
  const until = timestamp(validUntil, "validUntil");
  const issued = timestamp(issuedAt, "issuedAt");
  if (until <= from) {
    throw new Error("GroupMembershipCertificate: validUntil must be after validFrom");
  }
  if (issued < from || issued > until) {
    throw new Error("GroupMembershipCertificate: issuedAt must be within the validity boundary");
  }
  if (typeof mayReshare !== "boolean") {
    throw new Error("GroupMembershipCertificate: mayReshare must be a boolean");
  }
  return {
    group: hash(group, "group"),
    hashGroup: hash(hashGroup, "hashGroup"),
    person: hash(person, "person"),
    mayReshare,
    issuedAt: issued,
    validFrom: from,
    validUntil: until,
  };
}

export function isMembershipValidAt(certificate, atTime) {
  timestamp(atTime, "atTime");
  return certificate.validFrom <= atTime && atTime < certificate.validUntil;
}

function lineageKey(certificate) {
  return [
    certificate.group,
    certificate.hashGroup,
    certificate.person,
    certificate.validFrom,
  ].join(":");
}

export function effectiveMembershipWindow(certificates) {
  if (!Array.isArray(certificates) || certificates.length === 0) {
    throw new Error("effectiveMembershipWindow: certificates are required");
  }
  const expected = lineageKey(certificates[0]);
  for (const certificate of certificates) {
    if (certificate?.$type$ !== GROUP_MEMBERSHIP_CERTIFICATE_TYPE) {
      throw new Error("effectiveMembershipWindow: every entry must be a GroupMembershipCertificate");
    }
    if (lineageKey(certificate) !== expected) {
      throw new Error("effectiveMembershipWindow: certificates must belong to one lineage");
    }
  }
  return {
    validFrom: certificates[0].validFrom,
    validUntil: Math.min(...certificates.map((entry) => entry.validUntil)),
    mayReshare: certificates.every((entry) => entry.mayReshare === true),
  };
}

export function revokeMembershipCertificate(
  previous,
  { revokedAt, learnedAt, reason, endAt } = {},
) {
  if (!previous || previous.$type$ !== GROUP_MEMBERSHIP_CERTIFICATE_TYPE) {
    throw new Error("GroupMembershipCertificate: previous certificate is required");
  }
  const at = timestamp(revokedAt, "revokedAt");
  if (at > previous.validUntil) {
    throw new Error("GroupMembershipCertificate: cannot revoke an already-ended membership");
  }
  const end = endAt === undefined ? at : timestamp(endAt, "endAt");
  if (end < at) {
    throw new Error("GroupMembershipCertificate: endAt may not precede revokedAt");
  }
  if (end <= previous.validFrom) {
    throw new Error("GroupMembershipCertificate: revocation must end after validFrom");
  }
  const { $type$: _type, license: _license, ...carried } = previous;
  const result = {
    ...carried,
    issuedAt: at,
    validUntil: Math.min(previous.validUntil, end),
    revocationReason: required(reason, "revocationReason"),
  };
  if (learnedAt !== undefined) {
    result.learnedAt = timestamp(learnedAt, "learnedAt");
  }
  return result;
}
