# projektor.one Market Requirements Document

Status: draft for review. Section 12 lists the decisions that must be closed
before any of the claims in this document may be used in sales, procurement, or
compliance conversations.

## 1. Market Problem

Enterprise and public-sector construction projects do not fail for lack of cloud
project management tools. They fail to *adopt* them. Liability structures,
procurement rules, professional confidentiality, and legacy fragmentation make a
single centralized tenant impossible in practice:

- The client, the authority, the specialist planners, and the contractors are
  separate legal entities with separate liability. None of them can accept
  another party's platform as the authoritative record of what was agreed.
- Correspondence with a public client is procurement-relevant evidence. Copying
  it into a vendor cloud is frequently a blocking question, not a preference.
- Every participant already has a working system — Outlook, a file server,
  Excel cost sheets, a scheduling tool, a CAD/BIM stack. Replacing those is a
  multi-year project in itself and nobody sponsors it.
- Projects outlive the tools. A tool chosen in Leistungsphase 2 must still
  produce evidence during Gewährleistung, years after handover.

The result is the real incumbent: **Outlook, a shared drive, and Excel**, with
the actual project state held in the heads of two or three people. Every
centralized product loses to this incumbent not on features but on the
precondition it demands — that everyone move into one tenant.

The unmet need is not another database. It is a way to make *what was agreed*
durable, attributable, and provable across organizations that will never share
one system.

## 2. Why Now

- Browsers became a viable local application platform: persistent storage,
  WebCrypto, OPFS, WASM. Installation no longer requires an app-store
  gatekeeper or an IT rollout.
- Post-Schrems II data-sovereignty scrutiny in the German and EU public sector
  has made "where does this data physically live" a first-round question rather
  than a legal appendix.
- Cheap local models make it feasible to extract structure from project mail and
  documents on the user's own machine, which previously required shipping the
  corpus to a cloud service.

## 3. Market Landscape

| Segment | Examples | Why they don't solve this |
|---|---|---|
| The real incumbent | Outlook + file server + Excel | No shared state, no provenance, no role filtering. But zero adoption cost and universally accepted. |
| AEC common data environments | Oracle Aconex, Thinkproject, Autodesk Construction Cloud, Dalux | Centralized tenant. Usually imposed by the largest party; smaller offices and authorities participate reluctantly or not at all. |
| Project information management | Newforma Project Center | Closest functional comparable — project email and file integration without full migration. Server-based, office-scoped, weak cross-organization federation and no cryptographic evidence model. |
| Site/defect management | PlanRadar, Dalux Field | Adjacent scope. Strong in execution phases, not a coordination or evidence layer. |
| Generic PM | MS Project, Asana, Monday, Jira | No AEC phase model, no role/liability model, no provenance. |
| Office/CAD suites | Nemetschek (Allplan, Bluebeam) | Own the artifacts, not the agreements between organizations. |

Projektor's differentiator is not feature coverage against this table. It is the
absence of the precondition every entry in it shares: **no common tenant is
required for participants to hold a mutually verifiable record.**

## 4. Buyers, Users, And Participants

These are three different problems and must not be collapsed.

**Economic buyer — architecture office owner / managing partner.** Buys risk
reduction and provable diligence, not productivity. Decision driver: what
happens in a dispute, a Nachtrag, or an audit. Long sales cycle, low tolerance
for anything that looks like a new IT dependency.

**Daily user — project lead (Projektleiter).** Uses it every day or not at all.
Decision driver: whether it removes work (finding the decision, reconstructing
the thread) rather than adding a place to maintain state. Will abandon anything
that requires double entry.

**Project participants — client, authority, specialist planners, contractors,
controllers.** Between 5 and 30 external organizations per project. They have no
budget line for your software, no obligation to install anything, and often no
prior interest.

Treating them as *reluctant non-adopters* is a category error, and it leads
directly to designing for their absence. They are parties to the project with
their own responsibilities to discharge and, later, to defend. What they lack is
not motivation but a way to take part that does not begin with adopting someone
else's system. **The product must give every participant agency at zero
onboarding cost, and must deliver value when they never install anything.** This
is treated as a market requirement (MR-6), not as a risk to be monitored.

**Secondary stakeholders** — procurement, data protection officers, auditors.
They do not use the product; they gate it. They need to understand the data
handling story without reading project content.

**Current position.** Established building-industry participants are already
engaged and committed to the reference project (§8). This changes the shape of
the v1 problem: market access and initial credibility are not the constraint,
and the product does not have to win a competitive evaluation before it can be
built against real conditions. What it must do instead is survive contact with
a real multi-year project and real external parties — which is a harder and more
useful test. The corresponding obligation is that requirements come from that
project's observed behaviour, not from what the engaged participants say they
want in advance; the two diverge routinely in this market.

## 5. Positioning

projektor.one is a **local-first coordination and provenance layer** for
multi-organization projects. Project data stays under the organization's
control, next to the systems where it is produced. Participants explicitly align
and share selected project state through project-scoped, role-aware sharing, and
every agreed item carries verifiable evidence of who asserted it, when, on what
basis, and who acknowledged it.

Local does not mean isolated, and shared does not mean centralized. There is no
tenant that owns the project. Each organization holds its own record; the shared
project state is the set of assertions the participants have signed and
exchanged.

**What the absence of a central server buys is agency.** Every centralized
product makes participation conditional: before a party can contribute, it must
accept another organization's infrastructure, its terms, and its custody of the
shared record. That precondition — not missing features — is why the incumbent
in §1 keeps winning. With no tenant to join, there is nothing to onboard into,
and no party has to subordinate itself to another's platform in order to take
part. What a participant obtains is **their own project record**, held under
their own control — not a seat in someone else's system. They share from it what
they choose; the others share theirs back. The shared picture is what the parties
have deliberately exchanged, and nobody holds the master copy.

Agency is not only the ability to see and to participate. It is the ability to
hold and present one's own responsibility credibly — to show what one committed
to, what was delivered, on what basis, and when, in a form the other parties can
verify without having to take one's word for it. **Responsibility that can be
presented is responsibility that can be defended.** In a market where liability
runs years past handover and the parties are separate legal entities, that is the
substance of the offer, and it is owed to every participant rather than only to
the organization that bought the licence.

## 6. Entry Wedge

Selling "a coordination layer" to an architecture office reads as an
infrastructure overhaul and will stall in evaluation. The product enters through
one high-value, low-commitment job:

> **Verifiable decision and milestone protocoling** — an immutable, exportable,
> attributable record of formal sign-offs, baseline changes, and the
> correspondence and documents that support them.

This wedge is chosen because it:

- delivers value to a single project lead on day one, with zero external
  adoption required (see MR-6);
- addresses the buyer's actual purchase driver (dispute and liability exposure)
  rather than a productivity claim they will discount;
- concerns a small, high-value data set — hundreds to low thousands of items
  per project — rather than the full document and mail corpus, which keeps the
  v1 synchronization and evidence problem tractable;
- produces an artifact (the exported evidence bundle) that participants who have
  installed nothing can consume and verify, which — together with the MR-6
  project view — is how the product reaches participants two and three.

Broader coordination — schedules, inventories, full document management —
expands from this wedge. It is not the way in.

## 7. Core Value Proposition

1. **Participate without precondition.** Any party to the project can take part
   without an account, an installation, an infrastructure commitment, or a
   negotiation over whose platform the project lives on. Onboarding effort is
   zero because there is nothing to onboard into. What each participant gets is
   not a guest pass to someone else's system but **their own project record**:
   what they committed to, what they delivered, what they hold — and the ability
   to share from it on their own terms and present it credibly to the others.
2. **Integrate without migrating.** Local files, project mail, spreadsheets,
   schedules, calendars, and repositories are read without altering the source.
   Their bytes are ingested as immutable SHA-256-addressed BLOBs while the
   originals remain in the systems that own them, usable and unlocked.
3. **Coordinate commitments, not documents.** Milestones, dependencies,
   responsibilities, target dates, progress, and blockers are exchanged directly
   between participants as signed assertions, so everyone works from an aligned
   view of what was actually committed.
4. **Share selectively.** Participants choose which project areas and records
   leave their control, filtered by project role, and recipients can always
   distinguish a source record from an agreed state from a working draft from
   something superseded.
5. **Prove it later.** Every import, transformation, decision, approval,
   baseline change, and sharing event produces attributable journal evidence
   that can be exported and verified independently — including by parties who
   never used the product.
6. **Stay in control.** Each organization can state precisely where its data
   resides, what has left it, to whom, and on what authority.

## 8. Scale: One Reference Project First

v1 is scoped to **one large real project**, run with building-industry
participants who are already engaged. The architecture is sized for that
project and expands from its measured behaviour. This is a deliberate choice
over a market-wide sizing exercise: a single real long-running project with real
external parties exercises every hard property — multi-organization identity,
retroactive correction, selective disclosure, evidence export — while a survey
of many projects would only produce averages nobody builds against.

The reference project supplies the actual figures. The table below is the
**instrumentation plan**: each dimension must be measured on it during v1, and
the measured value replaces the placeholder before v2 architecture is fixed.

| Dimension | To measure on the reference project | Why it drives architecture |
|---|---|---|
| Active duration and evidence horizon | Phase span; how long after handover evidence is expected | Format stability, certificate renewal, and export longevity outrank live-collaboration polish. |
| Participants and organizations | Headcount, and how many distinct legal entities | Determines whether per-participant provisioning is even conceivable. It is not. |
| Participation over time | How many keep a record of their own (peer tier), how many only read a shared view or bundle (minimal tier), and how the split moves | The peer/minimal split is the single most important adoption number: it tells you whether the model in MR-6 is real or whether the product is a publishing tool with extra steps. |
| Document volume and bytes | File count and total size | Bulk content cannot be replicated to every participant; sharing must stay reference-based. |
| Project mail volume | Messages per month and over project life | Ingestion must be incremental and interruptible. |
| **Formally protocoled items** | Decisions, milestones, approvals per month | **The critical number.** This is the set needing signatures and audit rigor. The MR-2 design holds only while it stays orders of magnitude below bulk content. |
| Concurrent editors per protocoled item | How often two people touch one item in one window | If this is routinely >1, the MR-2 divergence model needs revisiting. Expected: near-always 1. |
| Offline duration | Longest real disconnected stretch | Site work and infrequent syncers. Design floor: 30 days. |
| Convergence | Time from assertion to peer visibility | Evidence validity must never depend on delivery latency. |

Two figures are architectural tripwires rather than observations. If protocoled
items approach the volume of bulk content, or if concurrent editing of a single
protocoled item is common, the append-only assertion model in MR-2 must be
re-opened before scaling to a second project.

## 9. Market Requirements

Priority: **M** = must for v1, **S** = should, **C** = could / later.

### MR-1 — Local Control And Ingestion Boundary

- **M** Project information must remain usable under the customer's control
  without any automatic transfer to vendor infrastructure.
- **M** Ingestion must read third-party artifacts (files, mail, spreadsheets,
  exports) without modifying, moving, or locking the source material. Projektor
  calculates the **SHA-256 hash of the ingested bytes** and stores or addresses
  those bytes as an immutable ONE **BLOB** whose reference is that hash. Project
  objects carry the BLOB reference and provenance, not a mutable copy embedded
  in the object graph. Re-ingesting identical bytes therefore resolves to the
  same BLOB reference, and Projektor can re-hash a source to determine whether
  it has changed.
- **M** Provenance — origin system, account, path, timestamp, ingesting
  identity — must be preserved on every ingested object and must survive export.
- **M** The **ingestion depth boundary must be explicit in the product**:
  artifacts are attachments bound to human-asserted claims. Projektor does not
  parse and synchronize semantic sub-records inside third-party documents except
  for a small, bounded, published set of formats.
- **S** The bounded parsing set for v1 is limited to: delimited cost/inventory
  tables (CSV/XLSX with a declared column mapping), calendar entries (ICS), and
  mail envelope metadata (IMAP headers, thread and reference identifiers). Any
  extraction beyond these must be surfaced to the user as a proposed claim
  requiring confirmation, never as silently derived fact.
- **C** Deep schema integration with specialist AEC systems (AVA, BIM issue
  formats such as BCF, ERP) — deliberately deferred; each such connector is a
  bounded schema commitment with an ongoing maintenance cost.
- **M** Import, export, API, and tool surfaces must support incremental adoption
  and indefinite coexistence with the systems already in use.
- **M** JSON is not a project data model. Projektor must not use JSON files or
  JSON blobs as authoritative project storage, backup, interchange, provenance,
  evidence, or synchronization envelopes. Persistent first-class state is made
  of registered, typed ONE objects with `referenceToId`, `referenceToObj`, and
  BLOB references according to their semantics. Where an external protocol
  requires JSON, it is a boundary projection over those objects and cannot
  become a second source of truth.

*Rationale: an "integrate everything" connector surface balloons without bound
and is the standard failure mode of this category. Immutable attachment plus
asserted claim is feasible now; semantic sub-record synchronization requires
bounded schemas and is a per-format commitment.*

### MR-2 — Data Model And Synchronization Semantics

The product spans three classes of state with different correctness
requirements. Conflating them is the primary technical risk.

**Class A — Bulk content** (ingested files, mail, exports)
- **M** Immutable and content-addressed. The address is the SHA-256 hash of the
  bytes and is carried as a BLOB reference. Conflicts are impossible by
  construction; the same content ingested twice is the same BLOB.
- **M** Replication is by reference and selective. Holding a reference must not
  require holding the bytes, and a participant must be able to tell the
  difference between "I can see that this exists" and "I have it".
- **M** **Personal data lives in leaf objects, never in the assertion graph.**
  Names, contact details, mail bodies, and routing hints are content-addressed
  leaves referenced by hash. The graph that binds assertions together stays
  structural and pseudonymous — key identifiers and hashes — so that removing a
  leaf leaves the chain intact and verifiable. This is what makes MR-7's erasure
  position implementable; violating it once makes erasure impossible forever.
- **M** Leaf objects carrying personal data must be individually encrypted so
  that destroying a key renders the content unrecoverable while its hash, and
  therefore the integrity of every assertion referencing it, remains valid.

**Class B — Canonical project state** (decisions, milestones, approvals,
responsibilities, baselines)
- **M** Represented as **signed, append-only assertions**. Existing assertions
  are never mutated. Change is expressed only as a new assertion that supersedes
  a prior one, carrying an explicit reference to what it supersedes.
- **M** Conflict resolution must be **deterministic and explainable to a
  non-technical reviewer**. Where two participants assert incompatible state,
  the system must surface it as an open divergence requiring human resolution,
  and must never silently merge contractual state.
- **M** The authority rule — which participant's assertion is canonical for
  which record class — must be explicit, project-configured, and visible.
  Merging is not a technical decision; it reflects who is entitled to decide.
- **M** **Authority is phase-scoped, not global.** Canonical ownership shifts
  across the HOAI Leistungsphasen: the architect owns design milestones through
  the planning phases, while execution baselines pass to the general contractor
  or project controller during Objektüberwachung. A static, project-lifetime
  access list cannot express this and will be wrong for most of the project's
  duration.
- **M** Authority must therefore be bound to **phase-scoped role certificates** —
  the certificate carries the phase in its scope, and its validity window is what
  moves authority from one party to the next. Authority transitions are
  certificate issuance and supersession events, not configuration edits, so a
  transition is itself evidence with an issuer, a time, and a signature.
- **S** A phase boundary is a foreseeable, schedulable event. Certificate
  issuance for the incoming authority should be preparable before the transition
  and take effect with it, rather than being discovered as an access failure on
  the day.
- **S** Assertions made under a certificate that was valid at assertion time
  remain valid after that certificate expires. Expiry ends the authority to make
  *new* assertions; it does not retroactively invalidate past ones.
- **S** Ordering must not depend on wall-clock agreement between participants.
  Causal ordering (each assertion references what its author had seen) is
  required; timestamps are evidence, not sequencing.

*Rationale: general-purpose CRDT convergence is right for collaborative text and
wrong for contractual commitments. Silent automatic merge of a milestone date is
a liability event, not a feature. Because the protocoled-item volume is small
(§8) and concurrent editing is rare, append-only signed assertions with explicit
divergence are both sufficient and far easier to audit.*

**Class C — Local drafts**
- **M** Formally distinct from canonical state in the data model, not merely a
  status flag in the UI. Drafts are local, mutable, last-writer-wins per author,
  and are never shared implicitly.
- **M** Promotion from draft to canonical must be an explicit, signed,
  attributable act by an identity with the authority to make it.
- **M** Every record a participant sees must be unambiguously identifiable as
  one of: source record, canonical agreed state, working draft, or superseded.

### MR-3 — Federated Identity And The Certificate Chain

The trust model is the certificate chain, and it is the product's load-bearing
element. Every other guarantee in this document — role filtering, selective
disclosure, audit export, non-adopter verification — is a consequence of
maintaining a complete, locally verifiable chain. The issuing model is specified
in the [admin.cube PRD](./projektor-admin-cube-prd.md); this section states the
market requirements it must satisfy.

**The chain is refinio → organization admin → user.** Three tiers, one
primitive: at every tier the subject generates and holds their own key pair, and
the tier above issues an **attestation certifying the identity that holds those
keys**. No tier ever creates, holds, escrows, or can recover another tier's
private key material. Certification is a statement about a binding, not a grant
of a credential.

- **M** Identity must not depend on a central authentication provider. No party
  authenticates anyone: refinio attests to an organization admin's identity once,
  and the admin attests to its users. The attesting tier is an issuing authority,
  not an account provider, and must never be a runtime dependency for using the
  product or for verifying evidence.
- **M** Participants are identified by a cryptographic key pair they control and
  generate themselves. Email is an identifier and a routing hint, never a
  credential.
- **M** An organization must be able to generate keys and work productively
  before its attestation exists. What an unattested organization cannot do is
  produce evidence that verifies for an outside party against the pinned root.
  Attestation makes work externally verifiable; it does not gate the work.
- **M** *Never attested* and *attested but expired* are different states and must
  not be conflated. The second is grandfathered by the as-of-assertion-time rule
  below; the first is not, and evidence produced during an unattested window
  requires reissue to become externally verifiable.
- **M** Project roles are **bounded certificates** bound to a participant's key,
  each carrying issuer, subject, scope, validity window, and signature.
- **M** **Issuing a role and vouching for an identity are separate
  permissions.** A role that may admit someone to the project does not thereby
  gain the authority to attest to who they are, and the converse also holds.
  Collapsing the two makes every role-granting party an identity authority.
- **M** The chain authorizing a participant must be **transportable as a single
  object**, so one transfer delivers everything needed to evaluate it. A verifier
  that must first query for intermediate certificates cannot verify offline, and
  a recipient that must wait for them has an arrival-order dependency rather than
  a verification.
- **M** Chain verification must be **local and repeatable** — no network call,
  no vendor service, no live endpoint. An audit performed in five years must
  verify from the bundle alone.
- **M** Verification must **fail closed**. Missing or unverifiable chain
  evidence denies the operation; it never degrades to permitting it.

**Two questions, two evaluation times.** The same certificate answers *"was this
validly asserted then?"* and *"may this participant act now?"* These evaluate
validity at different times, and conflating them is the most damaging error
available in this design.

- **M** **Evidence verification evaluates the chain as of assertion time.** An
  assertion is valid if the chain that authorized it was valid at the moment it
  was made. It does not become invalid later because a certificate has since
  expired, been superseded, or lapsed.
- **M** **Access control evaluates the chain as of now.** Whether a participant
  may issue, sign, or act today depends on the chain being currently valid.
- **M** A verifier must state which question it answered. A bundle proves
  historical validity; it is not a statement about present authority.

*Rationale: refinio's attestation window is the commercial term, so certificate
expiry is a business event as much as a technical one. If the verifier asks "is
this valid now," a lapsed subscription retroactively destroys the customer's
entire project record on the day it expires. That outcome is unacceptable
commercially and indefensible in procurement, and the only thing preventing it is
evaluating evidence at assertion time.*

- **M** **Licence lapse position, stated plainly in product and sales material:**
  when an organization's attestation lapses, everything already asserted remains
  verifiable, permanently. What stops is the ability to issue new certificates
  and make new contractual assertions. The customer's record is theirs and does
  not expire with the contract.

**Validity windows and revocation.**

- **M** Invalidation is **supersession by a newer end time** — a new version of
  the certificate carrying a revised `validUntil` — never a mutable deny list and
  never deletion. A superseded certificate remains part of the evidence record.
- **M** An organization admin sets the validity duration of the certificates it
  issues. Refinio sets the admin's own window; that window is the licence term.
- **S** A user certificate is **not clamped** to the admin's attestation window.
  It was validly issued while the admin was attested, and the as-of-assertion-time
  rule governs it thereafter. This is safe only because the two evaluation times
  are explicit — do not introduce clamping as a substitute for getting them right.
- **M** **Revocation is sound in semantics and open in distribution: a verifier
  only knows the versions it has received.** The two uses need different freshness
  rules, and the product must implement both rather than picking one:
  - *Evidence* — an exported bundle proves state as of its export time. A later
    revocation does not reach back into it, and this is correct. Every bundle
    must therefore carry its as-of time explicitly and visibly.
  - *Access control* — a stale replica means a revoked participant still
    verifies. This path requires a stated freshness policy: how recent the chain
    state must be for a decision to be made on it, and what happens when it
    is not.
- **M** Key loss, key rotation, and certificate renewal must have defined
  recovery ceremonies that do not invalidate previously issued evidence. Over a
  multi-year evidence horizon, key loss is a certainty, not an edge case, and
  recovery must be an explicit ceremony rather than a silent fallback.
- **M** The **local password is a vault credential, not a security boundary of
  its own.** It unlocks locally held key material. Confidentiality,
  attribution, and evidentiary weight derive from the certificate chain, not
  from the password. Product and onboarding language must say exactly this and
  must not imply that the password is what makes project data trustworthy.
- **S** Vault state must be distinguishable to the user: locked, unlocked,
  missing, recovery-needed.

**Prior art: the flexibel role model.** `one.flexibel` implements this shape
against the same platform, and Projektor's roles should be a configuration of it
rather than a second design. Its `RoleConfig` makes the trust layer generic over
an application's role vocabulary — a root role, plus per role `canIssueRole`,
`issuedBy`, and `canSignIdentity` — which is where the separation of role
issuance from identity vouching above comes from. Its `RoleCertificate` carries
subject, role, issuer and issuer role, reverse-mapped from both ends;
`RoleCertChain` bundles the whole root-to-leaf chain into one versioned object so
a single transfer carries a verifiable chain. Its root is a local key ceremony
with the public key published at a well-known endpoint, not a service.

Two deltas Projektor must close rather than inherit:

- **`RoleCertificate` carries no validity window and no scope.** It records when
  it was issued and nothing about when authority ends. Phase-scoped authority and
  expiry — the requirements above — are exactly what is absent, and they are what
  makes a role certificate answer the two evaluation times rather than only the
  present.
- **The unattested-window position may be stronger than stated.** Flexibel runs
  before its root key is published and treats the same chain as production once
  publication happens, with no reissue. If refinio's attestation binds the keys an
  organization already holds, then work done before attestation becomes externally
  verifiable when the attestation is issued, and the reissue requirement above is
  too strong. It is correct only where attestation introduces a *different* key.
  This distinction is commercially material — it decides whether a customer
  formalizing their arrangement must redo work — and it is gated below.

**Attribution tiering.** Onboarding permits a no-password path, which leaves
private key material unprotected at rest in browser storage. Anyone with device
access could then sign assertions as that participant. The resolution is not to
forbid the path but to make the data model reflect what the key material
actually proves:

- **M** Two distinct classes of authorship, distinguished in the data model and
  in every export, not merely in the interface:
  - **Unauthenticated local claim** — signed by a software key from an
    unprotected vault. Sufficient for working locally, for drafts, and for
    ingesting and annotating source material. Carries the ingesting party's
    attribution but no evidentiary weight against a third party.
  - **Contractual project assertion** — signed by key material released by a
    user-verifying authenticator: a password-unlocked vault or a WebAuthn
    credential with user verification. Required for anything that constitutes a
    commitment: decisions, approvals, milestone baselines, countersignatures.
- **M** Promotion of a local claim to a contractual assertion is an explicit,
  separately signed act. The original claim remains in the record; promotion
  does not rewrite its authorship or its time.
- **M** A verifier must be able to tell the two apart from an exported bundle
  alone, without access to the producing system. An unauthenticated claim
  presented as though it were a contractual assertion is the single worst
  failure this product can produce.
- **S** The user must be able to see which tier they are currently able to
  produce, and reach the vault or authenticator setup from the point where the
  tier blocks them — not through a settings hunt.

*Rationale: forbidding the no-password path would break the onboarding promise
that a user reaches a working project without ceremony. Tiering keeps that
promise while ensuring the weakness is expressed as reduced evidentiary weight
rather than as a silent liability.*
- **S** Certificate format should follow or map cleanly to an established
  standard, so third parties can verify without adopting Projektor (MR-6).
- **C** Cross-project or organization-wide identity federation.

### MR-4 — Selective Disclosure

- **M** Sharing is explicit, per project area and per record. There is no
  default outbound flow.
- **M** Role-filtered sharing must be enforced cryptographically, not only by
  UI filtering. A recipient must not be able to obtain content their role does
  not entitle them to by inspecting what they received.
- **M** An exported evidence bundle must be able to **prove that a specific
  decision was made, by whom, on what basis, and when — while redacting
  unrelated project data — and remain independently verifiable in redacted
  form.** For v1 this is achieved by deterministic hash redaction: the journal
  is structured so that a Merkle inclusion proof demonstrates an item's presence
  and position without disclosing its siblings.
- **S** Redaction must be visible: a verifier must be able to tell that material
  was withheld, and how much, without learning its content. Undetectable
  omission is not redaction.
- **C** Zero-knowledge proofs for predicate disclosure (proving a threshold or
  property without revealing the value). Explicitly out of scope for v1 —
  hash redaction covers the audit-export requirement at a fraction of the
  complexity and is far easier to explain to a reviewer.

### MR-5 — Auditability And Out-Of-Band Reality

Real projects are not clean. Approvals happen verbally on site and are recorded
later. Baselines are revised retroactively. Documents surface months after the
decision they supported. An evidence model that cannot represent this honestly
will either be circumvented or produce misleading records.

- **M** Every assertion must carry three distinct, separately queryable times:
  **when the event occurred in reality** (asserted effective date), **when it
  was committed to the record** (commit time), and **who asserted it**. These
  must never be conflated, and the gap between the first two must be visible
  rather than smoothed away.
- **M** Retroactive entry must be a first-class, clearly labelled operation —
  never a mutation of history and never disguised as a contemporaneous record.
- **M** Corrections and revised baselines are new assertions superseding prior
  ones. The superseded record and the reason for supersession remain visible.
- **M** Imports, transformations, decisions, approvals, milestone changes,
  progress updates, and sharing events all produce attributable journal
  evidence.
- **M** A reviewer must be able to reconstruct, from an exported bundle alone:
  what was agreed, who asserted it, on what authority, which sources support it,
  who received it, and what it superseded.
- **M** Audit evidence must be exportable without exposing unrelated project
  data (see MR-4), and must verify using a standalone verifier — no running
  Projektor instance, no vendor service, no network access.
- **S** Delivered outcomes and documentation must remain traceable to the
  decisions, milestones, and source material that produced them.

### MR-6 — Participant Agency Without Precondition

Every party to the project gets agency — the ability to hold their own project
record, to share from it on their own terms, and to present their own
responsibility — without first committing to anyone else's infrastructure.
Because there is no central server to join, onboarding effort is zero. The
product must produce value when every external party declines to install
anything, and it must do so by giving them standing rather than by tolerating
their absence.

This section states the participant's side of §5. Where a requirement below is
priority **M**, it is because agency is not optional: a participant who can only
be written *about* has none.

**Two participation tiers, and which one is primary.**

| Tier | What the participant holds | Priority |
|---|---|---|
| **Peer** — *the model* | Their own project record. They share from it; others share theirs back. | **M** |
| **Minimal** — *the fallback* | Nothing. They read a shared role-scoped view, or receive an exported bundle. | **M** |

**Peer participation is the product**, not an eventual upgrade. The minimal tier
exists because some parties will never keep a record of their own, and MR-6 must
still deliver for them — but it is the floor, not the design centre. Requirements
written for the minimal tier must never constrain the peer tier into a
read-only shape.

**Peer participation.**

- **M** Each participating organization holds **its own project record** — its
  commitments, dates, documents, decisions, and its view of what has been agreed.
  There is no master copy held by one party on behalf of the others.
- **M** The record is held under the participant's own control and remains theirs
  when the project ends, when another participant withdraws, and when the
  relationship with the vendor ends (MR-3 licence lapse).
- **M** A participant reaching the product for the first time obtains **their own
  record**, not access to someone else's. Nothing in onboarding may frame a
  participant as a guest in another organization's system.
- **M** Sharing is **bilateral and symmetric**: what one participant may release
  to another, the other may release back, on the same terms and under the same
  role filtering (MR-4). No participant's release capability derives from another
  participant's licence.
- **M** Where two participants' records disagree on the same item, the
  disagreement must be **visible to both as an open divergence** and must never be
  silently merged (MR-2 Class B). This is the visible consequence of federation
  and the reason the model is defensible; it is specified in gate 2.
- **S** A participant must be able to tell, per item, whether they are looking at
  their own assertion, one received from a peer, or an item where the two differ.

**The minimal tier — participants who hold nothing.**

- **M** A **read-only, role-scoped project view must be shareable with any
  participant, requiring no installation and no account creation.** This is the
  surface for a participant who keeps no record of their own. It is the fallback
  tier, and must not be mistaken for the model: a participant who only ever reads
  someone else's view has visibility, not agency.
- **M** The view must show current canonical state — decisions, milestones,
  dates, responsibilities, and the documents a commitment rests on — filtered to
  the recipient's role, and must distinguish agreed state from draft from
  superseded (MR-2 Class C).
- **M** Role filtering in the view is subject to MR-4: enforcement is
  cryptographic, not merely presentational. A recipient must not be able to reach
  content their role does not entitle them to by inspecting what they received.
- **S** The view must state how current it is. A participant acting on stale
  state must be able to tell that it is stale.

**Representation and attribution.**

- **M** Ingesting a participant's project mail and documents must make them a
  represented participant in the record without any action on their part.
  Assertions about their statements are clearly attributed as *asserted by the
  ingesting party*, never as signed by them.
- **M** A represented participant must be able to see what has been asserted
  about them, and to respond to it under their own attribution. Being written
  about without recourse is the opposite of agency, and it is the failure mode
  this section exists to prevent.
**Evidence a participant can take away and present.**

- **M** Exported evidence must be consumable and verifiable by a party who has
  never used Projektor, in a form a lawyer, an auditor, or a Behörde can accept.
  A raw JSON or ZIP archive with a CLI verifier does not meet this bar — it
  fails German public-sector document workflows on first contact, regardless of
  its cryptographic quality.
- **M** The bundle is therefore a **dual-layer container**:
  - a **PDF/A-3 document** (ISO 19005-3) that is readable, printable, and
    archivable by every party without explanation, and that satisfies long-term
    archiving expectations on its own;
  - **embedded machine-verifiable payload** — the assertions, certificate chain,
    and Merkle inclusion proofs — carried as attachments inside that PDF/A-3.

  The precedent is already familiar to this market: ZUGFeRD e-invoicing uses
  PDF/A-3 with an embedded structured payload, so "a PDF that also contains the
  machine-readable evidence" is an established pattern in German administrative
  practice rather than something the product has to teach.
- **M** Verification must run **offline in a stock browser** — an
  HTML/WASM verifier that executes locally from the bundle, with no install, no
  CLI, no network, and no vendor service. The human-readable layer and the
  verifiable layer must be one artifact, so they cannot be separated in
  circulation.
- **S** The verifier must state plainly what it proved, what was redacted, and
  the attribution tier (MR-3) of each assertion it checked — in the reviewer's
  language, not in cryptographic terms.
**Value at n=1.**

- **M** The product must be fully useful for a single project lead with zero
  external adoption. Every network effect is upside, never a precondition. The
  agency requirements above raise the ceiling; they must never become a floor
  that the product needs other parties to reach.

**Asymmetric countersigning.** The mechanism by which a one-sided claim becomes
a mutual one without the other party deploying anything.

- **M** An external party must be able to countersign a specific asserted item
  directly from an exported bundle, the project view, or a single-use link, using
  **WebAuthn or a passkey in their own browser**, producing a signature over the
  item's hash. No install, no account, no persistent node, no software to keep.
  This is raised from *should* to *must* because it is the only path by which a
  participant who has adopted nothing can act under their own attribution rather
  than be described by someone else. Without it, MR-6 delivers visibility but not
  agency, and the §5 position reduces to a better-documented one-way record.
- **M** The countersignature converts the ingesting party's unilateral claim
  into a mutually signed Class B assertion, and must be verifiable offline from
  the bundle thereafter.
- **M** Scope must be unambiguous and visible to the signer: exactly what is
  being countersigned, and that it is a project acknowledgement rather than a
  qualified electronic signature.
- **M** **Identity binding is the limit of this mechanism and must be stated
  rather than glossed.** A passkey proves the same authenticator signed, not
  who holds it. First-time binding of that credential to a named person rests on
  the out-of-band channel it was delivered through and on the project
  authority's attestation — not on the cryptography. Evidentiary weight follows
  accordingly, and product language must not imply a passkey countersignature
  carries eIDAS-qualified force.

### MR-7 — Compliance And Jurisdiction

Scope must be stated, because "auditable" and "transparent" are not the words
that clear procurement.

- **M** Primary jurisdiction for v1 is Germany, extending to DACH and the EU.
  DSGVO/GDPR obligations — lawful basis, data subject rights, processor
  relationships, deletion versus retention conflicts — must be answerable for
  every data flow the product creates.
- **M** The product must be able to state, per data category, where data
  resides and what leaves the customer's control. This must be answerable by the
  customer without vendor assistance.
- **M** The HOAI Leistungsphasen structure must be representable, since it is how
  the target market segments responsibility, deliverables, and payment — and,
  per MR-2, how canonical authority moves between parties over the project's
  life. The phase model is not a reporting convenience; it is load-bearing for
  access control.
- **M** Retention behaviour must accommodate a ≥10-year evidence horizon, and
  the product must resolve the conflict between erasure obligations and evidence
  retention rather than leaving it to the customer. The position taken, subject
  to counsel confirmation:

  **Erasure versus the append-only journal.** Personal data embedded in a
  cryptographic chain cannot be deleted without breaking parent hashes, so an
  Art. 17 request and an immutable journal appear irreconcilable. They are not,
  and the resolution has two independent parts:

  1. **Contractual assertions are retained under Art. 17(3).** Records that
     evidence project commitments fall under 17(3)(b) — processing required to
     comply with a legal obligation, including commercial and tax record
     retention — and 17(3)(e) — establishment, exercise, or defence of legal
     claims, which is the operative ground given BGB and VOB liability periods
     running years past handover. Erasure does not extend to these, and the
     product must be able to explain *per record* why a given item is retained
     rather than asserting a blanket exemption.
  2. **Everything else is crypto-shreddable by construction.** Non-contractual
     personal data — contact details, mail bodies, routing hints, incidental
     participants — lives only in encrypted content-addressed leaves (MR-2
     Class A). An erasure request destroys the relevant leaf keys. The content
     becomes unrecoverable; the hash, the assertion graph, and every proof over
     it remain valid.

  The design consequence is strict and non-negotiable: **the assertion graph
  must never itself carry personal data.** Once it does, erasure is impossible
  for the life of the project, and the compliance position collapses with it.
- **S** The product must be able to produce a record-level account of what was
  shredded, when, and on what request — without that account itself becoming a
  new personal-data store.
- **S** Alignment with revision-safe record-keeping expectations (GoBD-style
  immutability and traceability) should be assessed for the journal and export
  surfaces.
- **C** eIDAS-qualified electronic signatures, where a signature must carry
  legal weight beyond attribution. Requires a qualified trust service provider
  and is a separate commercial commitment.
- **M** No compliance claim ships without counsel review. See §12.

## 10. Success Criteria

All criteria are evaluated on the reference project (§8). They are written to be
testable there rather than aggregated across a partner cohort.

1. **Adoption without migration.** The reference project runs live in Projektor
   within 10 working days of first use, with no data migration project and no
   change to the office's existing mail, file, or CAD systems.
2. **Value at n=1.** The project lead continues daily use for 8 weeks with zero
   external participants having adopted the product.
3. **Evidence reconstruction.** Given only an exported bundle, a reviewer with
   no access to the originating system correctly reconstructs the provenance and
   approval path of a specified decision — in under 15 minutes, without
   assistance from the office that produced it.
4. **Verified redaction.** The same bundle, exported redacted, still verifies,
   and the reviewer can confirm both what is proven and that material was
   withheld — without learning the withheld content.
5. **Chain verification offline.** A role decision and an approval path verify
   from the bundle with the machine disconnected from any network, and a
   superseded certificate is still visible in the evidence rather than absent.
6. **Evidence survives lapse.** With the organization's attestation window
   expired, previously made assertions still verify, and the verifier reports
   them as valid-as-asserted rather than as errors or warnings. New contractual
   assertions are refused at the same time. Both halves must hold together.
7. **Procurement clearance.** A data protection reviewer answers, correctly and
   unaided after reading the product documentation, where project data resides
   and what is transmitted. No escalation to the vendor required.
8. **Participation without adoption.** At least one external party on the
   reference project accepts an exported evidence bundle or the project view as
   sufficient, without installing anything. The bundle opens as a normal document
   in their existing workflow, and its verifier runs in their browser offline.
9. **Countersignature without adoption.** At least one external party
   countersigns an asserted milestone from a bundle or link, using a passkey,
   without installing anything or creating an account — and the result verifies
   offline afterwards.
10. **Tier legibility.** A reviewer reading an exported bundle correctly
   distinguishes an unauthenticated local claim from a contractual assertion,
   unprompted.
11. **Divergence is legible.** Where two participants assert incompatible state,
   users identify the divergence and its parties from the interface alone, with
   no support contact and no silent resolution.
12. **Retroactive entry survives review.** At least one real retrospective
   approval or revised baseline occurs on the reference project, is recorded as
   such, and is correctly read back by a reviewer as retroactive rather than
   contemporaneous.
13. **Zero-effort onboarding.** A participant who has not previously heard of the
   product obtains **their own project record** in under two minutes, unassisted,
   without creating an account and without installing anything. Measured on at
   least three external organizations on the reference project. If this requires
   a support call, the §5 agency claim is not met.
14. **Mutual sharing actually happens.** At least two external organizations on
   the reference project share from their own records *back* to the office —
   not merely receive. A project in which sharing runs one way is the minimal
   tier wearing the peer tier's clothes, and refutes the MR-6 model.
15. **Divergence is survivable in the field.** At least one real disagreement
   between two participants' records occurs, is surfaced to both as an open
   divergence rather than merged, and is resolved by the parties without support
   contact and without either party losing their own version.
16. **Presentable responsibility.** At least one external participant uses the
   product's output to present their own position — what they committed to, what
   they delivered, and on what basis — to another party, and that party accepts
   it without contacting the office that produced the record. This is the test of
   whether responsibility is genuinely presentable or merely recorded.
17. **Content-addressed ingestion.** Given an artifact with known bytes,
   ingestion returns the exact SHA-256 of those bytes as its BLOB reference and
   leaves the source unchanged. Ingesting the same bytes again yields the same
   reference; changing one byte yields a different reference. The result is
   verified through the real Projektor ingestion adapter, not a fixture-only
   hash field.

## 11. Product Boundary

**Two different things are under construction, and they must not be conflated.**
An earlier version of this section did conflate them and understated the product
by a wide margin.

**The platform mechanism exists and is under test.** The signed-assembly model —
specified in
[`one-experimental/docs/signed-assembly-versioning-and-blob-sync-architecture.md`](../../one-experimental/docs/signed-assembly-versioning-and-blob-sync-architecture.md)
— is implemented in `@refinio/assembly.core` and its neighbours. Verified green
at the time of writing:

| Package | Tests | Covers |
|---|---|---|
| `assembly.core` | 72 in 17 files | Deterministic gestalt signing; rejection of any signed-field mutation, wrong signer key, and malformed signature bytes; full verification of signer/keys/entity binding, writer-policy authorization, and blob closure; the head log; release authoring |
| `trust.core` | 18 | Certificate bundle status, effective issuer key, root selection |
| `sync.core` | 72 | Synchronization |

Concretely, these are implemented rather than designed: an assertion is signed
over its complete gestalt and any mutation of a signed field is rejected; a
signature by a key not owned by the named signer is rejected; a transition whose
signer is outside the writer policy it consumes is rejected; a payload whose
calculated identity differs from its claimed entity is rejected; divergent heads
are held as explicit concurrent state and never silently merged; and selective
disclosure is authored as a release carrying exactly the disclosed closure with
no predecessors, so no working history crosses the boundary.

**Projektor is working software, not a mock.** "Prototype" describes the
current product maturity and the fact that some surfaces are still being
validated; it does not mean that interactions are fabricated. The application
executes real local operations and consumes reusable package owners from the ONE
workspace. In particular, ingestion reads actual source bytes, calculates their
SHA-256 hashes, stores the bytes as ONE BLOBs, and retains the returned hashes
as native BLOB references on typed `ProjectSourceArtifact` objects. Project
source inventory and changed-file snapshots remain read models and do not
misrepresent Git object IDs or observed-but-unstored digests as BLOB references;
the schedule runs through `planner.core`/`updater.core`; and import, validation,
projection, and export logic execute rather than returning canned success
responses. Seeded project data is test and evaluation input to that software,
not a substitute for the software.

The integration boundary is narrower than the product boundary. The current
Projektor application does not yet route its contractual project-state surfaces
through `assembly.core`, `trust.core`, and `sync.core`. Those packages are real,
implemented platform capabilities, while the Projektor ingestion, planning,
source, and projection paths are real application capabilities. A visible role,
journal, sharing, or sync concept in the application is therefore not by itself
evidence that the signed-assembly and certificate-chain path is connected to
that surface. Support claims must be made per executable flow and its tests, not
by labelling the whole application either "implemented" or "demo".

Executable evidence for the currently connected data path includes:

| Surface | Implementation evidence | Projektor evidence |
|---|---|---|
| BLOB storage | ONE.core `storeArrayBufferAsBlob` hashes bytes with SHA-256 and addresses the stored BLOB by the resulting hash | `project-source.core` stores the returned hash in `ProjectSourceArtifact.blob`, whose recipe uses `referenceToBlob`; its storage test reads the exact bytes back from a real ONE instance |
| Git-backed ingestion | `@refinio/source.git` reads real repository state and exposes tracked inventory and dirty worktree state | `ingestProjectFileFromGitSource` reads the selected repository file, rejects paths outside the repository, and persists the bytes and typed provenance through the native ingestion path; its real Git/ONE integration test runs in `npm test` |
| Project planning | `planner.core` and `updater.core` own the state-DAG operations | `project.core`, `table.core`, HOAI, and dataset tests exercise schedule validation, CPM, projections, and exports |

This table is an implementation inventory, not permission to infer stronger
evidence, confidentiality, or legal claims from ingestion alone. A SHA-256 BLOB
reference proves byte identity; it does not by itself prove authorship,
authority, acknowledgement, or historical validity.

**What genuinely does not exist anywhere yet:**

- the **PDF/A-3 dual-layer bundle** and the **offline browser verifier** for
  parties who run nothing (gate 7) — no implementation in either repository;
- **Merkle inclusion proofs and hash redaction** as described in MR-4 (gate 8) —
  see the note below, because the platform may have answered this differently;
- the **divergence resolution surface** (gate 2). Divergence is correctly *held*
  by the head log; what a Projektleiter sees is unbuilt;
- Projektor's integration of contractual project-state surfaces with
  `assembly.core`, `trust.core`, and `sync.core`.

**MR-4's redaction model may be superseded.** MR-4 specifies selective
disclosure as deterministic hash redaction with Merkle inclusion proofs over a
journal. `assembly.core` instead implements disclosure as an authored **release
assembly**: a predecessor-free edge whose strong closure is precisely the content
being disclosed, bound to its source identity and audience, granted by exact
`Access`. That achieves MR-4's requirement — prove a specific item to a specific
audience without exposing unrelated project data — without redaction, because
undisclosed material was never in the released graph to begin with. It is also
easier to explain to a reviewer, which was MR-4's stated reason for preferring
hash redaction over zero-knowledge proofs. **MR-4 and gate 8 should be re-opened
against the release model rather than specified as written.**

## 12. Open Decisions Gating Stronger Claims

Each must be closed before the corresponding claim may be made externally.

Certificate issuance, supersession, and local chain verification are **decided**
and specified in the admin.cube PRD; they are not open questions and are omitted
here.

Four gates previously listed here are now **resolved in direction** and have
moved into the requirements above — authority binding (MR-2, phase-scoped
certificates), no-password exposure (MR-3, attribution tiering), bundle format
(MR-6, PDF/A-3 with offline browser verifier), and erasure versus retention
(MR-7, Art. 17(3) plus crypto-shreddable leaves). What remains is their
specification and validation, tracked below as gates 1, 3, 5, and 7.

| # | Decision | Gates |
|---|---|---|
| 1 | Phase-to-authority mapping for HOAI LPH 1–9: which role certificate is canonical for which record class in which phase, and who issues at each transition | Any "shared project state" claim |
| 2 | Divergence resolution **UX** for incompatible assertions. *Semantics are implemented* — `assembly.core` holds concurrent heads as explicit divergence, never merges silently, and materializes a deterministic Merge record only as the parent of an authored write. What remains is what a Projektleiter sees and does. | Any coordination claim |
| 3 | Attribution-tier boundary specified: exactly which operations require a user-verifying authenticator, and how the tier is represented in the bundle | Any evidentiary-weight claim; onboarding no-password flow |
| 4 | Recovery ceremonies for key loss and rotation that preserve prior evidence | Any long-term evidence claim |
| 5 | Per-leaf key management for crypto-shredding: key derivation, where shred keys live, and how shredding propagates to already-shared replicas | Any erasure or compliance claim |
| 6 | What a peer learns from sync **metadata** alone. *Transport exists* (`sync.core`, CHUM); this gate is the privacy analysis over it, not the transport itself. | Any confidentiality claim |
| 7 | PDF/A-3 bundle profile and offline verifier: attachment layout, verifier scope, archival conformance testing. **Fully open** — no implementation in either repository. Note that *verification logic* already exists in `assembly.core`; what is missing is packaging it for a party who runs nothing. | MR-6 minimal tier and every non-adopter audit claim |
| 8 | **Re-open before specifying.** MR-4 assumes redaction with Merkle inclusion proofs; `assembly.core` implements selective disclosure as an authored release whose closure is exactly the disclosed content, which may remove the need for redaction entirely (see §11). Decide which model stands before writing a journal spec against the other. | Any selective-disclosure or audit-export claim |
| 9 | WebAuthn countersignature binding: how a credential is bound to a named party at first use, and what weight the result is claimed to carry | MR-6 countersigning |
| 10 | Bounded parsing set frozen and published | The "integrate without migrating" claim |
| 11 | §8 dimensions instrumented and measured on the reference project | v2 architecture sign-off; scaling beyond one project |
| 12 | Counsel review — privacy, telemetry, evidentiary wording, and specifically the Art. 17(3) retention position in MR-7 | Any public compliance or legal-weight claim |
| 13 | Freshness policy for access-control decisions: how current chain state must be to decide on it, and behaviour when it is not | Any access-control claim; revocation effectiveness |
| 14 | Attestation renewal cadence and what an organization experiences when its window lapses mid-project | The licence-lapse position in MR-3; any continuity claim |
| 15 | Link-based project-view authorization *for the minimal tier*: what a link grants, what a forwarded link grants, how the recipient is bound to a role without an account, how access is withdrawn, and how MR-4 cryptographic role filtering is enforced on a surface with no enrolled identity | MR-6 minimal tier; any confidentiality claim about the shared view |
| 16 | Whether evidence produced before attestation requires reissue, or becomes verifiable when the attestation binds the keys already held. Flexibel's precedent suggests the latter where the key is unchanged | The unattested-window position in MR-3; any "work before you formalize" sales claim |
| 17 | Role vocabulary and hierarchy for HOAI: the `RoleConfig` equivalent — which role may issue which, and which may vouch for whose identity, distinct from gate 1's phase mapping | Any role-filtering or authority claim |

**Gate 15 belongs to the minimal tier only.** The shared view has to reconcile two
requirements that pull against each other: no-account access says a bearer link,
while MR-4 says role filtering is enforced cryptographically rather than
presentationally. A bearer link satisfies the first and, on its own, fails the
second — anyone who receives the forwarded link inherits the role. This does not
arise in the peer tier, where the recipient holds keys of their own and MR-4 can
be enforced against an identity; it is the price of serving participants who hold
nothing, and it must be settled before the shared view ships.

**Gate 2 now carries the product.** With peer participation as the model (MR-6),
divergence stops being an edge case and becomes the routine visible consequence
of parties keeping their own records. The *semantics* are implemented and
correct — concurrent heads are held honestly and never silently merged — so what
remains is entirely a design problem: what a Projektleiter sees when two records
disagree, and how they resolve it without a support call. That is success
criterion 15, and it deserves attention proportional to how often it will be
seen.

**Gate 5 carries a distributed problem the others do not.** Shredding a leaf key
on the originating device does not shred replicas already shared with other
organizations. What the product can honestly promise about erasure of shared
data — versus erasure of what remains under the customer's control — must be
settled before any erasure claim is made externally.

## 13. Risks

- **Single-project overfit.** The largest risk created by the §8 strategy. One
  reference project will impose its own conventions, and building for it can
  produce a system that fits it and nothing else. Mitigated by treating the §8
  dimensions as measurements rather than requirements, and by naming the two
  tripwires that force an architecture re-open.
- **The peer tier collapses into the minimal tier** (MR-6). The sharpest risk
  the model carries. If external parties only ever read shared views and never
  keep records of their own, sharing runs one way, and the product becomes a
  publishing tool with cryptography attached — while the positioning in §5 claims
  mutuality. The failure is quiet: every individual interaction still works, and
  nothing surfaces as an error. Measured directly by the peer/minimal split in §8
  and by success criterion 14; mitigated by designing for n=1 so the office is
  never blocked, and by keeping the peer path genuinely zero-effort rather than
  merely possible.
- **Federation makes divergence routine.** In a single-tenant product,
  incompatible state is an anomaly. Here it is the normal consequence of parties
  keeping their own records, and users will meet it often. If gate 2 produces a
  divergence surface that a Projektleiter finds confusing or alarming, the model
  will be blamed for the interface. This deserves design attention proportional
  to how often it will be seen, which is far more often than the current gate
  ordering implies.
- **Sales cycle length.** Deferred rather than solved. Engaged incumbents carry
  v1; the second and third customers face the full AEC and public-sector cycle
  with no such relationship. The wedge (§6) exists for them.
- **Certificate chain as single point of failure.** Every guarantee in this
  document reduces to the chain (MR-3). A gap in issuance, recovery, or
  verification is not a degraded feature — it invalidates the product's core
  claim. Recovery ceremonies (gate 4) deserve disproportionate design attention.
- **A verifier written to check "valid now."** This is the most likely single
  defect in the whole system, because checking current validity is the obvious
  implementation and it passes every test written on fresh data. It surfaces
  years later, on a customer whose licence lapsed, as the total loss of their
  project record. It needs an explicit test asserting that evidence signed under
  an expired chain still verifies — written before the verifier is.
- **Renewal as a recurring dependency.** Attestation windows make refinio an
  annual dependency, not a one-time one, and key rotation compounds it. The
  continuity story ("your evidence verifies forever without us") is true for
  verification and false for issuance; both halves must be said together or the
  claim reads as broader than it is.
- **Personal data leaking into the assertion graph.** A single convenience —
  a name denormalized into an assertion for display, an email in a routing
  field — permanently destroys the erasure position in MR-7 for the life of the
  project, and it will not be noticed at the time. This needs an automated
  structural check in the build, not a code-review convention.
- **Attribution tiering ignored in practice.** If most real work happens at the
  unauthenticated tier because the authenticated one is inconvenient, the
  evidence model is decorative. The tier boundary (gate 3) must be placed where
  users will actually cross it, and adoption of the contractual tier should be
  measured on the reference project, not assumed.
- **Countersignature over-reading.** A passkey acknowledgement is not a
  qualified signature, but it will look like one to a non-technical party and
  may be relied on as such. The mismatch between what the ceremony proves and
  what a reviewer assumes it proves is a liability risk for the product, not
  only for the user.
- **Connector surface growth.** Mitigated by the explicit ingestion depth
  boundary (MR-1). Erosion of that boundary is the leading indicator of
  scope failure.
- **Evidence claims outrunning implementation.** Mitigated by §11 and §12.
  Claiming audit or tamper-evidence properties that do not exist remains the most
  damaging available mistake in this market. The live instances of it are the
  PDF/A-3 bundle and the offline verifier for parties who run nothing (gate 7),
  neither of which exists.
- **This document understating what exists.** The mirror-image failure, and it
  has already happened more than once: §11 previously asserted that signed
  assertions, key management, and a synchronization transport were
  unimplemented, when `assembly.core`, `trust.core`, and `sync.core` implement
  and test those mechanisms; it also described Projektor as a static demo when
  its ingestion path processes real bytes into SHA-256-addressed BLOB references
  and its project cores execute real planning and projection logic. Anyone
  writing sales, procurement, or product material against that wording would
  understate the product while still failing to identify the narrower integration
  gaps that matter. §11 therefore inventories the application and the reusable
  packages separately. Claims about what is or is not built must be checked
  against executable flows and tests rather than inferred from the word
  "prototype."
- **Complexity leaking into the interface.** Signed assertions, supersession,
  divergence, and redaction are conceptually heavy. If a project lead has to
  understand any of it to do their job, the product fails regardless of
  correctness.
- **Positioning drift.** The onboarding MRD targets architecture offices
  specifically. Any broadening of this document toward generic project
  management removes the differentiator and moves the product into a segment
  where it cannot win.
