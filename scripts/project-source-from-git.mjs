#!/usr/bin/env node
import { GitSourceService } from "../../vger/packages/source.git/dist/index.js";
import {
  createProjectSourceBundleFromGitSource,
  summarizeProjectFileIndex,
} from "../packages/project-source.core/index.js";

function optionValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const projectId = optionValue("--project-id", "projektor");
const repoRoot = optionValue("--repo-root", ".");
const output = optionValue("--output", "summary");
const capturedAt = Number(optionValue("--captured-at", Date.now()));

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

const bundle = createProjectSourceBundleFromGitSource({
  projectId,
  discovery,
  inventory,
  worktreeState,
  ignoredPaths: ["dist", ".wrangler", "node_modules", ".env"],
  trackedPathGlobs: ["**/*"],
  generatedAt: new Date(capturedAt).toISOString(),
});

if (output === "json" || hasFlag("--json")) {
  console.log(JSON.stringify(bundle, null, 2));
} else {
  console.log(JSON.stringify(summarizeProjectFileIndex(bundle), null, 2));
}
