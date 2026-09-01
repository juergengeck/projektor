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
import {
  getVersion,
  getVersionsNodes,
  storeVersionedObject,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import {getSignatures, sign} from "../../../one/packages/one.models/lib/misc/Signature.js";
import RecipesStable from "../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import {ReverseMapsStable} from "../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import {ReverseMapsExperimental} from "../../../one/packages/one.models/lib/recipes/reversemaps-experimental.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-group-spike-"));
try {
  await initInstance({
    name: "projektor-group-spike",
    email: "projektor-group-spike@test.invalid",
    secret: "projektor-group-spike-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
    // A bare ONE.core instance can store Group/HashGroup, but one.models
    // Signature is not registered unless the one.models recipes are supplied.
    initialRecipes: [...RecipesStable, ...RecipesExperimental],
    initiallyEnabledReverseMapTypes: new Map([
      ...ReverseMapsStable,
      ...ReverseMapsExperimental,
    ]),
  });
  const owner = getInstanceOwnerIdHash();
  const rosterV1 = await storeUnversionedObject({
    $type$: "HashGroup",
    person: new Set([owner]),
  });
  const groupV1 = await storeVersionedObject({
    $type$: "Group",
    name: "api-spike",
    owner,
    hashGroup: rosterV1.hash,
  });

  // Confirmed runtime contracts consumed by roster.js and trust.projektor:
  // HashGroup must be durable first; unversioned results expose hash; versioned
  // results expose distinct hash/idHash plus timestamp.
  assert.ok(rosterV1.hash);
  assert.ok(groupV1.hash);
  assert.ok(groupV1.idHash);
  assert.notEqual(groupV1.hash, groupV1.idHash);
  assert.ok(Number.isSafeInteger(groupV1.timestamp));

  const signed = await sign(groupV1.hash, owner);
  assert.equal(signed.obj.data, groupV1.hash);
  assert.equal(signed.obj.issuer, owner);
  assert.ok((await getSignatures(groupV1.hash, owner)).some(entry =>
    entry.data === groupV1.hash && entry.issuer === owner
  ));

  const rosterV2 = await storeUnversionedObject({$type$: "HashGroup", person: new Set()});
  await storeVersionedObject({
    $type$: "Group",
    name: "api-spike",
    owner,
    hashGroup: rosterV2.hash,
  });
  const nodes = await getVersionsNodes(groupV1.idHash);
  assert.equal(nodes.length, 2);
  assert.ok(nodes.every(node => Number.isSafeInteger(node.creationTime)));
  const versions = await Promise.all(nodes.map(node => getVersion(node.data)));
  assert.deepEqual(new Set(versions.map(group => group.hashGroup)), new Set([
    rosterV1.hash,
    rosterV2.hash,
  ]));
  console.log("group.core API spike passed");
} finally {
  closeInstance();
  await rm(directory, {recursive: true, force: true});
}
