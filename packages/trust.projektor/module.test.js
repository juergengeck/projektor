import assert from "node:assert/strict";
import {
  ASSEMBLY_AUTHORSHIP_VERIFIER_TARGET,
  PARTICIPATION_AUTHORSHIP_SIGNER_TARGET,
  PARTICIPATION_AUTHORSHIP_VERIFIER_TARGET,
  PROJEKTOR_ATTESTATION_SERVICE_TARGET,
  PROJEKTOR_ATTRIBUTION_MODEL_TARGET,
  PROJEKTOR_TRUST_CONFIG_TARGET,
  PROJEKTOR_TRUST_MODEL_TARGET,
  PROJEKTOR_TRUST_OPERATION_DOMAIN,
  ProjektorTrustModule,
  createProjektorTrustModule,
} from "./index.js";

const hash = character => character.repeat(64);
const issuerKeys = {kind: "exact-issuer-key-provider"};
const assemblyAuthorshipVerifier = {verifyAssemblyAuthorship: async () => { throw new Error("not called"); }};
const participationSigner = {sign: async () => { throw new Error("not called"); }};
const participationVerifier = {verify: async () => { throw new Error("not called"); }};
const registered = [];
const unregistered = [];
const supplied = new Map();

assert.equal(
  ProjektorTrustModule.demands.some(demand => demand.targetType === "AssemblyStore"),
  false,
);
assert.equal(
  ProjektorTrustModule.demands.some(demand => demand.targetType === "LeuteModel"),
  false,
);

const module = createProjektorTrustModule();
module.setDependency("EffectiveIssuerKeyProvider", issuerKeys);
module.setDependency(ASSEMBLY_AUTHORSHIP_VERIFIER_TARGET, assemblyAuthorshipVerifier);
module.setDependency(PROJEKTOR_TRUST_CONFIG_TARGET, {receiver: hash("1")});
module.setDependency(PARTICIPATION_AUTHORSHIP_SIGNER_TARGET, participationSigner);
module.setDependency(PARTICIPATION_AUTHORSHIP_VERIFIER_TARGET, participationVerifier);
module.setDependency("OperationRegistry", {
  register(...args) { registered.push(args); },
  unregister(name) { unregistered.push(name); },
});
await module.init();
module.emitSupplies({supply(target, instance) { supplied.set(target, instance); }});

assert.equal(supplied.get(PROJEKTOR_ATTESTATION_SERVICE_TARGET), module.attestations);
assert.equal(supplied.get(PROJEKTOR_TRUST_MODEL_TARGET), module.trustModel);
assert.equal(supplied.get(PROJEKTOR_ATTRIBUTION_MODEL_TARGET), module.attributionModel);
assert.equal(module.trustModel.attestations, module.attributionModel.attestations);
assert.equal(module.attributionModel.assemblyAuthorshipVerifier, assemblyAuthorshipVerifier);
assert.equal(module.attestations.issuerKeys, issuerKeys);
assert.equal(module.attestations.participationSigner, participationSigner);
assert.equal(module.attestations.participationVerifier, participationVerifier);
assert.equal(registered.length, 1);
assert.equal(registered[0][0], PROJEKTOR_TRUST_OPERATION_DOMAIN);
assert.equal(typeof registered[0][1].issueMembership, "function");
assert.equal(typeof registered[0][1].assessAct, "function");

await module.shutdown();
assert.deepEqual(unregistered, [PROJEKTOR_TRUST_OPERATION_DOMAIN]);

const missing = createProjektorTrustModule();
await assert.rejects(missing.init(), /missing required dependencies/);

const invalidReceiver = createProjektorTrustModule();
invalidReceiver.setDependency("EffectiveIssuerKeyProvider", issuerKeys);
invalidReceiver.setDependency(ASSEMBLY_AUTHORSHIP_VERIFIER_TARGET, assemblyAuthorshipVerifier);
invalidReceiver.setDependency(PROJEKTOR_TRUST_CONFIG_TARGET, {receiver: "me"});
await assert.rejects(invalidReceiver.init(), /exact receiver Person id hash/);

const hiddenAuthority = createProjektorTrustModule();
hiddenAuthority.setDependency("EffectiveIssuerKeyProvider", issuerKeys);
hiddenAuthority.setDependency(ASSEMBLY_AUTHORSHIP_VERIFIER_TARGET, assemblyAuthorshipVerifier);
hiddenAuthority.setDependency(PROJEKTOR_TRUST_CONFIG_TARGET, {receiver: hash("2")});
hiddenAuthority.setDependency("ProjektorAttestationIO", {issuerKeys: {}});
await assert.rejects(hiddenAuthority.init(), /capability demand/);

console.log("trust.projektor ModuleRegistry composition test passed");
