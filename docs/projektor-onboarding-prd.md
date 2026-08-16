# projektor.one Onboarding PRD

Implements the [Onboarding MRD](./projektor-onboarding-mrd.md). Trust model and
terminology come from [Product MRD](./projektor-mrd.md) MR-3 and the
[admin.cube PRD](./projektor-admin-cube-prd.md).

## Objective

A first-run flow that introduces projektor.one as local-first architecture
project management software, establishes a local identity, and sets up vault and
recovery state before the project cockpit opens — while making no claim the
product cannot currently support.

## Scope

- First-run wizard rendered before the main app shell.
- Four UI languages: German, English, French, Spanish.
- Local identity profile: display name and email.
- Trust explanation: web-as-app-store, local-only data.
- Optional vault password, with the attribution-tier consequence stated.
- Recovery setup, with an explicit decline.
- Usage statistics consent for procurement reporting.
- Reset onboarding action in Settings.

## Non-Goals

- No user account creation, no server login.
- No key generation, password hashing, vault encryption, or recovery
  cryptography in this static prototype — state only.
- No telemetry upload.
- No production legal consent system.
- No role certificates. Roles are issued by a project authority, never during
  onboarding.

## Flow

**1. Identity**
- Ask: "How should the system address you?"
- Ask for email, explained as an identity ID, not a login.
- Require a non-empty name and a plausible email.

**2. Web App Store And Local Data**
- The web is the app store: no gatekeeper, no install ceremony.
- Data stays local, on this machine, in this browser.
- No project data is uploaded automatically.

**3. Vault Password**
- Explain the password as unlocking the local vault that holds the user's key
  material — not as encrypting or protecting "project data" generally.
- Both fields optional; if either is filled, require a match.
- **State the tier consequence in one sentence at the point of choice:** without
  a password, the user can work, draft, import, and annotate; decisions,
  approvals, and baselines need an unlocked vault.
- Present this as a scope difference, never as a warning, an error state, or a
  security nag.
- Do not persist the entered password.

**4. Recovery**
- Offer to set up recovery for key material, explained in terms of consequence:
  if this machine is lost and no recovery exists, the project record cannot be
  proven later.
- **Required step with an explicit decline**, not a skippable one. Declining is
  permitted, records the decline, and shows the consequence once — plainly, in
  one sentence, without blocking.
- Recovery must remain arrangeable later from Settings.
- Prototype records intent only. No recovery material is generated or stored.

**5. Usage Statistics**
- Optional consent checkbox, declinable with no effect on product function.
- Explain that statistics support procurement and adoption reporting.
- State that project content, documents, and mail bodies are never included.

**6. Review And Start**
- Summarize: identity, vault state, recovery state, statistics consent.
- Persist profile and consent state to localStorage.
- Open the cockpit.

## Copy Requirements

Onboarding copy is a product surface with evidentiary consequences. These
constraints are binding in all four languages.

**Must say**
- Email is an identity ID, not a login.
- Data stays on this machine, in this browser, and is not uploaded
  automatically.
- The password unlocks local key material.
- What the no-password path can and cannot do (tier consequence).
- What declining recovery costs.

**Must not say or imply**
- That the password encrypts project data or makes records trustworthy.
- That data is protected against someone with access to the device.
- That anything is tamper-evident, auditable, or compliant.
- That sharing or sync is encrypted.
- That any legal or compliance obligation is satisfied.
- Any vocabulary from the trust model: certificate, chain, signature,
  supersession, assertion, hash. The user decides about their identity, machine,
  password, recovery, and consent — never about cryptography.

## Prototype Data Model

- `projektor-profile-name` — local display name.
- `projektor-profile-email` — local identity email.
- `projektor-usage-stats` — boolean consent state.
- `projektor-password-enabled` — boolean only; no password value stored.
- `projektor-recovery-state` — `configured` | `declined` | `unset`.
- `projektor-attribution-tier` — `local` | `contractual`, derived from vault
  state. Stored explicitly so the cockpit can surface the tier without
  re-deriving it in each surface.
- `projektor-onboarding-complete` — first-run completion marker.
- Existing `projektor-language` and `projektor-theme` remain `UISettings`-style
  preferences.

Future ONE.core implementation should map these to local profile/settings
objects owned by reusable primitives from `../one`, particularly
`@refinio/settings.core` for `UISettings`/`SecretsPlan`, `@refinio/one.models`
for identity, and `@refinio/trust.core` for the vault and certificate surfaces.

## Production Divergence

The prototype records state where production performs a ceremony. Each of these
is a real step later, not a wiring detail:

| Prototype | Production |
|---|---|
| `projektor-password-enabled` boolean | Key pair generated on device; vault encrypted under a password-derived key |
| `projektor-recovery-state` marker | An actual recovery ceremony producing recoverable material (Product MRD gate 4) |
| `projektor-attribution-tier` field | Tier enforced at signing time — the unauthenticated tier cannot produce contractual assertions (gate 3) |
| No certificates | Role certificates issued by the project authority, post-onboarding |

## Acceptance Criteria

- Fresh browser state shows onboarding before the main app.
- Name and email validation blocks an empty identity step.
- The password step can be completed without a password.
- Password mismatch shows an inline error.
- The tier consequence appears on the password step itself, not in a help link
  or a later summary.
- The recovery step cannot be passed without an explicit choice; declining
  proceeds and is recorded as `declined`.
- Settings offers recovery setup to a user who declined, reachable without
  support.
- Usage statistics can be accepted or declined.
- The review step shows vault state and recovery state, not only identity and
  consent.
- Completion hides onboarding and shows the app.
- Settings contains a reset onboarding action; resetting returns to the first
  step without destroying project data.
- Language switching before completion re-renders all onboarding copy, including
  the tier and recovery consequence sentences, in the selected language.
- No password text is saved to localStorage.
- No copy in any of the four languages violates the "must not say" list.

## Open Decisions

- **Required recovery versus skippable.** This PRD specifies required-with-
  explicit-decline, which is the stronger default given the evidence horizon.
  It adds friction at the moment the product is trying hardest not to feel like
  an account wall. The prototype implements it this way so the friction can be
  observed on the reference project before v1 fixes it.
- **Tier presentation in the cockpit.** Onboarding sets the tier; the cockpit
  must show it without turning it into a persistent nag. Out of scope here,
  but the two surfaces must be designed together.
- **Browser storage eviction.** If the origin's storage is cleared, that is data
  loss. What onboarding is obliged to say in advance is unresolved (Onboarding
  MRD §10).
