import { stringify as oneStableStringify } from "../../../one/packages/one.core/lib/util/sorted-stringify.js";
import {
  readBlobAsUint8Array,
  storeArrayBufferAsBlob,
} from "../../../one/packages/one.core/lib/storage-blob.js";
import {
  getObject,
  storeUnversionedObject,
} from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {
  getObjectByIdHash,
  storeVersionedObject,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";

export const PROJECT_GIT_SOURCE_TYPE = "ProjectGitSource";
export const PROJECT_SOURCE_ARTIFACT_TYPE = "ProjectSourceArtifact";
export const PROJECT_FILE_INDEX_TYPE = "ProjectFileIndex";
export const PROJECT_SOURCE_SCHEMA_VERSION = "0.2.0";

export const ProjectGitSourceRecipe = {
  $type$: "Recipe",
  name: PROJECT_GIT_SOURCE_TYPE,
  rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectGitSource$/ } },
    { itemprop: "$version$", itemtype: { type: "string", regexp: /^v1$/ } },
    { itemprop: "sourceId", itemtype: { type: "string" }, isId: true },
    { itemprop: "projectId", itemtype: { type: "string" } },
    { itemprop: "adapter", itemtype: { type: "string" } },
    { itemprop: "repoUrl", itemtype: { type: "string" } },
    { itemprop: "defaultBranch", itemtype: { type: "string" } },
    { itemprop: "rootPath", itemtype: { type: "string" } },
    { itemprop: "detachedWorktreeRoot", itemtype: { type: "string" }, optional: true },
    { itemprop: "trackedPathGlobs", itemtype: { type: "array", item: { type: "string" } } },
    { itemprop: "ignoredPathGlobs", itemtype: { type: "array", item: { type: "string" } } },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};

export const ProjectSourceArtifactRecipe = {
  $type$: "Recipe",
  name: PROJECT_SOURCE_ARTIFACT_TYPE,
  rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectSourceArtifact$/ } },
    {
      itemprop: "source",
      itemtype: {
        type: "referenceToId",
        allowedTypes: new Set([PROJECT_GIT_SOURCE_TYPE]),
      },
    },
    { itemprop: "path", itemtype: { type: "string" } },
    { itemprop: "revision", itemtype: { type: "string" } },
    { itemprop: "blob", itemtype: { type: "referenceToBlob" } },
    { itemprop: "byteLength", itemtype: { type: "number" } },
    { itemprop: "mediaType", itemtype: { type: "string" }, optional: true },
    { itemprop: "sourceEntryId", itemtype: { type: "string" }, optional: true },
    { itemprop: "sourceModifiedAt", itemtype: { type: "number" }, optional: true },
    { itemprop: "ingestedAt", itemtype: { type: "number" } },
    { itemprop: "ingestedBy", itemtype: { type: "string" } },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};

// ProjectFileIndex is a read-model projection. Only recipe-backed domain objects belong here.
export const ProjectSourceCoreRecipes = [ProjectGitSourceRecipe, ProjectSourceArtifactRecipe];
export const ProjectSourceCoreReverseMaps = [];
export const ProjectSourceCoreReverseMapsForIdObjects = [];

const FILE_STATUSES = new Set(["tracked", "modified", "added", "deleted", "renamed", "untracked"]);
const DEFAULT_IGNORED_PATH_GLOBS = ["dist/**", "node_modules/**", ".wrangler/**", ".env*", "*.log", ".DS_Store"];

function clone(value) {
  return structuredClone(value);
}

function assertPlainObject(value, name) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object.`);
  }
}

function requiredText(value, name) {
  const text = String(value || "").trim();
  if (!text) throw new TypeError(`${name} is required.`);
  return text;
}

function optionalText(value) {
  const text = String(value || "").trim();
  return text || undefined;
}

function requiredSha256(value, name) {
  const hash = requiredText(value, name);
  if (!/^[a-f0-9]{64}$/.test(hash)) {
    throw new TypeError(`${name} must be a lowercase SHA-256 hash.`);
  }
  return hash;
}

function nonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function nonNegativeNumber(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative finite number.`);
  }
  return value;
}

function normalizeBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("bytes must be an ArrayBuffer or typed-array view.");
}

function uniqueStrings(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeProjectPath(value, name = "Project file path") {
  const raw = requiredText(value, name).replaceAll("\\", "/");
  if (raw.startsWith("/") || raw.includes("://")) {
    throw new TypeError(`${name} must be repository-relative.`);
  }

  const segments = raw.split("/").filter((segment) => segment && segment !== ".");
  if (segments.some((segment) => segment === "..")) {
    throw new TypeError(`${name} must not leave the repository root.`);
  }

  return segments.join("/");
}

function hashId(prefix, values) {
  const text = oneStableStringify(values);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return `${prefix}:${hash.toString(36)}`;
}

export function buildProjectGitSourceId(projectId, repoUrl, rootPath = ".") {
  return hashId("project-git-source", [projectId, repoUrl, rootPath]);
}

export function createProjectGitSource(input = {}) {
  assertPlainObject(input, "Project git source");
  const projectId = requiredText(input.projectId, "projectId");
  const repoUrl = requiredText(input.repoUrl, "repoUrl");
  const rootPath = String(input.rootPath || ".").trim() || ".";

  if (rootPath !== "." && (rootPath.startsWith("/") || rootPath.includes(".."))) {
    throw new TypeError("rootPath must be repository-relative.");
  }

  return {
    $type$: PROJECT_GIT_SOURCE_TYPE,
    $version$: "v1",
    sourceId: input.sourceId || buildProjectGitSourceId(projectId, repoUrl, rootPath),
    projectId,
    adapter: "source.git",
    repoUrl,
    defaultBranch: requiredText(input.defaultBranch || "main", "defaultBranch"),
    rootPath,
    ...(optionalText(input.detachedWorktreeRoot) ? { detachedWorktreeRoot: optionalText(input.detachedWorktreeRoot) } : {}),
    trackedPathGlobs: uniqueStrings(input.trackedPathGlobs),
    ignoredPathGlobs: uniqueStrings(input.ignoredPathGlobs).length
      ? uniqueStrings(input.ignoredPathGlobs)
      : clone(DEFAULT_IGNORED_PATH_GLOBS),
    schemaVersion: PROJECT_SOURCE_SCHEMA_VERSION,
  };
}

export function normalizeProjectGitSource(input) {
  assertPlainObject(input, "Project git source");
  if (input.$type$ && input.$type$ !== PROJECT_GIT_SOURCE_TYPE) {
    throw new TypeError(`Unsupported source type: ${input.$type$}`);
  }
  return createProjectGitSource(input);
}

function normalizeProjectFile(input) {
  assertPlainObject(input, "Project file");
  const path = normalizeProjectPath(input.path);
  const status = input.status || "tracked";
  if (!FILE_STATUSES.has(status)) {
    throw new TypeError(`Unsupported project file status: ${status}`);
  }

  return {
    path,
    label: optionalText(input.label) || path.split("/").at(-1),
    kind: optionalText(input.kind) || "document",
    owner: optionalText(input.owner) || "",
    phase: optionalText(input.phase) || "",
    status,
    ...(optionalText(input.blob) ? { blob: requiredSha256(input.blob, "Project file blob") } : {}),
    ...(optionalText(input.sourceEntryId) ? { sourceEntryId: optionalText(input.sourceEntryId) } : {}),
  };
}

export function buildProjectFileIndexId(sourceId, head, files) {
  return hashId("project-file-index", [
    sourceId,
    head,
    files.map((file) => [file.path, file.status, file.blob || ""]),
  ]);
}

export function createProjectSourceArtifact(input = {}) {
  assertPlainObject(input, "Project source artifact");
  const artifact = {
    $type$: PROJECT_SOURCE_ARTIFACT_TYPE,
    source: requiredSha256(input.source, "source"),
    path: normalizeProjectPath(input.path),
    revision: requiredText(input.revision, "revision"),
    blob: requiredSha256(input.blob, "blob"),
    byteLength: nonNegativeInteger(input.byteLength, "byteLength"),
    ...(optionalText(input.mediaType) ? { mediaType: optionalText(input.mediaType) } : {}),
    ...(optionalText(input.sourceEntryId) ? { sourceEntryId: optionalText(input.sourceEntryId) } : {}),
    ...(input.sourceModifiedAt === undefined
      ? {}
      : { sourceModifiedAt: nonNegativeNumber(input.sourceModifiedAt, "sourceModifiedAt") }),
    ingestedAt: nonNegativeNumber(input.ingestedAt, "ingestedAt"),
    ingestedBy: requiredText(input.ingestedBy, "ingestedBy"),
    schemaVersion: PROJECT_SOURCE_SCHEMA_VERSION,
  };
  return artifact;
}

export async function ingestProjectSourceArtifact(input = {}) {
  assertPlainObject(input, "Project source ingestion");
  const source = normalizeProjectGitSource(input.source);
  const bytes = normalizeBytes(input.bytes);

  // Validate all caller-owned provenance before any storage mutation.
  const provenance = {
    path: normalizeProjectPath(input.path),
    revision: requiredText(input.revision, "revision"),
    ...(optionalText(input.mediaType) ? { mediaType: optionalText(input.mediaType) } : {}),
    ...(optionalText(input.sourceEntryId) ? { sourceEntryId: optionalText(input.sourceEntryId) } : {}),
    ...(input.sourceModifiedAt === undefined
      ? {}
      : { sourceModifiedAt: nonNegativeNumber(input.sourceModifiedAt, "sourceModifiedAt") }),
    ingestedAt: nonNegativeNumber(input.ingestedAt, "ingestedAt"),
    ingestedBy: requiredText(input.ingestedBy, "ingestedBy"),
  };

  const storedSource = await storeVersionedObject(source);
  const storedBlob = await storeArrayBufferAsBlob(bytes);
  const artifact = createProjectSourceArtifact({
    ...provenance,
    source: storedSource.idHash,
    blob: storedBlob.hash,
    byteLength: bytes.byteLength,
  });
  const storedArtifact = await storeUnversionedObject(artifact);

  return {
    source,
    sourceIdHash: storedSource.idHash,
    sourceVersionHash: storedSource.hash,
    artifact,
    artifactHash: storedArtifact.hash,
    blobHash: storedBlob.hash,
  };
}

export async function readProjectSourceArtifact(artifactHash) {
  const hash = requiredSha256(artifactHash, "artifactHash");
  const artifact = await getObject(hash);
  if (artifact?.$type$ !== PROJECT_SOURCE_ARTIFACT_TYPE) {
    throw new TypeError(`Object ${hash} is not a ${PROJECT_SOURCE_ARTIFACT_TYPE}.`);
  }
  const [bytes, storedSource] = await Promise.all([
    readBlobAsUint8Array(artifact.blob),
    getObjectByIdHash(artifact.source),
  ]);
  return {
    artifact,
    bytes,
    source: storedSource.obj,
    sourceVersionHash: storedSource.hash,
  };
}

export function createProjectFileIndex(input = {}) {
  assertPlainObject(input, "Project file index");
  const source = normalizeProjectGitSource(input.source);
  const files = Array.isArray(input.files) ? input.files.map(normalizeProjectFile) : [];
  const head = requiredText(input.head || "working-tree", "head");

  return {
    $type$: PROJECT_FILE_INDEX_TYPE,
    indexId: input.indexId || buildProjectFileIndexId(source.sourceId, head, files),
    sourceId: source.sourceId,
    projectId: source.projectId,
    branch: requiredText(input.branch || source.defaultBranch, "branch"),
    head,
    status: requiredText(input.status || "clean", "status"),
    files,
    ignoredPaths: uniqueStrings(input.ignoredPaths).map((path) => normalizeProjectPath(path, "Ignored path")),
    generatedAt: requiredText(input.generatedAt || new Date(0).toISOString(), "generatedAt"),
    schemaVersion: PROJECT_SOURCE_SCHEMA_VERSION,
  };
}

export function normalizeProjectFileIndex(input = {}) {
  assertPlainObject(input, "Project file index");
  if (input.$type$ && input.$type$ !== PROJECT_FILE_INDEX_TYPE) {
    throw new TypeError(`Unsupported file index type: ${input.$type$}`);
  }
  return createProjectFileIndex(input);
}

export function createProjectSourceBundle(input = {}) {
  const source = normalizeProjectGitSource(input.source);
  const index = createProjectFileIndex({
    source,
    files: input.files,
    branch: input.branch,
    head: input.head,
    status: input.status,
    ignoredPaths: input.ignoredPaths,
    generatedAt: input.generatedAt,
  });

  return { source, index };
}

export function normalizeProjectSourceBundle(input = {}) {
  assertPlainObject(input, "Project source bundle");
  const source = normalizeProjectGitSource(input.source);
  const index = normalizeProjectFileIndex({
    ...input.index,
    source,
  });
  return { source, index };
}

export function summarizeProjectFileIndex(bundle = {}) {
  const { source, index } = normalizeProjectSourceBundle(bundle);
  const counts = index.files.reduce((acc, file) => {
    acc[file.status] = (acc[file.status] || 0) + 1;
    acc.total += 1;
    return acc;
  }, { total: 0 });

  const dirtyCount = (counts.modified || 0) + (counts.added || 0) + (counts.deleted || 0) + (counts.renamed || 0) + (counts.untracked || 0);
  const phases = [...new Set(index.files.map((file) => file.phase).filter(Boolean))];

  return {
    sourceId: source.sourceId,
    adapter: source.adapter,
    repoUrl: source.repoUrl,
    branch: index.branch,
    head: index.head,
    status: index.status,
    totalFiles: counts.total,
    trackedFiles: counts.tracked || 0,
    dirtyFiles: dirtyCount,
    ignoredPaths: index.ignoredPaths.length,
    phases,
  };
}

export function createProjectSourceExportSection(bundle = {}) {
  const summary = summarizeProjectFileIndex(bundle);
  return [
    "Git-Quelle",
    `${summary.adapter} ${summary.branch}@${summary.head}; ${summary.totalFiles} Projektdateien, ${summary.dirtyFiles} offene Aenderungen, ${summary.ignoredPaths} ignorierte Pfade`,
  ];
}

function statusFromGitWorktreeEntry(entry) {
  if (entry?.kind === "untracked" || entry?.statusCode === "??") return "untracked";
  if (entry?.kind === "rename" || String(entry?.statusCode || "").includes("R")) return "renamed";
  const statusCode = String(entry?.statusCode || "");
  if (statusCode.includes("D")) return "deleted";
  if (statusCode.includes("A")) return "added";
  return "modified";
}

function kindFromGitPath(filePath) {
  const ext = String(filePath || "").split(".").at(-1)?.toLowerCase() || "";
  if (["js", "mjs", "cjs", "ts", "tsx", "jsx", "css", "html", "json"].includes(ext)) return "source";
  if (["md", "pdf", "pptx", "docx", "xlsx", "csv", "ods"].includes(ext)) return "document";
  return "git-file";
}

function sourceEntryByPath(entries = []) {
  const byPath = new Map();
  entries.forEach((entry) => {
    const locator = String(entry?.locator || "");
    const pathValue = new URLSearchParams(locator).get("path");
    if (pathValue) byPath.set(pathValue, entry);
  });
  return byPath;
}

export function createProjectSourceBundleFromGitSource(input = {}) {
  assertPlainObject(input, "Git source adapter input");
  const projectId = requiredText(input.projectId, "projectId");
  const discovery = input.discovery || input.inventory?.discovery || {};
  assertPlainObject(discovery, "source.git discovery");

  const repoRoot = requiredText(discovery.repoRoot || input.repoRoot || ".", "repoRoot");
  const remoteUrl = optionalText(discovery.remoteUrl || discovery.source?.upstreamId || input.repoUrl);
  const branch = optionalText(input.branch || input.worktreeState?.branchRef || discovery.branchRef) || "detached";
  const head = requiredText(input.head || input.worktreeState?.headCommit || discovery.headCommit, "head");
  const worktreeEntries = Array.isArray(input.worktreeState?.entries) ? input.worktreeState.entries : [];
  const generatedAt = input.generatedAt || new Date(input.worktreeState?.capturedAt || Date.now()).toISOString();
  const sourceEntriesByPath = sourceEntryByPath(input.inventory?.entries);

  const filesByPath = new Map();
  (input.inventory?.trackedFiles || []).forEach((file) => {
    const sourceEntry = sourceEntriesByPath.get(file.path);
    filesByPath.set(file.path, {
      path: file.path,
      label: file.path.split("/").at(-1),
      kind: kindFromGitPath(file.path),
      owner: "",
      phase: "",
      status: "tracked",
      ...(sourceEntry?.id ? { sourceEntryId: sourceEntry.id } : {}),
    });
  });

  worktreeEntries.forEach((entry) => {
    const current = filesByPath.get(entry.path) || {
      path: entry.path,
      label: entry.path.split("/").at(-1),
      kind: kindFromGitPath(entry.path),
      owner: "",
      phase: "",
    };
    filesByPath.set(entry.path, {
      ...current,
      status: statusFromGitWorktreeEntry(entry),
    });
  });

  return createProjectSourceBundle({
    source: {
      projectId,
      repoUrl: remoteUrl || `file://${repoRoot}`,
      defaultBranch: branch === "detached" ? "main" : branch,
      rootPath: ".",
      trackedPathGlobs: Array.isArray(input.trackedPathGlobs) ? input.trackedPathGlobs : [],
      ignoredPathGlobs: Array.isArray(input.ignoredPathGlobs) ? input.ignoredPathGlobs : undefined,
      detachedWorktreeRoot: optionalText(input.detachedWorktreeRoot),
    },
    branch,
    head,
    status: worktreeEntries.length > 0 ? "dirty" : "clean",
    ignoredPaths: Array.isArray(input.ignoredPaths) ? input.ignoredPaths : [],
    generatedAt,
    files: [...filesByPath.values()].sort((left, right) => left.path.localeCompare(right.path)),
  });
}
