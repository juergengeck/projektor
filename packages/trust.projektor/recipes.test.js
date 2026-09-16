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
  assert.equal(ProjektorTrustRecipes.length, 14);

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
    attributionTier: "custody",
    participationEvidence: new Set(),
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
  const statement = await storeUnversionedObject({
    $type$: "ProjektorActParticipationStatement",
    act: bundle.hash,
    person: owner,
    value: "affirmed",
    statedAt: 300,
    license: license.hash,
  });
  const statementSignature = await sign(statement.hash, owner);
  const statementBundle = await storeUnversionedObject({
    $type$: "ProjektorActParticipationAttestationBundle",
    claim: statement.hash,
    signature: statementSignature.hash,
    signingKeys: keys,
    issuerKeyBundles: new Set([issuerBundle]),
    purpose: "act-participation",
    authoredAt: 300,
    attributionTier: "participation-backed",
    participationEvidence: new Set([license.hash]),
  });
  const statementStatus = await storeVersionedObject({
    $type$: "ProjektorActParticipationBundleStatus",
    $version$: "1",
    receiver: owner,
    bundle: statementBundle.hash,
    state: "verified",
    evaluatedAt: 301,
    trustEvidence: new Set([issuerBundle, license.hash]),
  });
  const assessment = await storeUnversionedObject({
    $type$: "ProjektorActAttributionAssessment",
    receiver: owner,
    act: bundle.hash,
    person: owner,
    asOfTime: 302,
    baseTier: "custody",
    state: "affirmed",
    effectiveTier: "participation-backed",
    statementBundles: new Set([statementBundle.hash]),
    statementStatuses: new Set([statementStatus.hash]),
  });
  const reliance = await storeUnversionedObject({
    $type$: "ProjektorRelianceCertificate",
    act: bundle.hash,
    attributedPerson: owner,
    relyingParty: owner,
    assessment: assessment.hash,
    tierAtReliance: "participation-backed",
    statementStateAtReliance: "affirmed",
    reliedAt: 302,
    license: license.hash,
  });
  const relianceSignature = await sign(reliance.hash, owner);
  const relianceBundle = await storeUnversionedObject({
    $type$: "ProjektorRelianceAttestationBundle",
    claim: reliance.hash,
    signature: relianceSignature.hash,
    signingKeys: keys,
    issuerKeyBundles: new Set([issuerBundle]),
    purpose: "act-reliance",
    authoredAt: 302,
    attributionTier: "participation-backed",
    participationEvidence: new Set([license.hash]),
  });
  assert.ok(status.idHash);
  assert.ok(projection.idHash);
  assert.ok(statementStatus.idHash);
  assert.ok(assessment.hash);
  assert.ok(relianceBundle.hash);
  console.log("trust.projektor recipe registration test passed");
} finally {
  closeInstance();
  await rm(directory, {recursive: true, force: true});
}
