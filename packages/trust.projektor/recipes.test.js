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
import {getDefaultKeys} from "../../../one/packages/one.core/lib/keychain/keychain.js";
import {storeUnversionedObject} from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {storeVersionedObject} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import {sign} from "../../../one/packages/one.models/lib/misc/Signature.js";
import RecipesStable from "../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import {ReverseMapsStable} from "../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import {ReverseMapsExperimental} from "../../../one/packages/one.models/lib/recipes/reversemaps-experimental.js";
import {
  AllRecipes as TrustCoreRecipes,
  AllReverseMaps as TrustCoreReverseMaps,
} from "../../../one/packages/trust.core/dist/recipes/index.js";
import {
  ProjektorTrustRecipes,
  ProjektorTrustReverseMaps,
  mergeReverseMaps,
} from "./index.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-trust-recipes-"));
try {
  await initInstance({
    name: "projektor-trust-recipes-test",
    email: "projektor-trust-recipes@test.invalid",
    secret: "projektor-trust-recipes-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
    initialRecipes: [
      ...RecipesStable,
      ...RecipesExperimental,
      ...TrustCoreRecipes,
      ...ProjektorTrustRecipes,
    ],
    initiallyEnabledReverseMapTypes: new Map(mergeReverseMaps(
      ReverseMapsStable,
      ReverseMapsExperimental,
      TrustCoreReverseMaps,
      ProjektorTrustReverseMaps,
    )),
  });
  assert.equal(ProjektorTrustRecipes.length, 8);

  const owner = getInstanceOwnerIdHash();
  const roster = await storeUnversionedObject({$type$: "HashGroup", person: new Set([owner])});
  const group = await storeVersionedObject({
    $type$: "Group",
    name: "recipe-storage",
    owner,
    hashGroup: roster.hash,
  });
  const license = await storeUnversionedObject({
    $type$: "License",
    name: "GroupMembership",
    description: "Recipe storage test.",
  });
  const claim = await storeUnversionedObject({
    $type$: "GroupMembershipCertificate",
    group: group.idHash,
    hashGroup: roster.hash,
    person: owner,
    mayReshare: true,
    issuedAt: 200,
    validFrom: 100,
    validUntil: 500,
    license: license.hash,
  });
  const signature = await sign(claim.hash, owner);
  const keys = await getDefaultKeys(owner);
  const issuerBundle = "f".repeat(64);
  const bundle = await storeUnversionedObject({
    $type$: "GroupMembershipAttestationBundle",
    claim: claim.hash,
    signature: signature.hash,
    signingKeys: keys,
    issuerKeyBundles: new Set([issuerBundle]),
    purpose: "group-membership",
    authoredAt: 200,
  });
  const status = await storeVersionedObject({
    $type$: "GroupMembershipBundleStatus",
    $version$: "1",
    receiver: owner,
    bundle: bundle.hash,
    state: "verified",
    evaluatedAt: 250,
    trustEvidence: new Set([issuerBundle]),
  });
  const projection = await storeVersionedObject({
    $type$: "EffectiveGroupMembership",
    $version$: "1",
    receiver: owner,
    group: group.idHash,
    hashGroup: roster.hash,
    person: owner,
    validFrom: 100,
    state: "current",
    validUntil: 500,
    mayReshare: true,
    sourceBundles: new Set([bundle.hash]),
    sourceStatuses: new Set([status.hash]),
    evaluatedAt: 250,
  });
  assert.ok(status.idHash);
  assert.ok(projection.idHash);
  console.log("trust.projektor recipe registration test passed");
} finally {
  closeInstance();
  await rm(directory, {recursive: true, force: true});
}
