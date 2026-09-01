import assert from "node:assert/strict";
import {
  PROJECT_FILE_INDEX_TYPE,
  PROJECT_GIT_SOURCE_TYPE,
  PROJECT_SOURCE_ARTIFACT_TYPE,
  ProjectSourceCoreRecipes,
  createProjectSourceArtifact,
  createProjectFileIndex,
  createProjectGitSource,
  createProjectSourceBundleFromGitSource,
  createProjectSourceBundle,
  createProjectSourceExportSection,
  normalizeProjectSourceBundle,
  summarizeProjectFileIndex,
} from "./index.js";

const source = createProjectGitSource({
  projectId: "demo-kita-2028",
  repoUrl: "https://github.com/juergengeck/projektor.git",
  defaultBranch: "main",
  trackedPathGlobs: ["projects/demo-kita-2028/**", "docs/**"],
});

assert.equal(source.$type$, PROJECT_GIT_SOURCE_TYPE);
assert.equal(source.$version$, "v1");
assert.equal(source.adapter, "source.git");
assert.ok(source.sourceId.startsWith("project-git-source:"));
assert.ok(source.ignoredPathGlobs.includes("dist/**"));

const index = createProjectFileIndex({
  source,
  branch: "main",
  head: "6bf7533",
  status: "dirty",
  generatedAt: "2026-06-03T09:30:00.000Z",
  ignoredPaths: ["dist/app.js", ".wrangler/state"],
  files: [
    { path: "projects/demo-kita-2028/brief.pdf", kind: "project", status: "tracked", phase: "LP3" },
    { path: "projects/demo-kita-2028/lp3/kosten.md", kind: "document", status: "modified", phase: "LP3" },
    { path: "projects/demo-kita-2028/lp4/genehmigung.md", kind: "document", status: "added", phase: "LP4" },
  ],
});

assert.equal(index.$type$, PROJECT_FILE_INDEX_TYPE);
assert.ok(index.indexId.startsWith("project-file-index:"));
assert.equal(index.files[0].label, "brief.pdf");
assert.equal(index.ignoredPaths.length, 2);

const summary = summarizeProjectFileIndex({ source, index });
assert.equal(summary.totalFiles, 3);
assert.equal(summary.trackedFiles, 1);
assert.equal(summary.dirtyFiles, 2);
assert.deepEqual(summary.phases, ["LP3", "LP4"]);

const section = createProjectSourceExportSection({ source, index });
assert.equal(section[0], "Git-Quelle");
assert.match(section[1], /source\.git main@6bf7533/);
assert.match(section[1], /2 offene Aenderungen/);

const normalized = normalizeProjectSourceBundle(createProjectSourceBundle({
  source,
  branch: "main",
  head: "6bf7533",
  status: "dirty",
  generatedAt: "2026-06-03T09:30:00.000Z",
  files: index.files,
  ignoredPaths: index.ignoredPaths,
}));

assert.equal(normalized.source.sourceId, source.sourceId);
assert.equal(normalized.index.files.length, 3);
assert.equal(ProjectSourceCoreRecipes.length, 2);
assert.equal(ProjectSourceCoreRecipes[1].name, PROJECT_SOURCE_ARTIFACT_TYPE);

const artifact = createProjectSourceArtifact({
  source: "a".repeat(64),
  path: "projects/demo-kita-2028/brief.pdf",
  revision: "6bf7533",
  blob: "b".repeat(64),
  byteLength: 12,
  mediaType: "application/pdf",
  sourceEntryId: "git-entry-brief",
  ingestedAt: 1780479000000,
  ingestedBy: "person:projektleitung@example.invalid",
});

assert.equal(artifact.$type$, PROJECT_SOURCE_ARTIFACT_TYPE);
assert.equal(artifact.blob, "b".repeat(64));
assert.equal(artifact.source, "a".repeat(64));

assert.throws(
  () => createProjectFileIndex({ source, files: [{ path: "../secret.env" }] }),
  /repository root/,
);

assert.throws(
  () => createProjectFileIndex({ source, files: [{ path: "/absolute/brief.pdf" }] }),
  /repository-relative/,
);

assert.throws(
  () => createProjectFileIndex({ source, files: [{ path: "brief.pdf", status: "synced-ish" }] }),
  /Unsupported project file status/,
);

const gitBacked = createProjectSourceBundleFromGitSource({
  projectId: "demo-kita-2028",
  discovery: {
    repoRoot: "/Users/gecko/src/projektor",
    headCommit: "abc123",
    branchRef: "main",
    remoteUrl: "git@github.com:juergengeck/projektor.git",
  },
  inventory: {
    trackedFiles: [
      { path: "README.md", blobSha: "blob-readme", mode: "100644", objectType: "blob" },
      { path: "packages/project-source.core/index.js", blobSha: "blob-source", mode: "100644", objectType: "blob" },
    ],
    entries: [
      {
        id: "git-entry-readme",
        locator: "commit=abc123&path=README.md",
      },
      {
        id: "git-entry-source",
        locator: "commit=abc123&path=packages%2Fproject-source.core%2Findex.js",
      },
    ],
  },
  worktreeState: {
    headCommit: "abc123",
    branchRef: "main",
    capturedAt: 1780479000000,
    entries: [
      {
        kind: "ordinary",
        statusCode: ".M",
        path: "README.md",
        fileKind: "file",
        contentSha256: "dirty-readme",
      },
      {
        kind: "untracked",
        statusCode: "??",
        path: "docs/source-git.md",
        fileKind: "file",
        contentSha256: "new-doc",
      },
    ],
  },
  ignoredPaths: ["dist/app.js"],
});

assert.equal(gitBacked.source.adapter, "source.git");
assert.equal(gitBacked.source.repoUrl, "git@github.com:juergengeck/projektor.git");
assert.equal(gitBacked.index.status, "dirty");
assert.equal(gitBacked.index.head, "abc123");
assert.equal(gitBacked.index.files.length, 3);
assert.equal(gitBacked.index.files.find((file) => file.path === "README.md").status, "modified");
assert.equal(gitBacked.index.files.find((file) => file.path === "README.md").blob, undefined);
assert.equal(gitBacked.index.files.find((file) => file.path === "docs/source-git.md").status, "untracked");
assert.equal(gitBacked.index.files.find((file) => file.path.endsWith("index.js")).sourceEntryId, "git-entry-source");

assert.throws(
  () => createProjectSourceArtifact({
    source: "a".repeat(64),
    path: "brief.pdf",
    revision: "6bf7533",
    blob: "git-object-id-is-not-a-blob-reference",
    byteLength: 12,
    ingestedAt: 1780479000000,
    ingestedBy: "person:projektleitung@example.invalid",
  }),
  /lowercase SHA-256 hash/,
);
