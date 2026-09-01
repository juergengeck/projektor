# Questionnaire Creator with Projektor PRD

## Objective

Create a questionnaire builder inside `projektor.one` that lets a project owner design, validate, preview, translate, and publish questionnaires as FHIR-style `Questionnaire` objects compatible with `@refinio/one.models` `QuestionnaireModel`. The reference consumer is `heyfreeda` (`../heyfreeda`), whose needs-assessment flow renders exactly this format. What the builder produces must run unchanged in heyfreeda's `QuestionnaireFlow` and in any other ONE-based questionnaire renderer.

The product goal is to turn questionnaires from hand-written TypeScript files (today: `heyfreeda/src/questionnaires/NeedsAssessment.{de,en,ne}.ts`) into first-class project content that non-developers can author in Projektor. Along the way, the builder work is the vehicle for streamlining the Projektor UI: every surface the builder touches (navigation, forms, empty states, i18n) is brought up to a consistent UX baseline.

## Product Context

Projektor is local-first project software built as a static browser prototype (`index.html`, `app.js`, `styles.css`) plus dependency-free core packages under `packages/*.core` (plain ES modules with `node` test files, no build step, no frameworks). Questionnaires are a recurring project need: needs assessments, stakeholder feedback, market validation, pilot-readiness checks. The Projektor market-validation flow already states that "the questionnaire collects prioritized feedback on pain, costs, integrations, pilot readiness and data protection" — but Projektor has no way to author such a questionnaire.

heyfreeda demonstrates the consumption side: a Vite/React app that renders `Questionnaire` objects from `@refinio/one.models` with question components for `group`, `display`, `string`, `integer`, `date`, `choice`, `open-choice`, and `slider` items, including `answerOption` entries with `valueCoding` (`system`, `version`, `code`, `display`), `enableWhen` conditions, and per-language questionnaire variants identified by `url` + `language`.

Development runs through the VGER agent loop on the DGX Spark: repos are loaded into `vger.headless` as git sources (`/data/workspaces/{projektor,heyfreeda,vger}`), a development workspace agent backed by the Codex CLI executes autoresearch experiments, and a read-only benchmark harness (`/data/workspaces/benchmarks/questionnaire-builder-benchmark.mjs`) defines the machine-checkable contract for `packages/questionnaire.core`.

## Users

### Primary Users

- Project owners and consultants who author questionnaires for needs assessments, market validation, and stakeholder feedback without writing code.
- Developers of ONE-based apps (heyfreeda and successors) who consume exported questionnaires and need format fidelity.

### Secondary Users

- Translators who maintain language variants of an existing questionnaire.
- Respondents who ultimately fill out the questionnaires in consuming apps; they never see the builder but define its quality bar (clear question types, working conditional logic).
- Data-protection reviewers who need to see what a questionnaire collects before it goes to respondents.

## Jobs To Be Done

- As a project owner, I can create a questionnaire from scratch or import a compatible external FHIR Questionnaire representation, organize items into groups, and reorder them.
- As a project owner, I can choose the right question type (`group`, `display`, `string`, `integer`, `date`, `choice`, `open-choice`, `slider`) and configure its options, including coded answers with `system`/`version`/`code`/`display`.
- As a project owner, I can make questions conditional with `enableWhen` and see the conditions work in a live preview.
- As a project owner, I can validate a questionnaire and get actionable errors (duplicate `linkId`, choice without options, broken `enableWhen` references) before publishing.
- As a translator, I can create a language variant that shares structure and codings with the source language and only edits display text.
- As a developer, I can project a questionnaire to the external FHIR JSON representation heyfreeda accepts and ingest heyfreeda's existing `NeedsAssessment` representations losslessly at that boundary.

## Principles

- Native objects internally, format fidelity at the boundary. The authoritative
  questionnaire is a typed, recipe-backed ONE object graph. The compatibility
  adapter emits exactly the `@refinio/one.models` `QuestionnaireModel` subset
  heyfreeda consumes. JSON is an external FHIR transport projection, never
  Projektor storage, backup, or internal interchange.
- Root cause over fallback. Validation throws with precise errors; there is no "best effort" serialization of an invalid questionnaire.
- Core logic is platform-agnostic. All create/validate/serialize/import logic lives in `packages/questionnaire.core` as a dependency-free ES module with full node test coverage. The UI is a thin layer over it.
- Follow the house prototype architecture. No frameworks, no build-step changes, existing i18n (de/en/fr) and styling conventions of `app.js`/`styles.css`.
- Improve what you touch. Builder work doubles as the UX streamlining pass: consistent navigation, clear empty states, keyboard-friendly forms, and consistent terminology across the Projektor views it integrates with.
- Agent-verifiable progress. The questionnaire.core contract is encoded in a read-only autoresearch benchmark harness; the VGER/Codex loop must be able to prove progress mechanically.

## Scope

### In Scope (v1)

- `packages/questionnaire.core`: pure ES module exporting typed questionnaire
  and item recipes, their aggregate recipe list, constructors and validation,
  plus explicit FHIR boundary adapters. The adapter may serialize and parse the
  external JSON representation; domain operations consume the typed object
  graph, never serialized JSON.
- Questionnaire Builder view in the Projektor UI: item palette, structure tree with add/edit/reorder/delete for items and groups, properties panel per item type, validation feedback inline.
- Live preview that renders all v1 item types and honors `enableWhen`, mirroring heyfreeda's rendering semantics.
- FHIR-compatible import/export projection, including lossless boundary
  round-trip of heyfreeda's `NeedsAssessment` questionnaires (de/en/ne), without
  making the serialized JSON authoritative.
- Language variants: duplicate a questionnaire into a new `language` with shared structure and codings, editable display text.
- UX streamlining of touched Projektor surfaces (navigation entry, form patterns, empty states, i18n strings in de/en/fr).

### Out of Scope (v1)

- Response collection, storage, or analysis (consuming apps own this; heyfreeda has `sendResults`).
- CHUM sharing and signing of questionnaires. Native recipe registration and
  ONE.core persistence are part of v1 because otherwise JSON becomes the de
  facto internal model.
- FHIR features heyfreeda does not consume (scoring extensions, adaptive forms, full ValueSet machinery).
- WYSIWYG theming of the respondent experience.

## Architecture

- `packages/questionnaire.core` owns typed recipes, constructors, mutation
  helpers, validation, and FHIR boundary projection. Recipes are registered
  before storage; logical questionnaire identities use `referenceToId`, exact
  item/content versions use `referenceToObj`, and serialized JSON never enters
  the internal operation surface.
- `app.js` gains a `questionnaire-builder` view wired into the existing navigation and i18n blocks (de/en/fr). State handling follows the existing prototype patterns; no framework is introduced.
- Preview rendering implements the same item-type semantics as heyfreeda's `src/components/questions/*` (one component-equivalent per item type, `QuestionRenderer` dispatch logic as the behavioral reference).
- The heyfreeda repo remains the compatibility oracle: its
  `NeedsAssessment.{de,en,ne}.ts` values are boundary fixtures for projection
  tests, not stored Projektor fixtures.
- Agent workflow: changes land through autoresearch experiments on the Spark (`workspaceRoot=/data/workspaces/projektor`, planner `codex-cli`, mode `patch`), with the read-only harness as `benchmarkCommands` and `npm test` as `testCommands`. The harness defines the floor of the contract; `index.test.js` extends beyond it.

## Acceptance Criteria

- The benchmark harness reports `status: pass` (all contract assertions green) against `packages/questionnaire.core`.
- `npm test` passes, including `packages/questionnaire.core/index.test.js`, which covers building, validating, and round-tripping a NeedsAssessment-shaped questionnaire.
- Projecting heyfreeda's `NeedsAssessment` (de) into typed questionnaire objects
  and back to its external representation is deep-equal at the compatibility
  boundary.
- The Questionnaire Builder view is reachable from Projektor navigation in all three UI languages, supports add/edit/reorder/delete of items and groups, shows live preview for every v1 item type, and surfaces validation errors inline.
- An exported questionnaire pasted into heyfreeda's questionnaire registry renders and completes without code changes to heyfreeda's components.
- No regressions in existing Projektor tests; no new dependencies; no build-step changes.

## Milestones

1. **Format core.** `questionnaire.core` passes the benchmark harness and its own tests; heyfreeda fixtures round-trip. (Runs as autoresearch experiment `projektor-questionnaire-builder-v2`.)
2. **Builder UI.** Structure editing, properties panels, validation surfacing, i18n, navigation integration.
3. **Preview + variants.** Live preview with `enableWhen`, language-variant workflow, import/export polish.
4. **UX streamlining pass.** Consolidate navigation/forms/empty states touched by the builder across Projektor; document patterns in `docs/`.
5. **heyfreeda validation.** End-to-end check: author in Projektor, render in heyfreeda; capture findings as follow-up issues in both repos.

## Risks

- Format drift between heyfreeda's vendored `QuestionnaireModel` expectations and the builder's output. Mitigation: fixtures generated from heyfreeda source files, deep-equal round-trip tests.
- The prototype's single-file `app.js` grows unwieldy with a complex builder view. Mitigation: keep all logic in `questionnaire.core`; the view layer stays declarative and thin; consider splitting `app.js` per-view only if the existing convention allows.
- `enableWhen` semantics diverging between preview and heyfreeda rendering. Mitigation: treat heyfreeda's `QuestionRenderer` behavior as the specification and encode it in core tests, not in UI code.
- Agent-loop limitations (patch-mode planner, benchmark scope) under-specifying UI quality. Mitigation: harness covers the core contract only; UI milestones are reviewed by humans with explicit acceptance criteria above.
