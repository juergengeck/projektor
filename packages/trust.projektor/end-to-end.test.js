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
import {
  getDefaultKeys,
  getDefaultSecretKeysAsBase64,
} from "../../../one/packages/one.core/lib/keychain/keychain.js";
import {ensureSecretSignKey} from "../../../one/packages/one.core/lib/crypto/sign.js";
import {storeUnversionedObject} from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {storeVersionedObject} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import RecipesStable from "../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import {ReverseMapsStable} from "../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import {ReverseMapsExperimental} from "../../../one/packages/one.models/lib/recipes/reversemaps-experimental.js";
import {
  AllRecipes as TrustCoreRecipes,
  AllReverseMaps as TrustCoreReverseMaps,
  createIssuerKeyRootAuthority,
} from "../../../one/packages/trust.core/dist/recipes/index.js";
import {IssuerKeyLifecycleModel} from "../../../one/packages/trust.core/dist/models/IssuerKeyLifecycleModel.js";
import {IssuerKeyLifecyclePlan} from "../../../one/packages/trust.core/dist/plans/IssuerKeyLifecyclePlan.js";
import {
  AssemblyCoreRecipes,
  AssemblyCoreReverseMaps,
  AssemblyStore,
  AssemblyVerifier,
  CertificateAssemblyAdapter,
  signAssembly,
} from "../../../one/packages/assembly.core/dist/index.js";
import {
  ProjektorTrustModel,
  ProjektorTrustRecipes,
  ProjektorTrustReverseMaps,
  createProjektorAttestationService,
  mergeReverseMaps,
} from "./index.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-trust-e2e-"));
let lifecycle;
try {
  await initInstance({
    name: "projektor-trust-e2e",
    email: "projektor-trust-e2e@test.invalid",
    secret: "projektor-trust-e2e-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
    initialRecipes: [
      ...RecipesStable,
      ...RecipesExperimental,
      ...AssemblyCoreRecipes,
      ...TrustCoreRecipes,
      ...ProjektorTrustRecipes,
    ],
    initiallyEnabledReverseMapTypes: new Map(mergeReverseMaps(
      ReverseMapsStable,
      ReverseMapsExperimental,
      AssemblyCoreReverseMaps,
      TrustCoreReverseMaps,
      ProjektorTrustReverseMaps,
    )),
  });
  const owner = getInstanceOwnerIdHash();
  const keys = await getDefaultKeys(owner);
  const lifecycleLicense = await storeUnversionedObject({
    $type$: "License",
    name: "Projektor issuer keys",
    description: "Issuer-key lifecycle evidence for the Projektor acceptance test.",
  });
  const root = await storeUnversionedObject(createIssuerKeyRootAuthority({
    issuer: owner,
    keys: [keys],
    purposes: ["group-membership", "group-disclosure"],
    license: lifecycleLicense.hash,
  }));

  const secret = await getDefaultSecretKeysAsBase64(owner);
  const verifier = new AssemblyVerifier({});
  const assemblyStore = new AssemblyStore({
    verifier,
    sign: unsigned => signAssembly(
      unsigned,
      ensureSecretSignKey(Buffer.from(secret.secretSignKey, "base64")),
    ),
  });
  const assemblyAdapter = new CertificateAssemblyAdapter(assemblyStore);
  lifecycle = new IssuerKeyLifecycleModel({
    owner,
    license: lifecycleLicense.hash,
    roots: [root.hash],
  });
  lifecycle.registerCertificateAssemblyAdapter(assemblyAdapter);
  await lifecycle.init();
  const lifecyclePlan = new IssuerKeyLifecyclePlan(lifecycle, lifecycleLicense.hash);
  const authorityNow = Date.now();
  for (const purpose of ["group-membership", "group-disclosure"]) {
    await lifecyclePlan.issueIssuerKeyCertificate({
      issuer: owner,
      subject: owner,
      subjectKeys: keys,
      purpose,
      validFrom: authorityNow - 60_000,
      validUntil: authorityNow + 3_600_000,
      rootAuthority: root.hash,
    });
  }

  const roster = await storeUnversionedObject({$type$: "HashGroup", person: new Set([owner])});
  const group = await storeVersionedObject({
    $type$: "Group",
    name: "e2e-project-team",
    owner,
    hashGroup: roster.hash,
  });
  const now = Date.now();
  const attestations = createProjektorAttestationService({issuerKeys: lifecycle});
  const projektor = new ProjektorTrustModel({
    attestations,
    receiver: owner,
    now: () => now,
  });
  const membership = await projektor.issueMembership({
    groupIdHash: group.idHash,
    hashGroup: roster.hash,
    person: owner,
    mayReshare: true,
    validFrom: now - 1_000,
    validUntil: now + 60_000,
    assertedAt: now,
  });
  await projektor.importMembershipBundle({bundleHash: membership.bundleHash});
  const effective = await projektor.getEffectiveMembership({
    groupIdHash: group.idHash,
    hashGroup: roster.hash,
    person: owner,
    validFrom: now - 1_000,
  });
  assert.equal(effective.obj.state, "current");
  assert.equal(effective.obj.mayReshare, true);

  const disclosure = await projektor.discloseGroup({
    groupIdHash: group.idHash,
    hashGroup: roster.hash,
    sharer: owner,
    recipient: owner,
    atTime: now + 1,
  });
  const verified = await projektor.verifyDisclosure({
    bundleHash: disclosure.bundleHash,
    atTime: now + 2,
  });
  assert.equal(verified.state, "verified");
  console.log("trust.projektor end-to-end tests passed");
} finally {
  await lifecycle?.shutdown();
  closeInstance();
  await rm(directory, {recursive: true, force: true});
}
