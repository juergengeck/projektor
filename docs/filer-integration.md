# Projektor and Filer

## Implemented: folders and documents

Projektor owns the document graph and publication decisions. Filer projects it through the existing authenticated `refinio.api` File Provider RPC protocol. This follows Flexibel's domain-owned read projection; it does not copy Flexibel's experimental ONE runtime into Projektor.

The local account server on port 4175 composes inventory and project documents in the same ONE instance. `ProjectDocumentCatalog` belongs to the authenticated canonical Person and points to stable `ProjectDocumentCollection` ids. Each collection identifies a project and references exact immutable `ProjectSourceArtifact` objects. Those artifacts retain native BLOB references and Git provenance. Enumeration follows these explicit roots, without storage scans or a second document database.

`ProjectDocumentsPlan` exposes `getSnapshot`, `getProject`, `createProject`, `importDocument`, and `removeDocument` through OperationRegistry. Writes require the current catalog or collection version and are serialized within the owning local plan. Importing a newer document at the same path publishes its new exact artifact; previous artifacts remain in native history. Removal unpublishes the reference rather than erasing that history.

The filesystem is:

```text
/Projekte/
  Kita 2028 Demo [stable collection id]/
    Dokumente/
      README.md
      demo-kita-2028.project.js
```

Source subdirectories are retained. Names escape forbidden characters reversibly; ambiguous case, Unicode normalization, and file/directory collisions are rejected before publication. Metadata supplies exact content and artifact hashes to Filer. Reads recheck current collection membership, source/project ownership, and artifact byte length. Filer writes are rejected before the RPC adapter can store an uploaded BLOB.

The current authority scope is the unlocked local owner. This slice does not implement peer sharing, role credentials, CHUM delivery, or separate Filer identity enrollment. Those must use Projektor's trust owner and stable collection-root grants, following the Filer domain-sharing architecture.

## Run the local demo

Build the canonical shared `one.core`, `supply.core`, and `refinio.api` packages before starting. The ONE.core buffer-range fix is required for exact binary imports; it is covered by native buffer tests and the document RPC test.

Create a dedicated random Filer token file of at least 32 characters with filesystem mode 0600, outside the repository. This is separate from the account password. Start the existing local server:

```bash
PROJEKTOR_FILER_TOKEN_FILE=/absolute/path/to/filer-token npm run inventory:start
```

To populate demo documents, run `npm run filer:demo` before opening the account in the browser. This explicitly unlocks `demo@inventory.example` with `Inventory-Demo-2026`, then imports the committed README and demo project file with the actual HEAD revision. It leaves existing inventory records intact. Restart the server afterward and unlock that same account in the browser; the current local server permits one unlock per process. The document panel lists authenticated download links.

Filer endpoint: `http://127.0.0.1:4175/filer/rpc`. Native calls use `Authorization: Bearer <dedicated token>`; browser session cookies alone do not authorize Filer. Cross-origin browser calls are rejected. Before unlock, native requests are denied.

A current RPC-capable OneFiler host can register this endpoint and token in its Register Domain flow. The installed app inspected on September 5 predates that host's RPC registration interface; this change does not replace it or alter its existing domains. The source Swift bridge was tested against the live demo endpoint. Native Finder domain registration remains unverified.

## Validation

```bash
npm run test:filer
npm run test:inventory
node packages/project-source.core/ingestion.test.js
PROJEKTOR_FILER_TOKEN_FILE=/absolute/path/to/filer-token node scripts/test-filer-native.mjs
```

The final command runs Filer's `ReadOnlyDomainRpcTests` against the unlocked demo. It verifies directory enumeration, read-only permissions, file size, and SHA-256 equality of downloaded bytes. The Node integration test additionally covers authentication, cross-project access rejection, stale/concurrent imports, path collisions, chunks, authenticated browser downloads, unpublication, and persistence across restart.

## Next: notifications and editable spreadsheets

Both folders/documents and editable spreadsheets are the intended integration. This implementation delivers the first domain projection. The following work remains:

1. Finish the shared native delivery boundary: install/register the current host, publish semantic collection-change events into Filer's change-anchor/enumerator mechanism, and test additions, replacements, and removals in Finder. The current shared RPC `getChanges` still returns an empty result with anchor `0`; on-demand RPC reads are current, but automatic Finder refresh is not implemented.
2. Define a managed project workbook owned by Projektor with stable project/root ids, schema version, exact base-version references, and explicit editable ranges. Start with a selected domain view rather than exposing arbitrary storage fields. Inventory counts must remain observations; stock totals must not become editable balances.
3. Implement complete Excel save staging in the shared Filer owner, including temporary files, replace/rename, complete-file detection, and abandonment. Route a validated complete workbook to a Projektor plan. Preserve the submitted BLOB and typed import outcome as evidence, check current authority and expected versions, and reject conflicts without overwriting newer data.
4. Validate Excel open/edit/save/reopen with a demo account, concurrent updates, malformed workbooks, interrupted saves, and revoked access. Only then advertise spreadsheet write capabilities in Filer.

The reference is Filer's `specs/002-flexibel-xlsx-roundtrip`, which is still planned rather than an existing implementation to reuse. Shared save mechanics belong in `../one` / Filer; workbook semantics and conditional domain mutations belong in Projektor.
