import type {Keys, Person, Group, HashGroup} from "../../../one/packages/one.core/lib/recipes.js";
import type {SHA256Hash, SHA256IdHash} from "../../../one/packages/one.core/lib/util/type-checks.js";
import type {Signature} from "../../../one/packages/one.models/lib/recipes/SignatureRecipes.js";
import type {IssuerKeyCertificateBundle} from "../../../one/packages/trust.core/dist/recipes/IssuerKeyCertificateBundle.js";

export interface GroupMembershipCertificate {
  $type$: "GroupMembershipCertificate";
  group: SHA256IdHash<Group>;
  hashGroup: SHA256Hash<HashGroup<Person>>;
  person: SHA256IdHash<Person>;
  mayReshare: boolean;
  issuedAt: number;
  validFrom: number;
  validUntil: number;
  learnedAt?: number;
  revocationReason?: string;
  license: SHA256Hash;
}

export interface GroupMembershipAttestationBundle {
  $type$: "GroupMembershipAttestationBundle";
  claim: SHA256Hash<GroupMembershipCertificate>;
  signature: SHA256Hash<Signature>;
  signingKeys: SHA256Hash<Keys>;
  issuerKeyBundles: Set<SHA256Hash<IssuerKeyCertificateBundle>>;
  purpose: string;
  authoredAt: number;
  assemblyOccurrence?: SHA256Hash;
}

export interface GroupMembershipBundleStatus {
  $type$: "GroupMembershipBundleStatus";
  $version$: "1";
  receiver: SHA256IdHash<Person>;
  bundle: SHA256Hash<GroupMembershipAttestationBundle>;
  state: "verified" | "pending-authority" | "rejected";
  evaluatedAt: number;
  trustEvidence: Set<SHA256Hash>;
  requiredRootAuthority?: SHA256Hash;
  rejectionCode?: string;
}

export interface EffectiveGroupMembership {
  $type$: "EffectiveGroupMembership";
  $version$: "1";
  receiver: SHA256IdHash<Person>;
  group: SHA256IdHash<Group>;
  hashGroup: SHA256Hash<HashGroup<Person>>;
  person: SHA256IdHash<Person>;
  validFrom: number;
  state: "current" | "non-current" | "conflicted";
  validUntil: number;
  mayReshare: boolean;
  sourceBundles: Set<SHA256Hash<GroupMembershipAttestationBundle>>;
  sourceStatuses: Set<SHA256Hash<GroupMembershipBundleStatus>>;
  evaluatedAt: number;
}

export interface GroupDisclosureCertificate {
  $type$: "GroupDisclosureCertificate";
  group: SHA256IdHash<Group>;
  hashGroup: SHA256Hash<HashGroup<Person>>;
  recipient: SHA256IdHash<Person>;
  sharer: SHA256IdHash<Person>;
  disclosedAt: number;
  authorizingProjection: SHA256Hash<EffectiveGroupMembership>;
  membershipBundles: Set<SHA256Hash<GroupMembershipAttestationBundle>>;
  membershipStatuses: Set<SHA256Hash<GroupMembershipBundleStatus>>;
  license: SHA256Hash;
}

export interface GroupDisclosureAttestationBundle {
  $type$: "GroupDisclosureAttestationBundle";
  claim: SHA256Hash<GroupDisclosureCertificate>;
  signature: SHA256Hash<Signature>;
  signingKeys: SHA256Hash<Keys>;
  issuerKeyBundles: Set<SHA256Hash<IssuerKeyCertificateBundle>>;
  purpose: string;
  authoredAt: number;
  assemblyOccurrence?: SHA256Hash;
}

export interface ProjectAccessAssertion {
  $type$: "ProjectAccessAssertion";
  group: SHA256IdHash<Group>;
  hashGroup?: SHA256Hash<HashGroup<Person>>;
  binding: "living" | "pinned";
  record: string;
  projectId: string;
  grantedAt: number;
  license: SHA256Hash;
}

export interface ProjektorEvidenceDispute {
  $type$: "ProjektorEvidenceDispute";
  person: SHA256IdHash<Person>;
  compromisedSince: number;
  claimedAt: number;
  reason: string;
  license: SHA256Hash;
}

declare module "@OneObjectInterfaces" {
  interface OneUnversionedObjectInterfaces {
    GroupMembershipCertificate: GroupMembershipCertificate;
    GroupMembershipAttestationBundle: GroupMembershipAttestationBundle;
    GroupDisclosureCertificate: GroupDisclosureCertificate;
    GroupDisclosureAttestationBundle: GroupDisclosureAttestationBundle;
    ProjectAccessAssertion: ProjectAccessAssertion;
    ProjektorEvidenceDispute: ProjektorEvidenceDispute;
  }
  interface OneVersionedObjectInterfaces {
    GroupMembershipBundleStatus: GroupMembershipBundleStatus;
    EffectiveGroupMembership: EffectiveGroupMembership;
  }
}
