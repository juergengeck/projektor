# Content Editor Integration

Projektor should use Reaktor and VGER as content-creation editors without
learning their runtime internals.

## Boundary

Projektor owns project workflow projections:

- which project artifact is needed next
- which phase and source path the artifact belongs to
- which editor capability can handle the artifact
- what handoff should be visible to the architect

Projektor must not own editor runtime state, outline storage, VGER TXT document
graphs, AI drafting loops, or platform boot code.

## Common Module

[editor.core](/Users/gecko/src/one/packages/editor.core/src/index.ts) is the
shared, platform-agnostic contract:

- `ContentEditorDescriptor` describes an editor capability.
- `ContentCreationIntent` selects editors by content type and capability.
- `EditorHandoff` is the project-to-editor transfer envelope.
- `summarizeEditorAlignment` exposes which reusable core packages must converge.
- `EditorRegistration` is the durable ONE object for editor capability
  discovery, exported through `EditorCoreRecipes`.

The module is pure TypeScript and has no browser, React, Electron, IndexedDB,
ONE platform-loader, or app imports.

## Editor Alignment

Reaktor should be the structured-outline editor:

- canonical outline/tree editing lives in `@reaktor/reaktor.core`
- browser UI stays in `@reaktor/reaktor.browser`
- the duplicate VGER-local `packages/reaktor.core` should be removed once VGER
  consumes the same package through the workspace

VGER should be the source-backed document editor:

- document/book authoring semantics live in `@refinio/txt.core` under
  `../one/packages/txt.core`
- shared React surfaces live in `@vger/vger.txt.ui`
- document extraction lives in `@refinio/source.documents` under
  `../one/packages/source.documents`

Projektor consumes both through
[content-editors.project.js](/Users/gecko/src/projektor/content-editors.project.js)
and renders only project-facing handoffs. The concrete descriptors are now owned
by the editor providers:

- [REAKTOR_CONTENT_EDITOR](/Users/gecko/src/reaktor/reaktor.core/src/editorDescriptor.ts)
- [VGER_TXT_CONTENT_EDITOR](/Users/gecko/src/one/packages/vger.txt.ui/src/editorDescriptor.ts)

## Migration Order

1. Keep `editor.core` in `../one/packages` as the stable capability contract.
2. Keep VGER UI/compiler/runtime seams pointed at the built
   `../one/packages/txt.core/dist` and
   `../one/packages/source.documents/dist` package surfaces.
3. Remove or archive the VGER-local `packages/txt.core` and
   `packages/source.documents` copies; the browser, HTML, Cube, and glue
   runtime aliases now resolve through the sibling `../one` workspace.
4. Point VGER at the canonical Reaktor package instead of the local duplicate.
5. Replace static provider descriptors with live editor registration objects
   once the apps expose them through ONE/model state.

The UI should continue to say things like "LP3 decision template" and
"Genehmigungsmappe"; package names belong in tests, docs, and module wiring.
