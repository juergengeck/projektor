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

## 4. Buyers, Users, And Non-Adopters

These are three different problems and must not be collapsed.

**Economic buyer — architecture office owner / managing partner.** Buys risk
reduction and provable diligence, not productivity. Decision driver: what
happens in a dispute, a Nachtrag, or an audit. Long sales cycle, low tolerance
for anything that looks like a new IT dependency.

**Daily user — project lead (Projektleiter).** Uses it every day or not at all.
Decision driver: whether it removes work (finding the decision, reconstructing
the thread) rather than adding a place to maintain state. Will abandon anything
that requires double entry.

**Reluctant participants — client, authority, specialist planners,
contractors, controllers.** Between 5 and 30 external organizations per project.
They have no budget line for your software, no obligation to install anything,
and often no interest. **The product must deliver value when they never adopt
it.** This is the single largest adoption risk and is treated as a market
requirement (MR-6), not as a risk to be monitored.

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
- produces an artifact (the exported evidence bundle) that non-adopting parties
  can consume and verify without installing anything, which is how the product
  reaches participants two and three.

Broader coordination — schedules, inventories, full document management —
expands from this wedge. It is not the way in.

## 7. Core Value Proposition

1. **Integrate without migrating.** Local files, project mail, spreadsheets,
   schedules, calendars, and repositories are ingested as immutable,
   content-addressed source objects, in place, without taking custody of or
   locking the originals.
2. **Coordinate commitments, not documents.** Milestones, dependencies,
   responsibilities, target dates, progress, and blockers are exchanged directly
   between participants as signed assertions, so everyone works from an aligned
   view of what was actually committed.
3. **Share selectively.** Participants choose which project areas and records
   leave their control, filtered by project role, and recipients can always
   distinguish a source record from an agreed state from a working draft from
   something superseded.
4. **Prove it later.** Every import, transformation, decision, approval,
   baseline change, and sharing event produces attributable journal evidence
   that can be exported and verified independently — including by parties who
   never used the product.
5. **Stay in control.** Each organization can state precisely where its data
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
| Adopting participants over time | How many actually install, and when | Confirms or refutes the n=1 design premise (MR-6). |
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
- **M** Ingestion must treat third-party artifacts (files, mail, spreadsheets,
  exports) as **immutable, content-addressed objects referenced in place**. The
  system must not modify, move, or lock source material, and must be able to
  re-verify that a referenced source is unchanged.
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

*Rationale: an "integrate everything" connector surface balloons without bound
and is the standard failure mode of this category. Immutable attachment plus
asserted claim is feasible now; semantic sub-record synchronization requires
bounded schemas and is a per-format commitment.*

### MR-2 — Data Model And Synchronization Semantics

The product spans three classes of state with different correctness
requirements. Conflating them is the primary technical risk.

**Class A — Bulk content** (ingested files, mail, exports)
- **M** Immutable and content-addressed. Identity is the content hash.
  Conflicts are impossible by construction; the same content ingested twice is
  the same object.
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

- **M** Identity must not depend on a central authentication provider. The
  system spans independent organizations and no single party can be the identity
  authority for all of them. The certificate issuer is an issuing authority, not
  an account provider, and must never become a runtime dependency for using the
  product.
- **M** Participants are identified by a cryptographic key pair they control.
  Email is an identifier and a routing hint, never a credential.
- **M** Project roles are **bounded certificates** bound to a participant's key,
  each carrying issuer, subject, scope, validity window, and signature.
- **M** Chain verification must be **local and repeatable** — no network call,
  no vendor service, no live endpoint. An audit performed in five years must
  verify from the bundle alone.
- **M** Invalidation is **supersession-based**, not a mutable deny list. A
  superseded certificate remains part of the evidence record; it does not
  disappear.
- **M** Verification must **fail closed**. Missing or unverifiable chain
  evidence denies the operation; it never degrades to permitting it.
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

### MR-6 — The Non-Adopting Participant

The product must produce value when every external party declines to install it.

- **M** Ingesting a participant's project mail and documents must make them a
  represented participant in the record without any action on their part.
  Assertions about their statements are clearly attributed as *asserted by the
  ingesting party*, never as signed by them.
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
- **M** The product must be fully useful for a single project lead with zero
  external adoption. Every network effect is upside, never a precondition.
- **S** A read-only, role-scoped view must be shareable with an external party
  requiring no installation and no account creation.

**Asymmetric countersigning.** The mechanism by which a one-sided claim becomes
a mutual one without the other party deploying anything.

- **S** An external party must be able to countersign a specific asserted item
  directly from an exported bundle or a single-use link, using **WebAuthn or a
  passkey in their own browser**, producing a signature over the item's hash.
  No install, no account, no persistent node, no software to keep.
- **S** The countersignature converts the ingesting party's unilateral claim
  into a mutually signed Class B assertion, and must be verifiable offline from
  the bundle thereafter.
- **S** Scope must be unambiguous and visible to the signer: exactly what is
  being countersigned, and that it is a project acknowledgement rather than a
  qualified electronic signature.
- **M** **Identity binding is the limit of this mechanism and must be stated
  rather than glossed.** A passkey proves the same authenticator signed, not
  who holds it. First-time binding of that credential to a named person rests on
  the out-of-band channel it was delivered through and on the project
  authority's attestation — not on the cryptography. Evidentiary weight follows
  accordingly, and product language must not imply a passkey countersignature
  carries eIDAS-qualified force.
- **C** Full peer participation for external organizations.

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
6. **Procurement clearance.** A data protection reviewer answers, correctly and
   unaided after reading the product documentation, where project data resides
   and what is transmitted. No escalation to the vendor required.
7. **Non-adopter reach.** At least one external party on the reference project
   accepts an exported evidence bundle or read-only view as sufficient, without
   installing anything. The bundle opens as a normal document in their existing
   workflow, and its verifier runs in their browser offline.
8. **Countersignature without adoption.** At least one external party
   countersigns an asserted milestone from a bundle or link, using a passkey,
   without installing anything or creating an account — and the result verifies
   offline afterwards.
9. **Tier legibility.** A reviewer reading an exported bundle correctly
   distinguishes an unauthenticated local claim from a contractual assertion,
   unprompted.
8. **Divergence is legible.** Where two participants assert incompatible state,
   users identify the divergence and its parties from the interface alone, with
   no support contact and no silent resolution.
9. **Retroactive entry survives review.** At least one real retrospective
   approval or revised baseline occurs on the reference project, is recorded as
   such, and is correctly read back by a reviewer as retroactive rather than
   contemporaneous.

## 11. Product Boundary

The current prototype demonstrates local-first onboarding, project sources,
role-filtered sharing, schedules, imports and exports, provenance-oriented
objects, and journal surfaces. These are product-direction signals. They are
**not** a claim that production-grade synchronization, tamper evidence,
encryption, legacy connectors, or audit guarantees exist today.

Specifically, the prototype does not yet implement: cryptographic role
enforcement, signed assertions, verifiable export, key management or revocation,
a real synchronization transport, or any compliance guarantee.

## 12. Open Decisions Gating Stronger Claims

Each must be closed before the corresponding claim may be made externally.

Certificate issuance, supersession, and local chain verification are **decided**
and specified in the admin.cube PRD; they are not open questions and are omitted
here. What remains open:

Certificate issuance, supersession, and local chain verification are **decided**
and specified in the admin.cube PRD.

Four gates previously listed here are now **resolved in direction** and have
moved into the requirements above — authority binding (MR-2, phase-scoped
certificates), no-password exposure (MR-3, attribution tiering), bundle format
(MR-6, PDF/A-3 with offline browser verifier), and erasure versus retention
(MR-7, Art. 17(3) plus crypto-shreddable leaves). What remains is their
specification and validation, tracked below as gates 1, 3, 5, and 7.

| # | Decision | Gates |
|---|---|---|
| 1 | Phase-to-authority mapping for HOAI LPH 1–9: which role certificate is canonical for which record class in which phase, and who issues at each transition | Any "shared project state" claim |
| 2 | Divergence resolution UX and semantics for incompatible assertions | Any coordination claim |
| 3 | Attribution-tier boundary specified: exactly which operations require a user-verifying authenticator, and how the tier is represented in the bundle | Any evidentiary-weight claim; onboarding no-password flow |
| 4 | Recovery ceremonies for key loss and rotation that preserve prior evidence | Any long-term evidence claim |
| 5 | Per-leaf key management for crypto-shredding: key derivation, where shred keys live, and how shredding propagates to already-shared replicas | Any erasure or compliance claim |
| 6 | Transport encryption and what a peer learns from sync metadata alone | Any confidentiality claim |
| 7 | PDF/A-3 bundle profile and offline verifier: attachment layout, Merkle proof encoding, verifier scope, and archival conformance testing | MR-6 and every audit claim |
| 8 | Journal structure supporting Merkle inclusion proofs and detectable redaction | Any selective-disclosure or audit-export claim |
| 9 | WebAuthn countersignature binding: how a credential is bound to a named party at first use, and what weight the result is claimed to carry | MR-6 countersigning |
| 10 | Bounded parsing set frozen and published | The "integrate without migrating" claim |
| 11 | §8 dimensions instrumented and measured on the reference project | v2 architecture sign-off; scaling beyond one project |
| 12 | Counsel review — privacy, telemetry, evidentiary wording, and specifically the Art. 17(3) retention position in MR-7 | Any public compliance or legal-weight claim |

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
- **Non-adoption by external parties** (MR-6). Reduced but not removed by having
  industry participants engaged: committed partners are not the same as the
  authorities, specialist planners, and contractors who appear later in a
  project and have no relationship with the vendor. Mitigated by designing for
  n=1 and by independently verifiable exports.
- **Sales cycle length.** Deferred rather than solved. Engaged incumbents carry
  v1; the second and third customers face the full AEC and public-sector cycle
  with no such relationship. The wedge (§6) exists for them.
- **Certificate chain as single point of failure.** Every guarantee in this
  document reduces to the chain (MR-3). A gap in issuance, recovery, or
  verification is not a degraded feature — it invalidates the product's core
  claim. Recovery ceremonies (gate 4) deserve disproportionate design attention.
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
  Claiming audit or tamper-evidence properties before decision 6 and 8 are
  closed is the most damaging available mistake in this market.
- **Complexity leaking into the interface.** Signed assertions, supersession,
  divergence, and redaction are conceptually heavy. If a project lead has to
  understand any of it to do their job, the product fails regardless of
  correctness.
- **Positioning drift.** The onboarding MRD targets architecture offices
  specifically. Any broadening of this document toward generic project
  management removes the differentiator and moves the product into a segment
  where it cannot win.
