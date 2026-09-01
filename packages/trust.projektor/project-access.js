import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { rosterAsOf } from "../group.core/index.js";

export const PROJECT_ACCESS_ASSERTION_TYPE = "ProjectAccessAssertion";

export const ProjectAccessLicense = {
  $type$: "License",
  name: "ProjectAccess",
  description:
    "The [signature.issuer] grants group [group] access to [record] in project [projectId] as of [grantedAt].",
};

export const ProjectAccessAssertionRecipe = {
  $type$: "Recipe",
  name: PROJECT_ACCESS_ASSERTION_TYPE,
  rule: [
    { itemprop: "group", itemtype: { type: "referenceToId", allowedTypes: new Set(["Group"]) } },
    { itemprop: "hashGroup", optional: true, itemtype: { type: "referenceToObj", allowedTypes: new Set(["HashGroup"]) } },
    { itemprop: "binding", itemtype: { type: "string", regexp: /^(living|pinned)$/ } },
    { itemprop: "record", itemtype: { type: "string" } },
    { itemprop: "projectId", itemtype: { type: "string" } },
    { itemprop: "grantedAt", itemtype: { type: "number" } },
    { itemprop: "license", itemtype: { type: "referenceToObj", allowedTypes: new Set(["License"]) } },
  ],
};

export const ProjectAccessAssertionReverseMap = [
  PROJECT_ACCESS_ASSERTION_TYPE,
  new Set(["group"]),
];

function text(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ProjectAccessAssertion: ${field} is required`);
  }
  return value.trim();
}

function hash(value, field) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) {
    throw new Error(`ProjectAccessAssertion: ${field} must be a ONE hash`);
  }
  return value;
}

export function createProjectAccessAssertionData({
  group,
  hashGroup,
  binding,
  record,
  projectId,
  grantedAt,
} = {}) {
  if (binding !== "living" && binding !== "pinned") {
    throw new Error('ProjectAccessAssertion: binding must be "living" or "pinned"');
  }
  if (!Number.isSafeInteger(grantedAt) || grantedAt < 0) {
    throw new Error("ProjectAccessAssertion: grantedAt is required");
  }
  if (binding === "pinned" && !hashGroup) {
    throw new Error("ProjectAccessAssertion: pinned grant requires hashGroup");
  }
  const data = {
    group: hash(group, "group"),
    binding,
    record: text(record, "record"),
    projectId: text(projectId, "projectId"),
    grantedAt,
  };
  if (binding === "pinned") data.hashGroup = hash(hashGroup, "hashGroup");
  return data;
}

export async function resolveGrantAudience(assertion, atTime) {
  if (assertion?.$type$ !== PROJECT_ACCESS_ASSERTION_TYPE) {
    throw new Error("resolveGrantAudience: assertion must be a ProjectAccessAssertion");
  }
  if (assertion.binding === "pinned") {
    const hashGroup = await getObject(assertion.hashGroup);
    if (hashGroup.$type$ !== "HashGroup") {
      throw new Error("resolveGrantAudience: pinned assertion references a non-HashGroup");
    }
    return [...hashGroup.person].sort();
  }
  return rosterAsOf(assertion.group, atTime);
}
