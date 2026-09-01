#!/usr/bin/env node
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { GitSourceService } from "../../one/packages/source.git/dist/index.js";
import {
  createProjectSourceBundleFromGitSource,
  ingestProjectSourceArtifact,
  summarizeProjectFileIndex,
} from "../packages/project-source.core/index.js";

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] || fallback;
}

export async function loadProjectSourceBundle({
  projectId = "projektor",
  repoRoot = ".",
  capturedAt = Date.now(),
} = {}) {
  const service = new GitSourceService();
  const discovery = await service.discoverSource({ repoRoot, capturedAt });
  const inventory = await service.inventoryTrackedFiles({
    repoRoot: discovery.repoRoot,
    sourceIdHash: "source-git-projektor-preview",
    indexedAt: capturedAt,
  });
  const worktreeState = await service.snapshotWorktreeState({
    repoRoot: discovery.repoRoot,
    capturedAt,
  });

  return createProjectSourceBundleFromGitSource({
    projectId,
    discovery,
    inventory,
    worktreeState,
    ignoredPaths: ["dist", ".wrangler", "node_modules", ".env"],
    trackedPathGlobs: ["**/*"],
    generatedAt: new Date(capturedAt).toISOString(),
  });
}

export async function ingestProjectFileFromGitSource({
  bundle,
  repoRoot = ".",
  filePath,
  ingestedAt,
  ingestedBy,
  mediaType,
} = {}) {
  const relativePath = String(filePath || "").replaceAll("\\", "/");
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split("/").includes("..")) {
    throw new TypeError("filePath must be repository-relative and remain inside the repository.");
  }
  const file = bundle?.index?.files?.find((candidate) => candidate.path === relativePath);
  if (!file) throw new Error(`Project source does not contain ${relativePath}.`);
  if (file.status === "deleted") throw new Error(`Cannot ingest deleted project source ${relativePath}.`);

  const resolvedRoot = await realpath(repoRoot);
  const resolvedFile = await realpath(path.resolve(resolvedRoot, relativePath));
  const pathFromRoot = path.relative(resolvedRoot, resolvedFile);
  if (pathFromRoot.startsWith("..") || path.isAbsolute(pathFromRoot)) {
    throw new TypeError("filePath resolves outside the repository.");
  }

  const [bytes, fileStat] = await Promise.all([readFile(resolvedFile), stat(resolvedFile)]);
  return ingestProjectSourceArtifact({
    source: bundle.source,
    bytes,
    path: relativePath,
    revision: file.status === "tracked"
      ? bundle.index.head
      : `working-tree:${bundle.index.head}`,
    ...(mediaType ? { mediaType } : {}),
    ...(file.sourceEntryId ? { sourceEntryId: file.sourceEntryId } : {}),
    sourceModifiedAt: fileStat.mtimeMs,
    ingestedAt,
    ingestedBy,
  });
}

function printSummary(summary) {
  const rows = [
    ["Source", summary.sourceId],
    ["Adapter", summary.adapter],
    ["Repository", summary.repoUrl],
    ["Revision", `${summary.branch}@${summary.head}`],
    ["Status", summary.status],
    ["Files", summary.totalFiles],
    ["Changed", summary.dirtyFiles],
    ["Ignored", summary.ignoredPaths],
  ];
  for (const [label, value] of rows) console.log(`${label}: ${value}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  const bundle = await loadProjectSourceBundle({
    projectId: optionValue("--project-id", "projektor"),
    repoRoot: optionValue("--repo-root", "."),
    capturedAt: Number(optionValue("--captured-at", Date.now())),
  });
  printSummary(summarizeProjectFileIndex(bundle));
}
