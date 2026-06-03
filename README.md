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
- `@refinio/source.git` patterns from `../vger` for git source discovery, tracked-file inventory, dirty snapshots, and governed worktrees
- `@refinio/trust.core` for trust relationships, role evidence, revocation and verification
- `@refinio/calendar.core` and `@refinio/chat.core` for calendar/chat primitives
- `@refinio/refinio.api` for ModuleRegistry demand/supply and public operation registration

This is not a live ONE.core runtime yet. The current code intentionally keeps the object names, identity hints, trie roots, sharing policy, and AI lifecycle visible so the next step can turn the prototype vocabulary into recipes and registered runtime surfaces.

## Project Files

Git should manage project-file bytes, revisions, diffs, branches and isolated worktrees. Projektor project objects should manage meaning: roles, document provenance, approvals, journal events, AI workloads and access policy.

The current prototype models that boundary in `packages/project-source.core`. Demo `.project.json` exports now include a `ProjectGitSource` plus `ProjectFileIndex`, while generated bundles still avoid secrets, build output, local caches and runtime folders.

Preview the live git-backed source surface for this repo:

```bash
npm run source:git
```

That read-only bridge calls `../vger/packages/source.git` and adapts its discovery, tracked inventory and dirty worktree snapshot into Projektor's `ProjectGitSource` / `ProjectFileIndex` shape.

## projektor.cube Test Runner Home

`projektor.cube` is represented in `Settings` as the integrated trie test runner home. It opens architecture roles in separate browser windows and lets them exchange project updates through shared trie-root events. The current static prototype uses browser storage events as a stand-in for real trie/CHUM propagation; the product model is trust/context filtered trie sharing.

## Product Docs

- [Onboarding MRD](./docs/projektor-onboarding-mrd.md)
- [Onboarding PRD](./docs/projektor-onboarding-prd.md)
- [admin.cube PRD](./docs/projektor-admin-cube-prd.md)
