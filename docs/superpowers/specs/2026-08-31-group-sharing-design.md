# Group Definitions, Access, And Disclosure Records

Date: 2026-08-31
Status: Implemented package boundary. Revised 2026-09-01 to use trust.core's
typed-attestation and issuer-key lifecycle boundary and trust.projektor-owned
bundle/status/effective projections.

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

## Design Positions

These are decided, not open. Several read as gaps until the reasoning is stated,
so they are stated here.

**The group's identity border is deliberate.** `owner` is part of `Group`'s
`isId`, so an ownership change produces a different group rather than mutating
one. That is the point: the id hash bounds a scope of knowledge under one
issuing authority, and the boundary is visible rather than smeared. Continuity
across the border is the application's responsibility, exactly as a conversation
continuing across a new chat topic is. The trust layer does not span it.

The consequence is a discipline: anything that links one scope to its successor
is **app mechanics, not evidence**, and must be impossible to mistake for
evidence.

**Trust is always third-party, and time is no exception.** In a federated system
trust comes from peer attestation, not from an authority and not from a clock.
There is no trusted time source and there will not be one. What bounds a claimed
time is other parties attesting near it: an assertion cannot be backdated past
another party's attestation of a later state. `authoredAt` is a signed claim, and
the causal graph — not the wall clock — is what orders events.

**Erasure is answered by assembly sharing.** An `Assembly` carries its
predecessors, so the last state is not the only shareable one; an intermediate
state can be the valid one to share. Withholding is choosing which assembly to
release, not deleting from an append-only chain. This controls onward disclosure,
not copies already delivered — the same honest limit as revocation.

**Absence of knowledge is all we have.** No negative is provable. The record
shows what is known within a documented border, and its completeness claim is
bounded by that border rather than universal.

**Person and role are what is managed. Companies are represented by people.**
There is no organization object. A firm appears as the people acting for it under
a role, which is also what makes the accountable human visible in the record.

**`ReleaseState` is app mechanics, not evidence.** It tracks what has actually
been released so the application can manage assembly sharing. The disclosure
certificate attests that a disclosure was made. They answer different questions
and must not be merged: collapsed together, neither is trustworthy.

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
| Typed attestation | configured claim + `License`, exact detached signature and informed lookup | trust.core `TypedAttestationService` |
| Issuer-key authority | exact issuer bundle, receiver-local root selection/status and current heads | trust.core issuer-key lifecycle |
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
| `GroupMembershipCertificate` | unversioned certificate | Issuer certifies at signed `issuedAt` that a person was in the pinned `HashGroup`, for a validity window, with or without `mayReshare`. |
| `GroupDisclosureCertificate` | unversioned certificate | Who was shown which `HashGroup`, at what time, under which membership certificate. |
| `ProjectAccessAssertion` | unversioned certificate | A group granted access to a project record, bound living or pinned. The only project-scoped type here. |
| `ProjektorEvidenceDispute` | unversioned certificate | A Projektor-domain retroactive signal that disputes assertions rather than invalidating them. |
| membership/disclosure bundles | unversioned evidence roots | Exact claim, signature, Keys and issuer-key bundle provenance. |
| membership status/effective projection | versioned receiver-local objects | Retains the verifier's decision and bounded authorization state without a startup scan. |

Each carries a `License` whose text names the fields it relies on, following the
one.models convention. None carries a `signature` field: signatures are separate
`Signature` objects, and a recipe declaring one is rejected by the serializer.
The immutable evidence bundle's `authoredAt` must equal the signed semantic time
on its claim (`issuedAt` for membership, `disclosedAt` for disclosure), so a
claim cannot be repackaged under a different historical trust view.

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

## Roles And Organizations

Roles are not designed here from scratch. `one.flexibel` has a working model,
and Projektor's HOAI roles are the same shape with a different vocabulary.

**What flexibel does** (`docs/plans/2026-02-10-trust-roles-design.md`,
`one-experimental/packages/trust.core/src/recipes/`):

- **Two orthogonal layers.** trust.core's base level (`me | trusted | low |
  unknown | ignore`) governs transport, sync and ABAC. The application role
  (`admin | studyCenter | doctor | therapist | patient`) governs capability.
  Neither is derived from the other.
- **`RoleConfig<R>`** makes trust.core generic over an app's role vocabulary: a
  `rootRole` plus, per role, `canIssueRole`, `issuedBy` and `canSignIdentity`.
  Who may *grant a role* and who may *vouch for an identity* are separate
  permissions, which is a distinction Projektor's requirements do not yet make.
- **`RoleCertificate`** — versioned, `isId: id`, carrying `subject`, `role`,
  `issuedBy`, `issuerRole`, `issuedAt`, with a reverse map on both `subject` and
  `issuedBy` so it is queryable from either end.
- **`RoleCertChain`** bundles the whole root→leaf chain into one versioned
  object, so a single CHUM import delivers everything needed to evaluate it — no
  reverse-map queries, no retries, no arrival-order timing. Each entry enables
  the next.
- **The root is a ceremony, not a service.** The root keypair is generated
  locally, the private key shown once and wiped, the public key published at a
  well-known endpoint. Before publication the app runs in demo mode and the same
  chain becomes production once the key is published.

**How this maps.** Projektor's refinio → organization admin → user chain is
flexibel's admin → studyCenter → practitioner with different names, and the HOAI
roles are an app-defined `RoleConfig`. `RoleCertChain` is what makes MR-3's
"chain verification must be local and repeatable — no network call" and MR-6's
verification-without-adoption practical: the chain is one portable object.

**What Projektor must add.** `RoleCertificate` carries `issuedAt` and nothing
else temporal — no validity window — and no scope. MR-3 requires both: role
authority is phase-scoped, and its validity window is what expires. This is the
same gap as membership: the structure exists, time does not.

**Organizations.** A study centre is a role held by a person, not an entity. The
same applies to a Büro or a Bauamt: "which practice was accountable for LP3" is
answered by who held the role at that time, under the two-evaluation-times rule.
The role certificate is therefore where organizational accountability lives, and
it needs the validity window for that answer to be time-correct.

## Two Functions, Never One

```
rosterAsOf(groupIdHash, atTime)
  → evidence: who was in the group then

isRosterMemberAt({groupIdHash, subject, atTime, replicaAsOf, maxStalenessMs})
  → fresh structural fact only; trust.projektor decides whether it authorizes
```

There is deliberately no `getMembers(group)`. A caller must state which question
it is asking.

Both read the `Group` version DAG, which is the ordering authority — not a
timestamp field on the object. `rosterAsOf` selects the version in force at
`atTime` and reads its `HashGroup`. `isRosterMemberAt` evaluates the present under a
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
trust.core verifies the exact membership authorship and issuer-key bundle, and
trust.projektor separately proves that the signer is `Group.owner`, the claim
names the exact `HashGroup`, the sharer is in that roster at action time, and
the effective membership is valid and carries `mayReshare`. "Shared by
individuals" is a granted capability, not an assumption.

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
| `compromisedSince` | a separate `ProjektorEvidenceDispute` | None. Marks assertions in the window **disputed**, never invalid. |

A genuine "this key was compromised as of last Tuesday" is therefore a separate
signed claim, not a `validUntil` rewrite. It flags the affected assertions so a
verifier re-weighs them, instead of deleting good evidence in order to reach the
bad. Backdating cannot make that distinction; a claim can.

**Scheduled expiry is not revocation.** A membership ending at the close of
Leistungsphase 3 is a future `validUntil` set at issuance — a bounded
certificate, needing none of the above.

### trust.core is the attestation boundary, not the domain reducer

trust.core is reused for configured typed claim storage, exact detached-signature
verification and issuer-key lifecycle provenance. It deliberately does not own
Projektor membership windows, bundle/status schemas, roster admission or the
`mayReshare` rule. Those remain in trust.projektor, which can ask for
`evidence-time` authority at authorship and separately evaluate structural
membership at the later action time.

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
  while present-time structural membership and trust.projektor authorization deny them.
- `rosterAsOf` reads the `Group` version in force at the evaluated time, so a
  later version never reaches back into an earlier answer.
- Concurrent unmerged versions raise `ConcurrentVersionsError` rather than
  resolving to whichever the storage happened to return first.
- `isRosterMemberAt` throws `StaleChainError` when the replica is staler than the policy.
- A revoking certificate narrows the effective window; the original certificate
  alongside it does **not** keep the membership alive.
- No certificate can widen a window another certificate narrowed.
- A revocation carrying a `learnedAt` earlier than `revokedAt` still ends
  authority at `revokedAt`; assertions made in that gap remain valid.
- A certificate for group A does not authorize disclosure of group B, and one
  belonging to another person, from another issuer, expired, or lacking
  `mayReshare` each fail closed.
- A `ProjektorEvidenceDispute` marks assertions in its window disputed while leaving
  them verifiable, and alters no certificate.
- A living grant admits a later-added member; a pinned grant does not.
- A `HashGroup` hash changes with membership, so a pinned grant cannot drift.

## Assumption

Glue occupies the attester slot for the participant's key binding, so a group
issued by a participant is bounded by that participant's own certificate in the
same way a role is. If glue instead sits at a different tier of the
refinio → organization admin → user chain, the issuer authority rules here need
revisiting; nothing else in this design changes.

## Open Items

Not gaps in the reasoning — consequences of it that are not yet handled.

**Time confidence is not represented.** Peer attestation is what bounds a
claimed time, but it yields a gradient rather than a fact: an assertion witnessed
by several independent parties soon after it was made is stronger evidence than
one nobody attested near-in-time, and nothing in the record distinguishes them.
MR-3 already tiers *authorship* this way — unauthenticated local claim versus
contractual assertion — and there is no equivalent for time. The sharp edge is
the 30-day offline design floor: a disconnected participant has no peers to
witness anything, so time claims are weakest exactly where the product promises
most, and nothing records that they were weak when made. A verifier years later
cannot tell a well-witnessed timestamp from a lone one.

**Assembly boundaries are a data-protection decision.** If withholding is done
by choosing which assembly to share, then what sits inside one assembly
determines what can be withheld separately. Personal data sharing an assembly
with data that must be retained cannot be withheld without withholding both.
This is a constraint on how authors cut assemblies, it is not written down
anywhere as guidance, and it cannot be corrected afterwards — re-cutting breaks
every hash that references the assembly.

**The continuity link must be structurally non-evidence.** Given the identity
border, applications will record that one group succeeded another. Stored
alongside attestations, such a link will be read as attested, and it will be
read that way by an auditor at the moment it matters most. It needs the same
clean separation already drawn between `ReleaseState` and the disclosure
certificate; otherwise something informal spans the border and looks official,
which is worse than no link at all.

**Roles are not built.** `packages/trust.projektor` has no role and no relation
type. Until roles exist with validity windows, organizational accountability is
inferable from who signed but not attested, and the phase-scoped authority MR-3
requires has nowhere to live.

## Out Of Scope

- Cross-organization identity federation (MR-3 defers it).
- Nested groups. A membership subject is an identity, not a group.
- Any mutable deny list, revocation list, or online revocation endpoint.
- Any organization object. Firms are people holding roles.
- Any trusted clock or time authority. Time is bounded by peer attestation.
- Group ownership transfer. An ownership change is a new scope by design, and
  linking scopes is application work.
