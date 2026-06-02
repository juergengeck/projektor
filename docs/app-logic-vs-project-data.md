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

Project data is everything that belongs to one active project graph:

- localized project title, subtitle, phase and risk labels
- project roles, role copy and visible trie roots
- task ids, durations, owners, HOAI phase references and dependencies
- mailbox metadata, import preview rows and journal entries

Rule of thumb: if changing from Kita 2028 to a hospital renovation requires editing source code, the thing being edited is probably project data and should move into the active project graph.

Domain core is everything that is neither app chrome nor a single project:

- `HOAI.core` owns HOAI phases, cross-cutting topics and workflow templates.
- `project.core` owns project schedule validation, CPM calculation and planner/updater adapters.
- `planner.core`, `updater.core`, `one.core` and `one.models` stay in `../one` and are consumed directly by the browser bundle.

## Current Implementation

The schedule split is now explicit:

- [project.core.js](/Users/gecko/src/projektor/project.core.js) owns reusable scheduling behavior and delegates state-DAG semantics to `../one/packages/planner.core` and `../one/packages/updater.core`.
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
ProjectJournalEntry
```

`HOAI.core` should provide creators, validation and recipe exports for HOAI phase and flow-template objects. `project.core` should provide creators, validation, planner/updater adapters and recipe exports for project objects. The app should load the active project through ONE/model APIs and render projections. Demo fixtures should only bootstrap an empty local instance or provide sample import data.

## Migration Order

1. Move remaining Kita-specific arrays from `app.js` into `demo-kita-2028.project.js`.
2. Add typed HOAI object creators and recipes in `HOAI.core`.
3. Add typed project object creators in `project.core`.
4. Register HOAI/project recipes with the same complete ONE runtime recipe aggregate used by the app.
5. Replace localStorage project persistence with ONE object storage/model APIs.
6. Keep `app.js` as orchestration and rendering only.
