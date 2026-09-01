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
