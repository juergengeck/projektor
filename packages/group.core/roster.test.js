import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import "../../../one/packages/one.core/lib/system/load-nodejs.js";
import {
  closeInstance,
  getInstanceOwnerIdHash,
  initInstance,
} from "../../../one/packages/one.core/lib/instance.js";
import { storeUnversionedObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {
  getCurrentVersionNode,
  getVersionsNodes,
  mergeImportedVersionNodeWithCurrent,
  storeVersionedObjectNoMerge,
  storeVersionedObject,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import {
  StaleChainError,
  ConcurrentVersionsError,
  isRosterMemberAt,
  rosterAsOf,
} from "./index.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-roster-"));
let initialized = false;
const DAY = 24 * 60 * 60 * 1000;

try {
  await initInstance({
    name: "projektor-roster-test",
    email: "projektor-roster-test@example.invalid",
    secret: "projektor-roster-test-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
  });
  initialized = true;

  const owner = getInstanceOwnerIdHash();
  const withMember = await storeUnversionedObject({
    $type$: "HashGroup",
    person: new Set([owner]),
  });
  const v1 = await storeVersionedObject({
    $type$: "Group",
    name: "tragwerksplanung",
    owner,
    hashGroup: withMember.hash,
  });
  const v1Nodes = await getVersionsNodes(v1.idHash);
  const afterV1 = Math.max(...v1Nodes.map((node) => node.creationTime));
  const v1Node = await getCurrentVersionNode(v1.idHash);

  const withoutMember = await storeUnversionedObject({
    $type$: "HashGroup",
    person: new Set(),
  });
  await storeVersionedObject({
    $type$: "Group",
    name: "tragwerksplanung",
    owner,
    hashGroup: withoutMember.hash,
  });
  const v2Nodes = await getVersionsNodes(v1.idHash);
  const afterV2 = Math.max(...v2Nodes.map((node) => node.creationTime));

  assert.deepEqual(await rosterAsOf(v1.idHash, afterV1), [owner]);
  assert.deepEqual(await rosterAsOf(v1.idHash, afterV2), []);
  assert.deepEqual(await rosterAsOf(v1.idHash, 0), []);

  assert.equal(
    await isRosterMemberAt({
      groupIdHash: v1.idHash,
      subject: owner,
      atTime: afterV2,
      replicaAsOf: afterV2 - DAY,
      maxStalenessMs: 7 * DAY,
    }),
    false,
  );

  await assert.rejects(
    () =>
      isRosterMemberAt({
        groupIdHash: v1.idHash,
        subject: owner,
        atTime: afterV2,
        replicaAsOf: afterV2 - 30 * DAY,
        maxStalenessMs: 7 * DAY,
      }),
    StaleChainError,
  );
  await assert.rejects(
    () => isRosterMemberAt({ groupIdHash: v1.idHash, subject: owner, atTime: afterV2 }),
    /replicaAsOf/,
  );
  await assert.rejects(() => rosterAsOf(v1.idHash), /atTime/);

  const remoteRoster = await storeUnversionedObject({
    $type$: "HashGroup",
    person: new Set([owner]),
  });
  const remoteData = await storeVersionedObjectNoMerge({
    $type$: "Group",
    name: "tragwerksplanung",
    owner,
    hashGroup: remoteRoster.hash,
  }, true);
  const branchTime = afterV2;
  const remoteNode = await storeUnversionedObject({
    $type$: "VersionNodeChange",
    depth: v1Node.obj.depth + 1,
    data: remoteData.hash,
    prev: v1Node.hash,
    creationTime: branchTime,
  });
  await mergeImportedVersionNodeWithCurrent(remoteData, remoteNode.hash);
  await assert.rejects(
    () => rosterAsOf(v1.idHash, branchTime),
    ConcurrentVersionsError,
  );

  console.log("group.core roster tests passed");
} finally {
  if (initialized) {
    closeInstance();
  }
  await rm(directory, { recursive: true, force: true });
}
