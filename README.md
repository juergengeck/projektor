# projektor.one Prototype

This folder contains a static browser prototype for `projektor.one`, based on:

- `STEERINGone_20260525_V001.pdf`
- `flexibel-rollenflows-patient-arzt-studienzentrum.pptx`
- the role, trust, trie-sharing, and journal patterns from `../one`
- the goal-first AI run model from `../vger` and `@refinio/coding.core`
- the reusable runtime/package owners in `../one` whenever they already cover the primitive

## Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Headless HTTP And MCP Service Offering

Projektor has a VGER-style local HTTP wrapper for the public operation surface:

```bash
node scripts/projektor-http-server.mjs
```

It serves:

- `GET /health`
- `GET /api`
- `GET /api/status`
- `GET /.well-known/projektor`
- `POST /api/:operation/:method`

The wrapper registers an outbound `mcp` operation. Use `mcp.createSupply` to offer
Projektor tools to a topic, `mcp.handleDemand` to issue a credential for a peer,
and `mcp.handleRequest` to execute credentialed `operation:plan:method` tool
requests with audit entries.

## Deploy

Build a clean static bundle:

```bash
npm run build
```

Deploy to Cloudflare Pages project `projektor-one`:

```bash
npm run deploy
```

## Prototype Intent

The app models project management software for architecture offices first. The current seeded dataset uses a municipal Kita build only as an example from the source docs:

- project cockpit for communication, documents, and decisions
- role certificates with trust/context filtered trie sharing
- HOAI phase tracking with cross-cutting topics
- VGER-style AI surface with `ProjectGoal`, `ProjectPreparedWorkload`, and `ProjectAIRun`
- ONE-style journal events with object references
- `settings.core`-style management surface for UI theme and project-scoped source settings
- `source.mail` / `@refinio/source.imap` IMAP account configuration with password/token represented as a `SecretsPlan` reference
- `source.git`-shaped project-file surfaces for repository history, tracked paths, ignored runtime paths, and later VGER-governed detached worktrees
- Flexibel-inspired data import/export section with template CSV, preview/warnings, project export bundle, and source-mail/settings/journal sections
- UI language support for German, English, French, and Spanish via the `UISettings.language` preference
- first-run onboarding that explains the web-as-app-store model, local-only browser data, optional local password protection, email-as-identity, and procurement usage-statistics consent

## ../one Reuse Rule

When a primitive already exists in `../one`, `projektor.one` should consume it rather than recreate it:

- `@refinio/one.core` for recipes, content-addressed objects, access and storage
- `@refinio/trie.core` and ONE.core trie traversal for shared project memory
- `@refinio/one.models` only where runtime models, Leute/contact model or MultiUser wiring are still the owning API
- `@refinio/settings.core` for `UISettings`, `SettingsPlan` and `SecretsPlan`
- `@refinio/source.core` for `Source`, `SourceEntry`, `SourceRun`, `Book` and provenance contracts
- `@refinio/source.git` from `../one` for git source discovery, tracked-file inventory, dirty snapshots, and governed worktrees
- `@refinio/trust.core` for typed attestation, exact signature/key verification,
  issuer-key lifecycle evidence, trust relationships and role evidence
- `@refinio/calendar.core` and `@refinio/chat.core` for calendar/chat primitives
- `@refinio/refinio.api` for ModuleRegistry demand/supply and public operation registration

The source-ingestion slice now runs against a live ONE.core instance: it registers typed source recipes, stores ingested bytes as SHA-256-addressed BLOBs, and stores immutable `ProjectSourceArtifact` objects that reference those BLOBs. Other visible prototype surfaces are not implied to have the same runtime integration; support is asserted per documented, executable flow.

Group sharing follows the same ownership rule. `packages/group.core` reads
ONE.core `Group`/`HashGroup` history only. `packages/trust.projektor` owns the
membership, disclosure, project-access and dispute semantics, while consuming
the narrow typed-attestation service from `../one/packages/trust.core`. Neither
package stands up `LeuteModel`; an application that already owns an
authenticated identity graph supplies its trust.core dependencies at runtime.

## Project Files

Git should manage project-file bytes, revisions, diffs, branches and isolated worktrees. Projektor project objects should manage meaning: roles, document provenance, approvals, journal events, AI workloads and access policy.

The current implementation models that boundary in `packages/project-source.core`. `ProjectGitSource` and `ProjectSourceArtifact` are registered ONE objects. An artifact references its source by ID and its immutable bytes with a native `referenceToBlob`; `ProjectFileIndex` is only a read-model projection and is not registered as authoritative storage. Project interchange is not a JSON bundle.

Preview the live git-backed source surface for this repo:

```bash
npm run source:git
```

That read-only command calls `../one/packages/source.git` and adapts its discovery, tracked inventory and dirty worktree snapshot into Projektor's source projection. The tested ingestion adapter `ingestProjectFileFromGitSource` then reads a selected repository file, enforces the repository boundary, writes the bytes through ONE.core, and persists its typed provenance object. Inventory never presents Git object IDs or merely observed digests as stored BLOB references.

The owning runtime initializes ONE.core with `ProjectSourceCoreRecipes` before calling the adapter and supplies explicit `ingestedAt` and `ingestedBy` provenance. The adapter returns the source ID hash, exact artifact hash, and BLOB hash; `readProjectSourceArtifact` resolves the typed artifact, source identity, and original bytes without a JSON storage or interchange envelope.

## projektor.cube Test Runner Home

`projektor.cube` is represented in `Settings` as the integrated trie test runner home. It opens architecture roles in separate browser windows and lets them exchange project updates through shared trie-root events. The current static prototype uses browser storage events as a stand-in for real trie/CHUM propagation; the product model is trust/context filtered trie sharing.

## Product Docs

- [Product MRD](./docs/projektor-mrd.md)
- [Onboarding MRD](./docs/projektor-onboarding-mrd.md)
- [Onboarding PRD](./docs/projektor-onboarding-prd.md)
- [admin.cube PRD](./docs/projektor-admin-cube-prd.md)
