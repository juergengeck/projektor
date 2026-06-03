# projektor.admin.cube PRD

## Objective

Create `admin.cube`, a privileged local operator application for provisioning, certifying, monitoring, and recovering Projektor deployments. The app is based on the `../refinio/packages/42.cube` desktop template but serves Projektor-specific administration: it owns sensitive operator credentials, manages project headless runtimes, coordinates with the `projektor.one` CA, and ensures that only signed, minimized accounting statistics are replicated outward to `refinio.one`.

The product goal is to separate high-trust administration from daily project work. `projektor.browser` and `projektor.cube` should remain project/user surfaces. `admin.cube` is the controlled local authority surface for deployment operators.

## Product Context

Projektor is local-first architecture project software. Offices and project operators need a way to run per-project services without turning Projektor into a central SaaS account system. A realistic deployment may have one `projektor.headless` server per architecture project, office, or project consortium. That server provides the same runtime functions that `projektor.browser` and `projektor.cube` need, while using CHUM/ONE trust and sharing mechanics instead of opaque vendor APIs.

The administrative system must support this topology:

- `admin.cube` runs locally for the operator and holds private administrative material.
- `projektor.headless` runs as a per-project or per-tenant server.
- `projektor.one` CA issues bounded service, project, and operator certificates.
- `projektor.browser` and `projektor.cube` connect to the relevant `projektor.headless` runtime.
- `refinio.one` receives only accounting-grade, signed, non-project-content statistics from `projektor.headless`.

The closest precedents are:

- `../refinio/packages/42.cube` for the Electron app shell and authority-dashboard shape.
- `../heiner/one.heiner/service` for a narrow headless CHUM runtime boundary.
- `../heiner/one.heiner/ca` for delegated certificate and public projection rules.
- `../refinio/packages/refinio.browser/browser-ui/src/services/browser-heiner-usage-stats-runtime.ts` for minimized usage-statistics projection patterns.

## Users

### Primary Users

- Projektor deployment operators who create and maintain project runtimes.
- Architecture office administrators who control project identities, roles, and service access.
- Projektor support or hosting operators responsible for Hetzner/server deployments.

### Secondary Users

- Procurement reviewers who need proof of usage without access to project content.
- Data-protection reviewers who need a clear separation between local project data, server runtime state, and accounting reports.
- Project leads who need confidence that administration and daily project collaboration are separate trust surfaces.

## Jobs To Be Done

- As an operator, I can create a new project server identity without exposing my long-term admin keys to the server.
- As an operator, I can certify a `projektor.headless` runtime for a bounded project scope.
- As an operator, I can pair browser/cube clients with the correct project runtime.
- As an operator, I can inspect whether a project runtime is healthy and certified.
- As an operator, I can rotate, revoke, or supersede service credentials.
- As a data-protection reviewer, I can see exactly which statistics leave a project runtime.
- As a procurement stakeholder, I can receive signed accounting evidence without receiving project documents, mail, participant directories, or private project metadata.

## Principles

- Root-cause architecture over fallback layers. Administration, authority, runtime, and accounting boundaries must be explicit instead of patched together with compatibility endpoints.
- Local-first by default. `admin.cube` must work as a local authority app and must not require a vendor login to hold credentials.
- Secrets stay inward. Private keys, recovery material, passwords, tokens, and project secrets belong in `admin.cube` or explicitly configured local secret storage, not in `refinio.one`.
- Headless stays narrow. `projektor.headless` should expose operational bootstrap, runtime sync, status, and accounting/reporting surfaces, not become an administrative vault.
- Typed evidence beats JSON blobs. Persistent state that crosses boundaries should be recipe-backed ONE objects with stable identities, signatures, and provenance references.
- Accounting is minimized. Reports sent toward `refinio.one` must be aggregate, signed, consent-backed, and free of project content.
- Users verify locally. Public status documents are discovery aids, not trust anchors. Trust comes from CHUM pairing, certificates, signatures, and local verification.

## Scope

### In Scope

- New `admin.cube` application based on the `42.cube` Electron/Vite/React template.
- A Projektor admin runtime layer shared by `admin.cube`, `projektor.headless`, and future CLI/test tools.
- Project provisioning flow for creating a project runtime identity and deployment package.
- Pairing flow between `admin.cube` and `projektor.headless`.
- Certificate request, approval, issuance, renewal, and supersession flows against `projektor.one` CA semantics.
- Local credential vault UX and state model.
- Project runtime registry with health, certificate, pairing, and accounting status.
- Accounting consent, commitment, report preview, and outbound replication state.
- Operational deployment guidance for a per-project `projektor.headless` server.
- Acceptance criteria for privacy, trust, accounting, and recovery behavior.

### Out Of Scope For First Delivery

- Full project management UI inside `admin.cube`.
- Editing project documents, mail, chat, HOAI tasks, or project content.
- Central SaaS user accounts.
- Public provider or participant directories.
- Automatic replication of project data to `refinio.one`.
- Billing implementation, invoicing, tax handling, or payment collection.
- A final legal consent text for production telemetry.
- Mobile admin app.
- Hardware-security-module integration.

## System Boundaries

### `admin.cube`

`admin.cube` is the privileged local administration surface.

Responsibilities:

- Hold or unlock operator credentials.
- Create project and service identity drafts.
- Approve and sign administrative actions when local authority is required.
- Pair with `projektor.headless`.
- Request or import certificates from `projektor.one` CA.
- Manage runtime registry entries.
- Preview and approve accounting-sharing commitments.
- Recover or rotate project service credentials.
- Display trust evidence and operational state.

Non-responsibilities:

- Serve project content to users.
- Store replicated copies of every project object.
- Act as the long-running server for daily browser clients.
- Send raw project data to `refinio.one`.

### `projektor.headless`

`projektor.headless` is the per-project or per-tenant server runtime.

Responsibilities:

- Own a scoped server/service identity.
- Maintain ONE/CHUM runtime state needed for project collaboration.
- Pair with authorized Projektor clients.
- Expose operational health and discovery endpoints.
- Materialize signed accounting reports from local aggregate inputs.
- Replicate approved accounting reports to `refinio.one`.
- Keep enough local evidence to prove what was sent and why.

Non-responsibilities:

- Hold root/admin private keys.
- Issue broad certificates without CA delegation.
- Mirror all project content into `refinio.one`.
- Serve as a public directory of participants, clients, providers, or organizations.

### `projektor.one` CA

`projektor.one` CA is the authority surface for Projektor-specific trust.

Responsibilities:

- Issue bounded project, service, and role certificates.
- Issue or verify licenses that authorize a `projektor.headless` runtime.
- Publish public trust projections and current certificate heads.
- Support renewal and supersession.
- Verify certificate chains for admin and runtime operations.

Non-responsibilities:

- Host project content.
- Act as a user account provider.
- Receive private keys or local vault state.

### `refinio.one`

`refinio.one` is the accounting and publication destination.

Responsibilities:

- Receive signed, minimized accounting reports from certified `projektor.headless` runtimes.
- Store public or operator-visible accounting evidence required for procurement/adoption reporting.
- Verify report signatures, certificates, and commitments.

Non-responsibilities:

- Receive readable project content.
- Receive personal directories, participant lists, mail bodies, documents, plans, or project secrets.
- Decide local project access.

## Product Surfaces

### 1. Admin Home

The opening screen shows the operator's local admin environment.

Required content:

- Current operator identity.
- Vault lock/unlock state.
- Known project runtimes.
- Certificate and renewal warnings.
- Headless connectivity summary.
- Accounting replication summary.
- Recent administrative events.

Required behavior:

- If no operator identity exists, start first-run setup.
- If credentials are locked, show only non-sensitive state and unlock actions.
- If a runtime has certificate, pairing, or replication problems, surface the exact failing boundary.

### 2. First-Run Operator Setup

The first-run flow creates or imports the local admin identity.

Steps:

1. Explain that this is a local administration app, not a Projektor user account.
2. Create or import an operator identity.
3. Configure local vault protection.
4. Show recovery responsibilities.
5. Optionally pair with an existing `projektor.one` CA or prepare an offline certificate request.

Acceptance criteria:

- The flow cannot imply that email plus password creates a vendor login.
- Private material is never written to public project files.
- The user must acknowledge that losing recovery material may block future administration.
- The app can run without network access after local identity creation.

### 3. Project Runtime Registry

The registry lists every known Projektor runtime.

Each runtime row should show:

- Project name.
- Runtime role, such as `project-headless`.
- Service owner id.
- Public base URL.
- CommServer URL.
- Certificate state.
- Last CHUM proof or pairing evidence.
- Health status.
- Accounting consent/commitment status.
- Last accounting report timestamp.
- Deployment environment label.

Actions:

- Add runtime.
- Pair runtime.
- Open runtime details.
- Refresh health.
- Draft renewal.
- Rotate service identity.
- Archive runtime entry.

### 4. New Project Runtime Provisioning

The provisioning flow creates a project runtime package and trust evidence.

Inputs:

- Project display name.
- Project stable identifier.
- Deployment type: local, Hetzner, custom server.
- Public base URL.
- CommServer URL.
- Storage directory policy.
- Accounting sharing policy.
- Runtime operator contact or organization label.

Outputs:

- Local registry entry.
- Runtime identity draft.
- Certificate request.
- Environment variable template.
- Deployment checklist.
- Pairing/bootstrap invitation instructions.

Acceptance criteria:

- The generated configuration never contains long-term admin private keys.
- The project identifier is stable and cannot silently change after certification.
- The certificate request includes project scope, runtime role, validity window, and provenance.
- The deployment output separates secret values from committed configuration.

### 5. Headless Pairing And Service Identity

`admin.cube` must prove that a deployed `projektor.headless` runtime controls its ONE identity.

Flow:

1. Operator opens runtime pairing in `admin.cube`.
2. `projektor.headless` exposes a short-lived bootstrap invitation or PIN-protected pairing challenge.
3. `admin.cube` pairs over CHUM.
4. `admin.cube` records live handshake evidence.
5. The evidence is used to draft or renew a service identity certificate.

Rules:

- HTTP status alone is not an identity proof.
- The live proof channel is CHUM pairing and key possession.
- Pairing challenges must be short-lived.
- Renewals should prefer already-issued certificate evidence when available.

### 6. Certificate Management

`admin.cube` manages certificate lifecycle with `projektor.one` CA.

Supported states:

- Draft.
- Submitted.
- Issued.
- Active.
- Superseded.
- Expired.
- Rejected.
- Locally distrusted.

Supported operations:

- Draft certificate request.
- Submit certificate request.
- Import issued certificate.
- Verify chain.
- Renew certificate.
- Supersede certificate.
- Mark locally distrusted.

Acceptance criteria:

- Certificate invalidation is version/supersession based, not an ad hoc mutable deny list.
- Every issued certificate has an issuer, subject, scope, validity window, and signature.
- Runtime access decisions can be explained from certificate chain evidence.
- `admin.cube` distinguishes public discovery metadata from signed trust evidence.

### 7. Accounting Consent And Commitments

Accounting is explicit and consent-backed.

The operator can configure:

- Whether this project runtime may report accounting statistics.
- Which destination is allowed, initially `refinio.one`.
- Which statistic classes are allowed.
- Reporting period.
- Aggregation threshold.
- Validity window.

The app must show what is excluded:

- Project documents.
- Mail bodies.
- Chat contents.
- Participant directories.
- Client or provider contact lists.
- Personal notes.
- Unredacted project metadata.
- Raw object hashes that would reveal project structure when not needed for accounting proof.

Acceptance criteria:

- No accounting report can replicate without an active consent and commitment.
- The user can preview the report schema before enabling replication.
- Commitment and report objects are signed.
- Reports carry provenance linking them to the consent/commitment and project runtime certificate.

### 8. Accounting Report Replication

`projektor.headless` sends only approved accounting reports to `refinio.one`.

Allowed report examples:

- Runtime id.
- Certified project/service role.
- Reporting period.
- Active licensed module count.
- Aggregate active user count, if thresholded.
- Aggregate project count for tenant-level reports.
- Feature usage counters.
- Storage or sync volume buckets.
- Report generation timestamp.
- Consent/commitment reference.
- Certificate chain reference.
- Signature.

Disallowed report content:

- Project names unless explicitly approved for billing/accounting display.
- Human names.
- Email addresses.
- Mail subjects or bodies.
- Document names or contents.
- Task titles.
- Chat messages.
- Participant lists.
- Provider/client directories.
- Raw project trie roots unless they are deliberately committed as public evidence.

Acceptance criteria:

- `refinio.one` can verify that the report came from a certified runtime.
- `refinio.one` can verify the report was allowed by an active commitment.
- Revoked or superseded commitments stop future reporting.
- Reports remain useful for accounting without exposing project content.

## Proposed ONE Object Vocabulary

The first implementation should define typed recipe-backed objects rather than JSON configuration files.

Candidate objects:

- `ProjektorAdminIdentityProfile`
- `ProjektorAdminVaultDescriptor`
- `ProjektorProjectRuntime`
- `ProjektorHeadlessServiceIdentityEvidence`
- `ProjektorProjectRuntimeCertificateRequest`
- `ProjektorProjectRuntimeCertificate`
- `ProjektorProjectIssuerLicense`
- `ProjektorAdminKeyApplication`
- `ProjektorAdminKeyDecision`
- `ProjektorAccountingConsent`
- `ProjektorAccountingCommitment`
- `ProjektorUsageStatsReport`
- `ProjektorRefinioAccountingReport`
- `ProjektorRuntimeHealthSnapshot`
- `ProjektorDeploymentDescriptor`

Recipe rules:

- Identity fields must be compact and stable.
- Use `referenceToId` for logical identity references.
- Use `referenceToObj` for exact signed evidence versions.
- Keep free-form project names out of identity fields unless the name is intentionally part of durable identity.
- Persist producer-owned provenance at write time.
- Register recipes before storage or read paths use them.

## Runtime And Package Architecture

Recommended package split:

- `packages/projektor.admin.core`: admin recipes, certificate workflows, registry state, vault descriptors, accounting commitments.
- `packages/projektor.headless`: headless runtime, operational HTTP endpoints, CHUM pairing, report materialization.
- `packages/admin.cube`: Electron admin app based on `42.cube`.
- Existing `packages/project.core`, `packages/table.core`, and `packages/ngo.core` continue owning project-domain prototype logic until migrated into ONE recipes.

Shared runtime rules:

- Compose complete ONE recipe sets at the MultiUser construction boundary.
- Include one.models stable and experimental recipes when providing custom recipes.
- Include reverse maps and merge duplicate type entries by unioning property sets.
- Use `refinio.api` ModuleRegistry demand/supply for in-process services.
- Register public operations once, under canonical Projektor operation names.
- Prefer static ESM imports for runtime dependencies.

## Headless HTTP Surface

Initial operational endpoints:

- `GET /health`
- `GET /api/status`
- `GET /api/invite`
- `GET /api/discovery`
- `GET /.well-known/projektor`
- `GET /api/accounting/status`
- `POST /api/accounting/report-now`

Public deployment may also expose these below `/api/headless`.

Rules:

- `/health` is operational only.
- `/api/status` may expose owner id, role, certificate head, and public endpoints, but it is not a trust anchor.
- `/api/invite` creates a short-lived pairing invitation.
- `/.well-known/projektor` returns public discovery metadata.
- Accounting endpoints must not expose raw project data.
- Mutating endpoints require local admin pairing, scoped certificate authority, or explicit server-local authorization.

## Security And Privacy Requirements

- Private admin keys must never be replicated to `projektor.headless` or `refinio.one`.
- Server service keys must be scoped to the runtime role and project.
- Vault state must distinguish locked, unlocked, missing, and recovery-needed states.
- Secret export must require an explicit operator action.
- Pairing challenges must expire.
- Certificate chain verification must be local and repeatable.
- Accounting reports must be minimized and signed.
- The system must fail closed when consent, certificate, or commitment verification is missing.
- Logs must avoid project content, secret values, passwords, tokens, and private keys.
- Recovery flows must be explicit ceremonies, not silent fallback scans.

## Deployment Scenario: Per-Project Headless Server

Example:

1. Architecture office opens `admin.cube`.
2. Operator creates project runtime `kita-2028`.
3. `admin.cube` creates a service identity draft for `projektor.headless`.
4. Operator deploys `projektor.headless` to Hetzner using generated environment guidance.
5. Deployed runtime exposes `/api/status`, `/.well-known/projektor`, and `/api/invite`.
6. `admin.cube` pairs with the runtime and records CHUM handshake evidence.
7. `projektor.one` CA issues a bounded `project-headless` certificate.
8. `projektor.browser` and `projektor.cube` pair with the certified runtime.
9. Operator enables accounting sharing with a signed commitment.
10. `projektor.headless` emits signed aggregate accounting reports to `refinio.one`.

## MVP Requirements

### Functional

- `admin.cube` app shell builds and runs.
- Operator can create/import local admin identity state.
- Operator can register a project runtime.
- Operator can generate a deployment descriptor.
- Operator can pair with a headless runtime through a bootstrap invitation.
- Operator can view service identity evidence.
- Operator can draft a certificate request.
- Operator can import and verify a certificate object.
- Operator can configure accounting consent and commitment.
- Operator can preview allowed report fields.
- Operator can see last accounting replication status.

### Non-Functional

- Documentation clearly states trust and data boundaries.
- Sensitive values are not committed to repo files.
- Runtime state is typed and recipe-backed where persistent.
- Tests cover recipe registration, object construction, certificate state transitions, and accounting minimization.
- UI distinguishes operational status from trust evidence.

## Future Requirements

- Full certificate submission flow to a live `projektor.one` CA.
- Multi-project bulk deployment dashboard.
- Hetzner deployment automation.
- Hardware-backed key storage.
- Offline certificate request package import/export.
- CLI parity for server operators.
- Audit export for procurement reviewers.
- Signed public service identity publication under `projektor.one/downloads`.
- Runtime migration and disaster recovery workflows.
- Role-specific admin delegation.

## Acceptance Criteria

- A new user can understand that `admin.cube` is a local privileged admin app, not a project collaboration UI.
- A project runtime can be represented without storing private admin keys in server configuration.
- A headless runtime can be paired and identified through CHUM evidence, not HTTP status alone.
- Certificate states are visible and explainable.
- Accounting sharing cannot be enabled without explicit consent and commitment.
- Accounting reports exclude project content and personal directory data by design.
- `refinio.one` receives only signed, minimized accounting reports.
- The docs explain how `admin.cube`, `projektor.headless`, `projektor.one`, `projektor.browser`, `projektor.cube`, and `refinio.one` relate.
- The implementation plan can proceed from the PRD without needing to resolve basic product boundaries again.

## Open Questions

- Should `projektor.one` CA live in this repo initially or in a sibling authority repo?
- Should the first `projektor.headless` target be local-only, Hetzner, or both?
- Which accounting fields are required for the first procurement/reporting use case?
- Which fields may identify a project by name, and under what explicit consent?
- What is the first production-grade vault implementation on macOS, Windows, and Linux?
- Should admin recovery use mnemonic material, encrypted export bundles, Fotos ID proof, or a combination?
- How much of the `42.cube` signing UX can be reused directly before Projektor-specific refactoring?
- Does `projektor.browser` pair directly with each project runtime, or can `admin.cube` provision a client bootstrap bundle?
- What is the first supported CommServer topology for project deployments?
- What evidence does `refinio.one` need to accept accounting reports without seeing private project state?
