# Group Definitions, Access, And Disclosure Records

Date: 2026-08-31
Status: Design, approved for planning. Revised 2026-08-31 to build on the
existing `Group` / `HashGroup` / `Signature` / certificate primitives rather
than restate them; the reasoning is unchanged.

## Problem

Participants need to share groups: both the *definition* of a group and *access*
granted through it. Sharing must leave an attributable record of what was shared
and with whom. Access to a group definition may be restricted to its
participants, disclosed to named individuals, or public.

"Sharing a group" folds together three mechanisms that must stay separate:

1. **The group definition** — who is in it.
2. **The access grant** — using the group as the audience of an Access object on
   other records. This is CHUM routing: what is actually transmitted.
3. **The disclosure record** — the signed, append-only assertion that a
   participant shared something with someone at a time.

The failure to avoid is deriving (3) from (2). Access grants are present-tense
capability, mutable, evaluated *now*. Disclosure records are evidence,
append-only, evaluated *as of assertion time*. This is the two-evaluation-times
split of [MR-3](../../projektor-mrd.md), applied to sharing rather than to
authority. Enumerating live Access objects to answer "who did I share this with"
returns today's answer to a historical question.

## Scope Decision: Groups Are Not Project-Scoped

Identity in this model is organization-level — the organization admin attests to
its users. Roles are the project-level primitive — project roles are bounded
certificates. A group is a named set of identities, so scoping it to a project
would scope a set more narrowly than its own elements.

The practical cost of project scoping is duplicated rosters: the same
subcontractors, authority contacts, and steering committees recur across projects
and HOAI phases, and per-project copies diverge silently.

Therefore a group carries no project field. The project appears only in
`ProjectAccessAssertion` — *group G was granted access to record R*. What might
be called a "project-scoped group" is a group issued under a project role
certificate: a fact about the issuer's authority, already carried by the chain.

This does not advance MR-3's deferred federation item, which concerns identity
across organizations. A group of one organization's already-org-wide identities
federates nothing.

**Accepted consequence.** An org-wide, long-lived group means adding a member can
extend access to every project that group was granted in. Two mitigations, both
required:

- A per-project view answering "which groups reach this project, and who is in
  them now," so the consequence is visible rather than discovered.
- Grant binding chosen per grant (see *Access grants* below).

## Object Model

Almost all of this exists. The platform provides the group, the roster, the
roster's pin, signatures, and the certificate pattern. This design adds one
thing to them: **time**. No existing certificate carries a validity window.

### Reused, not restated

| Concern | Type | Where |
|---|---|---|
| Group identity | `Group` — versioned, `isId: {name, owner}`, references a `HashGroup` | one.core |
| The roster, and its pin | `HashGroup` — unversioned, `{person: Set<referenceToId Person>}` | one.core |
| Roster history and ordering | the `Group` version DAG (`depth`, `creationTime`, `prev`, merge nodes) | `getVersionsNodes` |
| Signatures | `Signature` — `{issuer, data, signature}`, its own object | one.models |
| Certificate shape | an unversioned claim plus a `License`, issued via `TrustedKeysManager.certify` | one.models |
| Authority checks | `TrustedKeysManager.getCertificates` / `isCertifiedBy` | one.models |
| Access enforcement | `Access` links to `Group` | one.core |

`Group` carries `name` and `owner` and no project field — `owner` is the issuer
tier, which is the scope decision above already expressed in the type.

`HashGroup` is content-addressed over its member set, so **its hash is the
roster**. Not a pointer to a roster, not a descriptor that happens to travel
with one: the same members always produce the same hash, and any change produces
a different one. Nothing else is needed to pin membership, and nothing carried
alongside it could disagree with it.

### Added here

| Object | Kind | Purpose |
|---|---|---|
| `GroupMembershipCertificate` | unversioned certificate | Issuer certifies that a person was in the pinned `HashGroup`, for a validity window, with or without `mayReshare`. |
| `GroupDisclosureCertificate` | unversioned certificate | Who was shown which `HashGroup`, at what time, under which membership certificate. |
| `ProjectAccessAssertion` | unversioned certificate | A group granted access to a project record, bound living or pinned. The only project-scoped type here. |
| `KeyCompromiseClaim` | unversioned certificate | A retroactive trust change that disputes assertions rather than invalidating them. |

Each carries a `License` whose text names the fields it relies on, following the
one.models convention. None carries a `signature` field: signatures are separate
`Signature` objects, and a recipe declaring one is rejected by the serializer.

**A membership certificate pins a `HashGroup`, so it proves "was in this roster",
never "is in the group now".** The authoritative present-tense record is the
`Group` version DAG. This is what keeps the two evaluation times apart in the
type system rather than by convention, and it means an old certificate is not a
security hole — it is a true statement about the past.

### Hash discipline

- A **disclosure** references a `HashGroup` hash: the exact roster shown.
- A **living access grant** references the `Group` id hash and follows current
  membership.
- A **pinned access grant** references a `HashGroup` hash and is fixed to that
  roster.

There is no separate member list anywhere. The pinned audience *is* the
`HashGroup`, so no two fields can drift apart.

## Two Functions, Never One

```
rosterAsOf(groupIdHash, atTime)
  → evidence: who was in the group then

mayAct({groupIdHash, subject, now, replicaAsOf, maxStalenessMs})
  → access:   may this participant act now
```

There is deliberately no `getMembers(group)`. A caller must state which question
it is asking.

Both read the `Group` version DAG, which is the ordering authority — not a
timestamp field on the object. `rosterAsOf` selects the version in force at
`atTime` and reads its `HashGroup`. `mayAct` evaluates the present under a
stated freshness policy and throws `StaleChainError` when the local replica is
older than the policy allows, so a stale chain can never be misread as an
ordinary deny.

Concurrent unmerged versions are an explicit `ConcurrentVersionsError`, not an
arbitrary pick. Two versions at the same depth with no merge between them means
the roster genuinely is ambiguous at that time, and guessing would make an
access decision on a coin flip.

## Visibility: One Mechanism, Three Presets

The three modes are audiences over the `Group` object and its `HashGroup`, not
three code paths:

- **Participants** — audience is the group itself; members read their own roster.
- **Individuals** — an enumerated Person set. Requires `mayReshare` on the
  sharer's own membership certificate.
- **Public** — the `Group` is readable while its `HashGroup` is not.

Public therefore means **public identity, private roster**, and it needs no
additional concept because `Group` and `HashGroup` are already separate objects.
Publishing the `Group` publishes a *reference* to the roster, not the roster: a
verifier can check a claim against the group and a member can prove their own
membership, without a member list becoming a published personal-data set.

## Re-Sharing And Delegation

`mayReshare` on a membership certificate states whether that member may disclose
the definition onward. A `GroupDisclosureCertificate` may only be issued after
`TrustedKeysManager` confirms that the sharer holds a valid membership
certificate **for that group**, issued by the stated issuer, carrying
`mayReshare`, and valid at the disclosure time. "Shared by individuals" is a
granted capability, not an assumption.

Authority is read from stored certificates, never from a signature checked
against a key the caller supplied — verifying a signature against a key someone
hands you establishes nothing about issuer authority.

`mayReshare` governs disclosure of the definition only. Authority to grant a
group access to project records comes from the participant's project role
certificate, not from group membership.

**Stated limit.** The disclosure log is complete for a participant's own shares
and best-effort for downstream re-shares, bounded by which assertions have synced
to them. "Who holds this group definition" is not answerable. "Who I gave it to,
and who has told me they gave it to someone" is. Product language must say this
rather than implying a complete distribution list.

## Access Grants: Living Or Pinned

`ProjectAccessAssertion` carries a binding mode:

- **Living** — binds the `Group` id hash. New members gain access automatically.
  Correct for "all current structural engineers."
- **Pinned** — binds a `HashGroup` hash. The audience is that roster, and cannot
  drift. Correct for a sensitive decision record or a closed jury.

The assertion records which mode was chosen, so an auditor can see whether the
audience was open or closed at grant time.

## Revocation

One.models certificates are **unversioned**, so revocation cannot be ONE.core
supersession. It is instead a second certificate for the same membership period
carrying an earlier `validUntil`.

That only works under an explicit combining rule, and without one it does not
work at all: if a revoking certificate simply exists alongside the original, a
verifier that accepts *any* valid certificate will keep accepting the original
and the revocation will do nothing.

**Effective validity is the narrowest window across all certificates issued by
the same issuer, for the same person and group, sharing the same `validFrom`.**

- Revocation narrows. A later certificate with the same `validFrom` and an
  earlier `validUntil` takes effect, and every consumer must combine rather than
  pick.
- Nothing widens. A certificate cannot extend a window that another certificate
  already narrowed, so a replayed or forged "extension" achieves nothing.
- Renewal is a **new** membership period, with a later `validFrom`, evaluated on
  its own. It is not an extension of the old one.

This is MR-3's "supersession by a newer end time, never a deny list" expressed
over unversioned objects. Nothing is deleted, every certificate remains in the
record, and the narrowing is a pure function of what a verifier holds.

### Revocation ends authority when it is issued, never earlier

`validUntil = revokedAt`. A certificate whose window would end before an
assertion it authorized is refused at construction.

*The time of learning does not move `validUntil` either.* If an issuer learns of
a trust change on Monday and signs the revocation on Wednesday, backdating to
Monday destroys every good-faith assertion made in the gap. It also fails to
discriminate: it invalidates an honest participant's Tuesday approval and an
attacker's Tuesday signature identically.

The gap is still worth recording, as accountability rather than as validity.
Three timestamps, one validity rule:

| Field | Carried on | Effect on validity |
|---|---|---|
| `validUntil` = `revokedAt` | the revoking certificate | The only input. Never earlier than issuance. |
| `learnedAt` | the revoking certificate | None. Audit metadata: response latency is visible instead of hidden inside a rewritten window. |
| `compromisedSince` | a separate `KeyCompromiseClaim` | None. Marks assertions in the window **disputed**, never invalid. |

A genuine "this key was compromised as of last Tuesday" is therefore a separate
signed claim, not a `validUntil` rewrite. It flags the affected assertions so a
verifier re-weighs them, instead of deleting good evidence in order to reach the
bad. Backdating cannot make that distinction; a claim can.

**Scheduled expiry is not revocation.** A membership ending at the close of
Leistungsphase 3 is a future `validUntil` set at issuance — a bounded
certificate, needing none of the above.

### Two lessons from trust.core, which is not the reuse target

`trust.core` solves certificate versioning for a different shape of certificate,
and two of its behaviours must not be carried across:

1. **It backdates on revocation.** `revokeCertificate` sets `validUntil` to
   `now - 24h`, which is the retroactive-destruction outcome MR-3's rationale
   calls indefensible.
2. **`isRevoked(cert)` takes no `atTime`** and reads only the latest version. It
   is a correct access-control check and a wrong evidence check: it structurally
   cannot answer "was this valid then", and it conflates expiry with revocation,
   which MR-3 requires be kept distinct. `rosterAsOf` and `mayAct` replace it and
   neither delegates to it.

## Disclosure Record Readership And Bundles

A disclosure record is itself sensitive — "I disclosed group *Legal Review* to P"
leaks both a roster and a relationship. Default readership is **the sharer and
the recipient**. The record still exists as evidence and surfaces in an audit
bundle when that bundle's scope covers it; documenting what was shared does not
publish a disclosure graph.

Every bundle states its as-of time explicitly and labels which question it
answers: *these disclosures were validly made under chains valid at the time of
each* — not *this is who currently holds the data*.

**Revocation ends future sync; it does not retract delivered bytes.** The
interface must say "ends access going forward" and must never say "unshare."

## Testing

Standalone `node` test scripts using `node:assert/strict`, registered in the
`test` script, following the existing repository pattern. The tests that matter
are those that catch the conflation:

- A member removed today is still in `rosterAsOf` for a time before the removal,
  while `mayAct` now denies them.
- `rosterAsOf` reads the `Group` version in force at the evaluated time, so a
  later version never reaches back into an earlier answer.
- Concurrent unmerged versions raise `ConcurrentVersionsError` rather than
  resolving to whichever the storage happened to return first.
- `mayAct` throws `StaleChainError` when the replica is staler than the policy.
- A revoking certificate narrows the effective window; the original certificate
  alongside it does **not** keep the membership alive.
- No certificate can widen a window another certificate narrowed.
- A revocation carrying a `learnedAt` earlier than `revokedAt` still ends
  authority at `revokedAt`; assertions made in that gap remain valid.
- A certificate for group A does not authorize disclosure of group B, and one
  belonging to another person, from another issuer, expired, or lacking
  `mayReshare` each fail closed.
- A `KeyCompromiseClaim` marks assertions in its window disputed while leaving
  them verifiable, and alters no certificate.
- A living grant admits a later-added member; a pinned grant does not.
- A `HashGroup` hash changes with membership, so a pinned grant cannot drift.

## Assumption

Glue occupies the attester slot for the participant's key binding, so a group
issued by a participant is bounded by that participant's own certificate in the
same way a role is. If glue instead sits at a different tier of the
refinio → organization admin → user chain, the issuer authority rules here need
revisiting; nothing else in this design changes.

## Out Of Scope

- Cross-organization identity federation (MR-3 defers it).
- Nested groups. A membership subject is an identity, not a group.
- Any mutable deny list, revocation list, or online revocation endpoint.
