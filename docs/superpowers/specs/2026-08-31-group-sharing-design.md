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

**Normative state is outbound, because authority is local. Trust is the
exception.** Authority is local to the **person**, not to the instance. An
instance is a custodian: it holds keys, it does not own the identity, and
signing is an act of the person that the instance mediates. From the instance's
own position even its user is other.

What a person authors is normative for them and flows outward. Trust runs the
other way — state authored by others *about* them, which cannot be
self-generated.

This is not a detail of the trust layer, it is what determines the mechanism.
For outbound state, propagation is the job: you decided, others must learn it.
For inbound state there is nothing to push, because you are the subject and not
the author. Establishing trust on read is therefore forced by the direction of
authority rather than chosen for convenience, and any design that pushes trust
updates outward is pushing state it does not own.

It also fixes the layering. A membership bundle is inbound and immutable —
someone else's statement, not ours to alter. A verification status is our own
authority applied to their claim, which is why it is receiver-local: sharing one
would export a local evaluation as though it were normative about another party's
identity. And it explains why access control needs a freshness policy while
evidence does not — for outbound state staleness is the receiver's problem, but
for inbound state it is ours, since we cannot author what we are missing and
cannot tell from local evidence that it exists.

**A group you do not own is the same exception.** The owner asserts the roster
and members receive it, so membership is inbound normative state about the member
and carries the same rules as trust: established on read, subject to a freshness
policy, never locally authored. Trust and membership are one exception with two
instances rather than two mechanisms that resemble each other. Anywhere else the
local instance depends on externally authored state to decide about itself
belongs in the same category.

**The hazard is custody presented as authority, not self-attestation.** An
instance cannot author identity state about itself — the author is always a
person's key — so a self-issued root is ordinary authorship, and pinning makes it
*verifiable by others* rather than legitimate. What must not happen is an
instance acting with a person's key without the person's participation, and then
that act carrying the weight of one the person made.

MR-3's attribution tiering is exactly this boundary expressed as evidentiary
weight: an unauthenticated local claim is custody alone from an unprotected
vault; a contractual assertion requires the person to participate through a
user-verifying authenticator. So is the rule that the local password is a vault
credential and not a security boundary — custody, not authority.

**Multi-instance is the same exception.** A person's second instance receives the
first's state as inbound and establishes it on read like any other externally
authored state. IoM is that path, and it is not a special case.

**Certificates hold even when the chain of trust arrives later.** A signature is
made over content by a key; whether that key is trusted is answered separately
and can be answered afterwards. Work signed before attestation becomes verifiable
when the attestation lands, with no reissue — which is why verification status is
receiver-local, versioned, and re-derivable rather than a property of the
evidence. `pending-authority` is a distinct state from `rejected`: a rejection is
final, an unmet authority requirement is not.

Two conditions this rests on. Attestation must bind keys the subject already
holds, so key generation precedes the work it authenticates and attestation never
substitutes a fresh key. And a late chain establishes *who* signed, never *when* —
timing is still bounded only by what peers attested near the claim.

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

**Repudiation does not unmake reliance**, for the same reason. Both the
repudiated act and the reliance on it stay in the record, and whether that
reliance was reasonable is read from the tier the act carried when it was relied
on. A repudiation that had not yet reached a party does not reach back into what
they decided — the as-of-assertion-time rule applied to a third party, which is
what makes acting on synced evidence safe at all. The interface must not call it
withdrawal or cancellation: nothing is taken back, a contrary statement is
added.

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

**Trust is established on read.** Evaluation re-derives forward from the object
being evaluated — statuses are found by `{receiver, bundle}`, the projection
rebuilds from its own `sourceBundles` — so nothing traces backward from arriving
evidence to whatever was waiting on it. `sync.core` establishes new state;
reading sees it.

This is deliberately indifferent to *why* the state changed. A late-arriving
chain and a revocation are the same event to a reader, which matters because they
move in opposite directions: a trigger built to notice bundles becoming verified
would never notice a membership being narrowed, and that is the direction where
being wrong is a security failure rather than an inconvenience.

**The stored projection is a record, not an input.** `getEffectiveMembership`
currently reads the latest stored version rather than re-deriving, which makes it
a cache with an invalidation problem. It should re-derive, and the stored
`EffectiveGroupMembership` should stand as an audit record of what was decided
and when. The work is bounded by one lineage per person per group. Stamping the
projection with the state it assumed is not sufficient in its place unless the
stamp covers the whole dependency set — chain state, source bundles and statuses
alike — since otherwise a membership change slips past a chain-state comparison.

**Establishing on read is not freshness.** It yields the best answer derivable
from the state held, and says nothing about whether enough state is held. A
replica a month behind re-derives confidently and returns a membership revoked
three weeks ago — correct from its own evidence, wrong in fact. That is the
freshness policy's job, and the two must stay separate for the same reason the
two evaluation times do: *what does my evidence say* and *am I entitled to decide
on it* are different questions.

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
