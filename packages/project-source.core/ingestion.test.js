import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import "../../../one/packages/one.core/lib/system/load-nodejs.js";
import {
  closeInstance,
  initInstance,
} from "../../../one/packages/one.core/lib/instance.js";
import { storeUnversionedObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {
  ProjectSourceCoreRecipes,
  ingestProjectSourceArtifact,
  readProjectSourceArtifact,
} from "./index.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-ingestion-"));
let initialized = false;

try {
  await initInstance({
    name: "projektor-ingestion-test",
    email: "projektor-ingestion-test@example.invalid",
    secret: "projektor-ingestion-test-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
    initialRecipes: ProjectSourceCoreRecipes,
  });
  initialized = true;

  const bytes = new TextEncoder().encode("real project artifact bytes\n");
  const expectedBlobHash = createHash("sha256").update(bytes).digest("hex");
  const source = {
    projectId: "source-ingestion-test",
    repoUrl: "file:///tmp/source-ingestion-test",
    defaultBranch: "main",
  };
  const first = await ingestProjectSourceArtifact({
    source,
    bytes,
    path: "evidence/decision.txt",
    revision: "commit:9f73c3c",
    mediaType: "text/plain",
    sourceEntryId: "source-entry:decision",
    sourceModifiedAt: 1787097500000,
    ingestedAt: 1787097600000,
    ingestedBy: "person:projektleitung@example.invalid",
  });

  assert.equal(first.blobHash, expectedBlobHash);
  assert.equal(first.artifact.blob, expectedBlobHash);
  assert.equal(first.artifact.byteLength, bytes.byteLength);
  assert.match(first.artifactHash, /^[a-f0-9]{64}$/);
  assert.match(first.sourceIdHash, /^[a-f0-9]{64}$/);

  const stored = await readProjectSourceArtifact(first.artifactHash);
  assert.deepEqual(stored.bytes, bytes);
  assert.equal(stored.artifact.blob, expectedBlobHash);
  assert.equal(stored.artifact.source, first.sourceIdHash);
  assert.equal(stored.source.sourceId, first.source.sourceId);

  const second = await ingestProjectSourceArtifact({
    source,
    bytes,
    path: "evidence/decision-copy.txt",
    revision: "commit:9f73c3c",
    ingestedAt: 1787097601000,
    ingestedBy: "person:projektleitung@example.invalid",
  });
  assert.equal(second.blobHash, first.blobHash);
  assert.notEqual(second.artifactHash, first.artifactHash);

  await assert.rejects(
    storeUnversionedObject({
      ...first.artifact,
      blob: "not-a-sha256-reference",
    }),
    /hash|referenceToBlob/i,
  );
} finally {
  if (initialized) closeInstance();
  await rm(directory, { recursive: true, force: true });
}
