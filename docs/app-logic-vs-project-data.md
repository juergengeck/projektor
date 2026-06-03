# App Logic vs Project Data

`projektor.one` should treat the application as a reusable local-first runtime, domain-specific packages as reusable cores, and each project as data interpreted by those cores.

## Boundary

App logic is everything that should survive swapping `Demo: Kita 2028` for another project:

- routing, onboarding, theme, language and rendering
- import/export envelope handling
- ONE package wiring through `one.core` and `one.models`
- state-DAG planning through `planner.core`
- dirty update composition through `updater.core`
- generic project operations such as schedule validation, CPM calculation and projection
- git-backed project-file source normalization, tracked-file indexing and export summaries

Project data is everything that belongs to one active project graph:

- localized project title, subtitle, phase and risk labels
- project roles, role copy and visible trie roots
- task ids, durations, owners, HOAI phase references and dependencies
- mailbox metadata, git source metadata, file-index rows, import preview rows and journal entries

Rule of thumb: if changing from Kita 2028 to a hospital renovation requires editing source code, the thing being edited is probably project data and should move into the active project graph.

Domain core is everything that is neither app chrome nor a single project:

- `HOAI.core` owns HOAI phases, cross-cutting topics and workflow templates.
- `project.core` owns project schedule validation, CPM calculation and planner/updater adapters.
- `table.core` owns reusable Excel-compatible projections over planner/updater state-DAG outputs.
- `project-source.core` owns prototype `source.git`-shaped project file sources, repository-relative file indexes, ignored runtime paths and export summaries.
- `planner.core`, `updater.core`, `one.core` and `one.models` stay in `../one` and are consumed directly by the browser bundle.

## Current Implementation

The schedule split is now explicit:

- [packages/project.core/index.js](/Users/gecko/src/projektor/packages/project.core/index.js) owns reusable scheduling behavior and delegates state-DAG semantics to `../one/packages/planner.core` and `../one/packages/updater.core`.
- [packages/table.core/index.js](/Users/gecko/src/projektor/packages/table.core/index.js) owns Excel-compatible sheet projections for project progress, DAG edges, planner steps, workload scope, responsibilities and participants.
- [packages/project-source.core/index.js](/Users/gecko/src/projektor/packages/project-source.core/index.js) owns the local `ProjectGitSource` and `ProjectFileIndex` surface that keeps git responsible for file bytes, diffs and history while project objects carry roles, approvals and provenance.
- [scripts/project-source-from-git.mjs](/Users/gecko/src/projektor/scripts/project-source-from-git.mjs) is the read-only Node bridge that calls VGER's `@refinio/source.git` service and adapts live discovery, tracked inventory and dirty worktree state into that Projektor source surface.
- [hoai.core.js](/Users/gecko/src/projektor/hoai.core.js) owns reusable HOAI phases, cross-cutting topics and flow templates.
- [demo-kita-2028.project.js](/Users/gecko/src/projektor/demo-kita-2028.project.js) owns the Kita-specific schedule graph and a boundary manifest used by the UI.
- [app.js](/Users/gecko/src/projektor/app.js) loads the active project schedule, asks `project.core` for the planner/updater-backed schedule update, and renders the result.
- [deploy.sh](/Users/gecko/src/projektor/deploy.sh) bundles the app with `esbuild`, so browser deployment can consume platform-agnostic `../one` packages.

This keeps HOAI definitions, CPM and dirty graph orchestration reusable while the actual task graph remains project-specific data.

## Target Shape

The next durable shape is a typed ONE project graph:

```txt
Project
ProjectRole
ProjectTrieRoot
ProjectPhase
ProjectFlow
ProjectTask
ProjectDependency
ProjectMailSource
ProjectGitSource
ProjectFileIndex
ProjectJournalEntry
```

`HOAI.core` should provide creators, validation and recipe exports for HOAI phase and flow-template objects. `project.core` should provide creators, validation, planner/updater adapters and recipe exports for project objects. The app should load the active project through ONE/model APIs and render projections. Demo fixtures should only bootstrap an empty local instance or provide sample import data.

Git remains the file substrate in that target shape. VGER/source.git is the live provider for repository discovery, dirty snapshots, branch/worktree preparation and tracked-file inventory; Projektor should not grow a parallel custom versioning system.

## Migration Order

1. Move remaining Kita-specific arrays from `app.js` into `demo-kita-2028.project.js`.
2. Add typed HOAI object creators and recipes in `HOAI.core`.
3. Add typed project object creators in `project.core`.
4. Replace the static `ProjectGitSource` / `ProjectFileIndex` fixture with a VGER `source.git` provider call.
5. Register HOAI/project/source recipes with the same complete ONE runtime recipe aggregate used by the app.
6. Replace localStorage project persistence with ONE object storage/model APIs.
7. Keep `app.js` as orchestration and rendering only.
