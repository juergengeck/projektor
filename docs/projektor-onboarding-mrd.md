# projektor.one Onboarding MRD

## 1. Scope

This document covers first contact: everything from opening projektor.one to
reaching a working project. It is subordinate to the
[Product MRD](./projektor-mrd.md) and inherits its trust model from MR-3 there
and from the [admin.cube PRD](./projektor-admin-cube-prd.md).

Onboarding carries a weight disproportionate to its size. It is the only moment
at which the participant's key material comes into existence and the only
moment at which recovery can be arranged. Over a multi-year evidence horizon,
key loss is a certainty, and a vault that was never given a recovery path is
unrecoverable years later — by which time the project record it protects is
exactly what someone needs. Onboarding is therefore an evidence-model surface,
not a welcome screen.

## 2. Market Problem

Architecture offices manage long-running projects with many external
participants, formal roles, project mail, documents, decisions, and
procurement-sensitive evidence. New software is blocked by trust questions
before users ever reach the project workflow:

- Is this a cloud account or a local project tool?
- Where does project data live?
- Will client, authority, or project mail be uploaded automatically?
- Can procurement teams understand usage without exposing project content?
- Is the password a vendor login or a local protection choice?
- If this machine is lost, what happens to years of project evidence?

The first five must be answered before the first project opens. The sixth is
usually not asked at first contact — which is precisely why onboarding has to
raise it rather than wait.

## 3. Target Users

- Architecture office owners evaluating projektor.one for office-wide use.
- Project leads who need a controlled cockpit for multi-year projects.
- Procurement and public-sector stakeholders who need transparent usage
  evidence.
- Data protection reviewers who need a clear local-first story.

Onboarding must work for a project lead whose external participants never adopt
the product (Product MRD MR-6). It must never present external adoption,
invitations, or a peer connection as a precondition for reaching a working
project.

**There are two onboarding paths, and this document covers one.** MR-6 defines
the second: a project participant obtaining **their own project record**, with no
account, no installation, and zero onboarding effort — peer participation is the
model, not a later upgrade. That path is out of scope here — this document covers
the office user's first run — but the two must not contradict each other. Neither
may present the other's ceremony as a precondition, the participant path must not
inherit any step from this one, and neither may frame a participant as a guest in
another organization's system.

## 4. Positioning

projektor.one uses the web as an app store: the browser can install and run
project software without an app-store gatekeeper. The product should feel like a
local-first project management system for architects, not a SaaS login screen.

## 5. Core Message

1. The web is the app store: install or open projektor.one from the browser.
2. User and project data stays local on the user's machine, in the user's
   browser, unless they explicitly configure sharing or sync.
3. Projektor does not upload project data to vendor servers automatically.
4. With consent, usage statistics can be collected for procurement and adoption
   reporting.
5. **Email is an identity ID, not a login credential.** There is no vendor
   account being created.
6. **The password unlocks the local vault holding your key material.** It is a
   credential, not the thing that makes project records trustworthy — that comes
   from the certificate chain (Product MRD MR-3).
7. **Your key material is what proves your project record later.** If it is lost
   without a recovery path, that proof is lost with it.
8. **Without a password you can work; with one you can commit.** An unprotected
   vault produces local claims. Decisions, approvals, and baselines need a vault
   or passkey the user actually unlocks.

Messages 6 and 7 replace the earlier formulation "the optional password protects
local data only," which was accurate about what the password is *not* but
implied the password was the security boundary. It is not.

## 6. Experience Principles

- Start with a friendly identity question, not an account wall.
- Separate trust, local storage, key material, password, recovery, and
  statistics consent into distinct, understandable steps.
- Never imply that email plus password creates a central server account.
- Keep opt-in statistics separate from required onboarding.
- **The trust model is load-bearing but must stay invisible.** Certificates,
  chains, signing, and supersession must never appear in onboarding vocabulary.
  The user makes decisions about *their identity, their machine, their
  password, their recovery, and their consent* — never about cryptography.
- **Be honest at the point of the choice, not in a help page.** Where a choice
  weakens protection, say so plainly in one sentence, at the moment it is made,
  without alarm language and without blocking the choice.
- Support German, English, French, and Spanish from the first screen.
- Keep language suitable for architects and procurement teams.

## 7. Onboarding Requirements

Priority: **M** = must, **S** = should, **C** = later.

### OR-1 Identity

- **M** Identity is established locally. Onboarding generates the participant's
  key pair on the device; no vendor round trip, no account provisioning.
- **M** Email is captured as an identifier and routing hint only. The interface
  must not present it in a way that reads as a login.
- **M** A user must reach a working project with no network connection
  available.
- **S** Role certificates are issued by a project authority, not during
  onboarding. Where onboarding mentions roles at all, it must not imply the
  user has granted themselves one.

### OR-2 Storage And Location

- **M** The user is told where data resides, in concrete terms — this browser,
  this machine — before the first project opens.
- **M** Onboarding states plainly that project data is not transmitted
  automatically, and does not overstate this into a general confidentiality
  guarantee.
- **S** Browser storage limits, eviction risk, and backup expectations must be
  surfaced somewhere reachable from onboarding. A browser evicting the origin's
  storage is data loss, and users will not infer this.

### OR-3 Password And Vault

- **M** The password is presented as unlocking local key material, not as
  encrypting or protecting "project data" generically.
- **M** The password is optional, and choosing no password must still reach a
  working project.
- **M** Where no password is chosen, onboarding states the consequence in terms
  of **what the user can do**, not in terms of cryptographic exposure. The
  product's answer to the no-password path is attribution tiering (Product MRD
  MR-3): an unprotected vault produces *unauthenticated local claims* — fine for
  working, drafting, ingesting, and annotating — but not *contractual project
  assertions*. Onboarding says that in one plain sentence, at the point of the
  choice.
- **M** Onboarding must not present the tier as a downgrade or a warning state.
  Most users' first weeks are entirely local work, for which the lower tier is
  correct and sufficient.
- **S** The upgrade path must be reachable at the moment the tier first blocks
  something — the user is told what they need and can set it up there, rather
  than being sent to settings to guess.
- **S** Vault state — locked, unlocked, missing, recovery-needed — must be
  discoverable after onboarding, in settings.

### OR-4 Recovery

- **M** Onboarding must offer a recovery path for key material and must record
  whether the user accepted or declined it.
- **M** Declining recovery is permitted and must not block progress, but the
  consequence must be stated once, plainly, at the point of declining.
- **M** Recovery must remain arrangeable later from settings, and a user who
  declined must be able to find it without support.
- **S** Recovery is an explicit ceremony, never a silent fallback (admin.cube
  PRD). Onboarding sets up the ceremony; it does not perform recovery.
- **C** Office-level recovery, where an office holds a recovery capability for
  its staff. Attractive for the owner-buyer, but it is a policy and liability
  decision before it is a feature.

### OR-5 Statistics Consent

- **M** Opt-in, separate from required onboarding, declinable without
  consequence to product function.
- **M** What is and is not collected is stated in terms a procurement reviewer
  can repeat without reading further documentation.
- **M** No collection before the telemetry schema is finalized and counsel has
  reviewed the wording (Product MRD gate 12).

### OR-6 Language And Re-Entry

- **M** German, English, French, Spanish from the first screen.
- **M** Onboarding is revisitable and resettable from settings, including the
  trust and storage explanations, without destroying project data.

## 8. What Onboarding Must Not Claim

The Product MRD's boundary discipline applies with more force here, because
onboarding is where users form their model of the product's guarantees and they
will not revise it later.

- Not that the password encrypts project data, or that it is what makes records
  trustworthy.
- Not that data is protected against someone with access to the device, unless
  and until Product MRD gate 3 is closed and supports that claim.
- Not that a local claim carries the weight of a contractual assertion. Where the
  tier matters, onboarding states the limit rather than leaving the user to
  assume the stronger reading.
- Not that anything is tamper-evident, auditable, or compliant. Those properties
  depend on the certificate chain and export verifier, which are not yet
  implemented (Product MRD §11).
- Not that sharing is end-to-end encrypted, until the transport model is decided
  (Product MRD gate 6).
- Not that a legal or compliance obligation is satisfied. No compliance claim
  ships without counsel review.

## 9. Success Metrics

Evaluated on the reference project (Product MRD §8).

1. Users complete onboarding without asking whether projektor.one uploads
   project data automatically.
2. Procurement reviewers can repeat what statistics are and are not collected,
   unaided.
3. Users state that email is an identity field, not a vendor login, when asked
   afterwards.
4. Users who choose no password still reach a working project, and can say what
   they gave up by declining.
5. A user who declined recovery at onboarding later finds and completes it from
   settings without support contact.
6. Users can revisit or reset onboarding from settings.
7. No onboarding-originated support contact concerns a guarantee the product
   does not yet provide — the direct test of §8.

## 10. Open Decisions

Inherited from the Product MRD; listed here where they block onboarding
specifically.

| Product MRD gate | Blocks in onboarding |
|---|---|
| 3 — attribution-tier boundary | OR-3 wording; which operations the no-password path actually blocks |
| 4 — recovery ceremonies for key loss and rotation | OR-4 in full |
| 6 — transport encryption and sync metadata | Any sharing or sync language |
| 12 — counsel review of privacy and telemetry wording | OR-5 collection |

Onboarding-specific and not covered upstream:

- Whether recovery is offered as a required step with an explicit decline, or as
  a skippable one. Required-with-decline is the stronger default given a
  multi-year horizon, but it adds friction at exactly the moment the product is
  trying not to feel like an account wall. Decide before v1.
- Browser storage eviction: what the product does when the origin's storage is
  cleared, and what onboarding is obliged to say about it in advance.
- Multi-device use, when introduced, needs its own consent and trust step. Not
  in v1 scope.
