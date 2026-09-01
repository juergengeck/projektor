import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import "../../../one/packages/one.core/lib/system/load-nodejs.js";
import {
  closeInstance,
  getInstanceOwnerIdHash,
  initInstance,
} from "../../../one/packages/one.core/lib/instance.js";
import {storeUnversionedObject} from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {storeVersionedObject} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import {
  PROJECT_ACCESS_ASSERTION_TYPE,
  createProjectAccessAssertionData,
  resolveGrantAudience,
} from "./index.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-project-access-"));
try {
  await initInstance({
    name: "projektor-project-access-test",
    email: "projektor-project-access@test.invalid",
    secret: "projektor-project-access-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
  });
  const owner = getInstanceOwnerIdHash();
  const rosterV1 = await storeUnversionedObject({$type$: "HashGroup", person: new Set([owner])});
  const groupV1 = await storeVersionedObject({
    $type$: "Group",
    name: "project-access",
    owner,
    hashGroup: rosterV1.hash,
  });
  const afterV1 = groupV1.timestamp;
  const rosterV2 = await storeUnversionedObject({$type$: "HashGroup", person: new Set()});
  const groupV2 = await storeVersionedObject({
    $type$: "Group",
    name: "project-access",
    owner,
    hashGroup: rosterV2.hash,
  });
  const afterV2 = groupV2.timestamp;

  const living = {
    $type$: PROJECT_ACCESS_ASSERTION_TYPE,
    ...createProjectAccessAssertionData({
      group: groupV1.idHash,
      binding: "living",
      record: "schedule",
      projectId: "demo",
      grantedAt: afterV1,
    }),
  };
  const pinned = {
    $type$: PROJECT_ACCESS_ASSERTION_TYPE,
    ...createProjectAccessAssertionData({
      group: groupV1.idHash,
      hashGroup: rosterV1.hash,
      binding: "pinned",
      record: "schedule",
      projectId: "demo",
      grantedAt: afterV1,
    }),
  };
  assert.deepEqual(await resolveGrantAudience(living, afterV2), []);
  assert.deepEqual(await resolveGrantAudience(pinned, afterV2), [owner]);
  assert.throws(
    () => createProjectAccessAssertionData({
      group: groupV1.idHash,
      binding: "pinned",
      record: "schedule",
      projectId: "demo",
      grantedAt: afterV1,
    }),
    /requires hashGroup/,
  );
  console.log("trust.projektor project-access tests passed");
} finally {
  closeInstance();
  await rm(directory, {recursive: true, force: true});
}
