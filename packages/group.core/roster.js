import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {
  getVersion,
  getVersionsNodes,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { calculateHashOfObj } from "../../../one/packages/one.core/lib/util/object.js";

export class StaleChainError extends Error {
  constructor(message) {
    super(message);
    this.name = "StaleChainError";
  }
}

export class ConcurrentVersionsError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConcurrentVersionsError";
  }
}

function requireTimestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative millisecond timestamp`);
  }
  return value;
}

function parentHashes(node) {
  if (node.$type$ === "VersionNodeChange") {
    return [node.prev];
  }
  if (node.$type$ === "VersionNodeMerge") {
    return [...node.nodes];
  }
  return [];
}

async function versionInForce(nodes, atTime) {
  const candidates = nodes.filter((node) => node.creationTime <= atTime);
  if (candidates.length === 0) {
    return undefined;
  }

  const byHash = new Map();
  for (const node of candidates) {
    byHash.set(String(await calculateHashOfObj(node)), node);
  }

  const referencedParents = new Set();
  for (const node of candidates) {
    for (const parent of parentHashes(node)) {
      if (byHash.has(String(parent))) {
        referencedParents.add(String(parent));
      }
    }
  }

  const frontier = [...byHash.entries()]
    .filter(([hash]) => !referencedParents.has(hash))
    .map(([, node]) => node);

  if (frontier.length !== 1) {
    throw new ConcurrentVersionsError(
      `Group has ${frontier.length} concurrent version heads as of ${atTime}; merge before evaluating`,
    );
  }
  return frontier[0];
}

export async function groupVersionAsOf(groupIdHash, atTime) {
  if (typeof groupIdHash !== "string" || groupIdHash.length === 0) {
    throw new Error("groupVersionAsOf: groupIdHash is required");
  }
  requireTimestamp(atTime, "groupVersionAsOf: atTime");

  let nodes;
  try {
    nodes = await getVersionsNodes(groupIdHash);
  } catch (error) {
    if (error instanceof Error && error.message === "No versions node hashes found") {
      return undefined;
    }
    throw error;
  }

  const node = await versionInForce(nodes, atTime);
  if (node === undefined) {
    return undefined;
  }
  const group = await getVersion(node.data);
  if (group.$type$ !== "Group") {
    throw new Error(`groupVersionAsOf: ${groupIdHash} does not identify a Group`);
  }
  return { group, versionHash: node.data, creationTime: node.creationTime };
}

export async function rosterAsOf(groupIdHash, atTime) {
  const selected = await groupVersionAsOf(groupIdHash, atTime);
  if (selected === undefined) {
    return [];
  }
  const group = selected.group;
  const hashGroup = await getObject(group.hashGroup);
  if (hashGroup.$type$ !== "HashGroup") {
    throw new Error(`rosterAsOf: Group ${groupIdHash} references a non-HashGroup roster`);
  }
  return [...hashGroup.person].sort();
}

export async function isRosterMemberAt({
  groupIdHash,
  subject,
  atTime,
  replicaAsOf,
  maxStalenessMs,
} = {}) {
  if (typeof subject !== "string" || subject.length === 0) {
    throw new Error("isRosterMemberAt: subject is required");
  }
  const evaluatedAt = requireTimestamp(atTime, "isRosterMemberAt: atTime");
  const observedAt = requireTimestamp(replicaAsOf, "isRosterMemberAt: replicaAsOf");
  if (!Number.isSafeInteger(maxStalenessMs) || maxStalenessMs < 0) {
    throw new Error("isRosterMemberAt: maxStalenessMs must be a non-negative integer");
  }
  if (evaluatedAt - observedAt > maxStalenessMs) {
    throw new StaleChainError(
      `isRosterMemberAt: chain replica is ${evaluatedAt - observedAt}ms old, policy allows ${maxStalenessMs}ms`,
    );
  }
  return (await rosterAsOf(groupIdHash, evaluatedAt)).includes(subject);
}
