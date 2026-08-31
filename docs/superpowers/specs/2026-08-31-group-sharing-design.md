# Group Definitions, Access, And Disclosure Records

Date: 2026-08-31
Status: Design, approved for planning

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

Naming and recipe conventions follow `packages/project-source.core`: `Project*`
prefix, versioned objects keyed by `isId` props, projections marked explicitly
non-authoritative.

| Object | Kind | Purpose |
|---|---|---|
| `ProjectGroup` | versioned, `isId: groupId` | Descriptor: name, purpose, issuer. The publishable part. No project field, no scope field. |
| `ProjectGroupMembership` | versioned, `isId: {group, subject, issuer}` | Per-member certificate: issuer, subject key, group ref, `validFrom`, `validUntil`, `mayReshare`, signature. |
| `ProjectGroupRoster` | **projection, not authoritative** | Derived from memberships. Same relationship `ProjectFileIndex` has to `ProjectSourceArtifact`. |
| `ProjectGroupDisclosure` | immutable assertion | "I disclosed group G **at content hash H** to P at time T, under certificate C." |
| `ProjectAccessAssertion` | immutable assertion | "I granted group G access to record R at time T," with binding mode. |
| ONE.core `Access` / `IdAccess` | not ours | Enforcement. CHUM routing, mutable, present-tense. |

Membership is per-member certificates rather than one signed roster. This makes a
group structurally identical to a role certificate — one verification path, one
supersession rule, one bundle format — and gives per-member supersession plus
proof of one's own membership without disclosing the roster (MR-4).

Because the roster is a projection, no stored object can be mutated to change who
was in a group at a past time.

### Hash discipline

- A **disclosure** pins the group's **content hash**: which roster was actually
  shown.
- An **access grant** pins the **id hash** when living, or the **content hash**
  when pinned.

Without this, "I shared group G with P" silently means "P sees whatever G
becomes," and there is no proof of which membership P was told about.

## Two Functions, Never One

```
rosterAsOf(groupIdHash, atTime)               → evidence:  "was this validly asserted then"
mayAct(subject, groupIdHash, now, freshness)  → access:    "may this participant act now"
```

There is deliberately no `getMembers(group)`. A caller must state which question
it is asking. `rosterAsOf` walks version history to the assertion time.
`mayAct` reads the latest version under a stated freshness policy and fails
closed when the local chain replica is staler than that policy allows.

## Visibility: One Mechanism, Three Presets

The three modes are audiences over `ProjectGroup` and its memberships, not three
code paths:

- **Participants** — audience is the group itself; members read their own roster.
- **Individuals** — an enumerated Person set. Requires `mayReshare` on the
  sharer's own membership certificate.
- **Public** — the descriptor is published under a well-known id; memberships
  remain restricted.

Public therefore means **public identity, private roster**. Anyone can reference
the group or verify a claim against it, and a member can prove their own
membership, without publishing a member list as a personal-data set. The
descriptor and the membership certificates are already separate objects, so this
needs no additional concept.

## Re-Sharing And Delegation

`mayReshare` on a membership certificate states whether that member may disclose
the definition onward. A `ProjectGroupDisclosure` is valid only if the sharer's
own certificate granted the right, so the delegation chain verifies offline like
any other chain. "Shared by individuals" is a granted capability, not an
assumption.

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

- **Living** — binds the group id hash. New members gain access automatically.
  Correct for "all current structural engineers."
- **Pinned** — binds a content hash. Access is fixed to that exact roster.
  Correct for a sensitive decision record or a closed jury.

The assertion records which mode was chosen, so an auditor can see whether the
audience was open or closed at grant time.

## Revocation: Reuse trust.core

Revocation already exists in `trust.core` (`docs/CERTIFICATE-VERSIONING.md`):
supersession by a new version under the same id, all versions preserved, CHUM
urgent propagation, W3C VC export for offline and external verification. That is
MR-3's "never a deny list, never deletion," already built. `ProjectGroupMembership`
joins that path — no new revocation infrastructure, and the VC export serves
MR-6 verification without adopting Projektor.

Two behaviours in that package must **not** be carried over.

**1. Revocation must not backdate `validUntil`.**
`revokeCertificate` sets `validUntil` to `now - 24h`. Applied here, revoking a
membership today would retroactively invalidate every assertion that member made
yesterday — the retroactive-destruction outcome MR-3's rationale calls
indefensible.

Projektor's rule: **revocation ends authority at revocation time, never before
it.** `validUntil = revokedAt`. A membership version whose `validUntil` precedes
an assertion it authorized is rejected at write time.

A genuine "this key was compromised as of last Tuesday" is a **separate signed
compromise claim**, not a `validUntil` rewrite. A verifier can then weigh the
affected evidence instead of it silently disappearing.

**2. `isRevoked(cert)` must not be used for evidence.**
It treats `validUntil < now` as revoked and reads only the latest version. That
is a correct access-control check and a wrong evidence check: it takes no
`atTime`, so it structurally cannot answer "was this valid then," and it conflates
expiry with revocation, which MR-3 requires be kept distinct. `rosterAsOf` and
`mayAct` replace it; neither delegates to it.

Not to be propagated: `getLatestVersion(certId: SHA256Hash<...>)` keys
latest-version resolution by content hash. Latest-version lookup takes an id hash.

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

Per-package `index.test.js`, following the existing repository pattern. The tests
that matter are those that catch the conflation:

- A membership revoked today still verifies an assertion made yesterday:
  `rosterAsOf(before)` succeeds while `mayAct(now)` denies.
- A membership version with `validUntil` earlier than an assertion it authorized
  is rejected at write time.
- A disclosure pins a content hash: adding a member afterwards does not change
  what the disclosure proves.
- Re-share by a member whose certificate lacks `mayReshare` fails closed.
- A public group descriptor is readable while its memberships are not.
- `mayAct` fails closed when the chain replica is staler than the freshness
  policy.
- A living grant admits a later-added member; a pinned grant does not.
- Never-attested and attested-but-expired issuers produce distinct outcomes.

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
