import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import "../../one/packages/one.core/lib/system/load-nodejs.js";
import { closeInstance, initInstance } from "../../one/packages/one.core/lib/instance.js";
import { ProjectSourceCoreRecipes } from "../packages/project-source.core/index.js";
import {
  ingestProjectFileFromGitSource,
  loadProjectSourceBundle,
} from "./project-source-from-git.mjs";

const repoRoot = await mkdtemp(path.join(tmpdir(), "projektor-source-git-"));
const storageRoot = await mkdtemp(path.join(tmpdir(), "projektor-source-git-storage-"));
const trackedPath = path.join(repoRoot, "project.txt");
const originalContent = "original project data\n";
const changedContent = "current project data\n";
let initialized = false;

try {
  execFileSync("git", ["init", "--quiet", repoRoot]);
  execFileSync("git", ["-C", repoRoot, "config", "user.email", "projektor-test@example.invalid"]);
  execFileSync("git", ["-C", repoRoot, "config", "user.name", "Projektor Test"]);
  await writeFile(trackedPath, originalContent);
  execFileSync("git", ["-C", repoRoot, "add", "project.txt"]);
  execFileSync("git", ["-C", repoRoot, "commit", "--quiet", "-m", "fixture"]);
  await writeFile(trackedPath, changedContent);

  const bundle = await loadProjectSourceBundle({
    projectId: "source-git-test",
    repoRoot,
    capturedAt: 1787097600000,
  });
  const file = bundle.index.files.find((candidate) => candidate.path === "project.txt");
  assert.equal(bundle.source.adapter, "source.git");
  assert.equal(bundle.index.status, "dirty");
  assert.equal(file.status, "modified");
  assert.equal(file.blob, undefined);
  assert.ok(file.sourceEntryId);

  await assert.rejects(
    ingestProjectFileFromGitSource({
      bundle,
      repoRoot,
      filePath: "../outside.txt",
      ingestedAt: 1787097600000,
      ingestedBy: "person:projektleitung@example.invalid",
    }),
    /repository-relative/,
  );

  await initInstance({
    name: "projektor-source-git-test",
    email: "projektor-source-git-test@example.invalid",
    secret: "projektor-source-git-test-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory: storageRoot,
    initialRecipes: ProjectSourceCoreRecipes,
  });
  initialized = true;
  const ingested = await ingestProjectFileFromGitSource({
    bundle,
    repoRoot,
    filePath: "project.txt",
    ingestedAt: 1787097600000,
    ingestedBy: "person:projektleitung@example.invalid",
    mediaType: "text/plain",
  });
  const expectedSha256 = createHash("sha256").update(changedContent).digest("hex");
  assert.equal(ingested.blobHash, expectedSha256);
  assert.equal(ingested.artifact.blob, expectedSha256);
  assert.equal(ingested.artifact.path, "project.txt");
  assert.equal(ingested.artifact.revision, `working-tree:${bundle.index.head}`);
  assert.equal(ingested.artifact.sourceEntryId, file.sourceEntryId);
} finally {
  if (initialized) closeInstance();
  await rm(repoRoot, { recursive: true, force: true });
  await rm(storageRoot, { recursive: true, force: true });
}
