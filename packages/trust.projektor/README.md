# trust.projektor

Projektor's domain trust policy for group membership, disclosure, project
access and evidence disputes.

The package owns three distinct layers of membership evidence:

1. `GroupMembershipAttestationBundle` is the immutable portable root containing
   the exact claim, signature, signing Keys and issuer-key bundle.
2. `GroupMembershipBundleStatus` is a receiver-local decision from trust.core's
   exact verification result.
3. `EffectiveGroupMembership` is the versioned receiver-local projection used
   by authorization. It narrows all evidence in one lineage: the earliest
   `validUntil` and the most restrictive `mayReshare` win.

`GroupDisclosureCertificate` records the exact `HashGroup`, recipient,
authorizing effective-projection version and all source bundle/status versions.
A signature alone never authorizes disclosure: the verified signer must be the
Group owner for membership, the roster pin must match, the sharer must still be
in that structural roster at action time, and the effective membership must
permit re-sharing.

`ProjektorAttestationDefinitions` is the immutable configuration passed to
trust.core's `TypedAttestationService`. It names each claim type, its License and
its one informed reverse-map property. The package never imports or constructs
Leute/contact models and never scans wildcard certificate types.

Project access keeps its audience semantics explicit:

- `living` follows the Group version in force at evaluation time;
- `pinned` reads the exact referenced HashGroup forever.

`ProjektorEvidenceDispute` is a domain signal. It can mark assertions disputed
from `compromisedSince`, but it does not rewrite historical key verification or
certificate validity.

Attribution and reliance are append-only evidence too:

- A structurally valid `Assembly` proves that its named credential authored one
  exact versioned occurrence. It does not prove personal participation, so a
  bare Assembly and a custody-tier attestation both assess as `neither`.
- `ProjektorActParticipationStatement` is the one participation-backed mechanism
  for affirming or repudiating an exact act. Its issuer must be the person already
  attributed to that act.
- `ProjektorActAttributionAssessment` stores the receiver's complete local
  evidence cut at one decision time. Its state is explicitly `affirmed`,
  `repudiated`, or `neither`.
- `ProjektorRelianceCertificate` points to that exact immutable assessment and
  records the tier visible when reliance occurred. Later evidence can affect the
  next assessment, but cannot rewrite the relied-on one.

`TypedAttestationService` labels every attestation `custody` or
`participation-backed`. Raw software-key signing can issue only the custody tier;
participation-backed statements fail closed unless the runtime supplies an
explicit user-verifying signer and verifier.

The certificate-shaped Projektor claims are unversioned and use exact detached
signatures. They do not carry a synthetic Assembly occurrence. Domains that
need causal Assembly history must first define a real versioned semantic
payload; `trust.projektor` does not duplicate Assembly construction or
verification.

`ProjektorTrustModule` is the runtime boundary. It requires an
`EffectiveIssuerKeyProvider`, assembly.core's read-only
`AssemblyAuthorshipVerifier`, exact receiver configuration, and optionally the
user-verifying participation signer/verifier. It supplies the configured typed
attestation service plus the membership/disclosure and attribution/reliance
models, and registers their public operations in the `trust.projektor` domain.
It deliberately has no `LeuteModel` or `AssemblyStore` demand. The verifier is
what lets it establish a bare Assembly's signer without gaining authority to
author or publish Assemblies.
