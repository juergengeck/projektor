import {
  GroupMembershipRecipes,
  GroupMembershipReverseMaps,
} from "./membership.js";
import {
  ProjektorEvidenceRecipes,
  ProjektorEvidenceReverseMaps,
} from "./evidence.js";
import {
  ProjectAccessAssertionRecipe,
  ProjectAccessAssertionReverseMap,
} from "./project-access.js";
import {
  ProjektorEvidenceDisputeRecipe,
  ProjektorEvidenceDisputeReverseMap,
} from "./disputes.js";
import {
  ProjektorAttributionRecipes,
  ProjektorAttributionReverseMaps,
} from "./attribution.js";

export * from "./membership.js";
export * from "./evidence.js";
export * from "./project-access.js";
export * from "./disputes.js";
export * from "./membership-model.js";
export * from "./issuance.js";
export * from "./attestation-definitions.js";
export * from "./attestations.js";
export * from "./attribution.js";
export * from "./attribution-model.js";
export * from "./module.js";

export const ProjektorTrustRecipes = [
  ...GroupMembershipRecipes,
  ...ProjektorEvidenceRecipes,
  ProjectAccessAssertionRecipe,
  ProjektorEvidenceDisputeRecipe,
  ...ProjektorAttributionRecipes,
];

export function mergeReverseMaps(...groups) {
  const merged = new Map();
  for (const [type, properties] of groups.flat()) {
    const existing = merged.get(type) ?? new Set();
    for (const property of properties) existing.add(property);
    merged.set(type, existing);
  }
  return [...merged.entries()];
}

export const ProjektorTrustReverseMaps = mergeReverseMaps(
  GroupMembershipReverseMaps,
  ProjektorEvidenceReverseMaps,
  [ProjectAccessAssertionReverseMap],
  [ProjektorEvidenceDisputeReverseMap],
  ProjektorAttributionReverseMaps,
);

export const ProjektorTrustGraphTypes = new Set([
  ...ProjektorTrustRecipes.map((recipe) => recipe.name),
  "Signature",
  "Keys",
  "Certificate",
  "IssuerKeyCertificateBundle",
  "IssuerKeyBundleStatus",
  "IssuerKeyRootAuthority",
  "IssuerKeyRootSelection",
  "EffectiveIssuerKeyHead",
  "Assembly",
  "Group",
  "HashGroup",
  "Person",
  "License",
]);
