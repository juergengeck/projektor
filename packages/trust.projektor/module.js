import {createProjektorAttestationService} from "./attestations.js";
import {ProjektorAttributionModel} from "./attribution-model.js";
import {ProjektorTrustModel} from "./membership-model.js";

export const PROJEKTOR_TRUST_CONFIG_TARGET = "ProjektorTrustConfig";
export const PROJEKTOR_ATTESTATION_IO_TARGET = "ProjektorAttestationIO";
export const PARTICIPATION_AUTHORSHIP_SIGNER_TARGET = "ParticipationAuthorshipSigner";
export const PARTICIPATION_AUTHORSHIP_VERIFIER_TARGET = "ParticipationAuthorshipVerifier";
export const ASSEMBLY_AUTHORSHIP_VERIFIER_TARGET = "AssemblyAuthorshipVerifier";
export const PROJEKTOR_ATTESTATION_SERVICE_TARGET = "ProjektorTypedAttestationService";
export const PROJEKTOR_TRUST_MODEL_TARGET = "ProjektorTrustModel";
export const PROJEKTOR_ATTRIBUTION_MODEL_TARGET = "ProjektorAttributionModel";
export const PROJEKTOR_TRUST_OPERATION_DOMAIN = "trust.projektor";

function requiredReceiver(receiver) {
  if (typeof receiver !== "string" || !/^[0-9a-f]{64}$/.test(receiver)) {
    throw new Error("[trust.projektor] ProjektorTrustConfig requires an exact receiver Person id hash");
  }
  return receiver;
}

function publicOperations(trust, attribution) {
  return Object.freeze({
    issueMembership: params => trust.issueMembership(params),
    importMembershipBundle: params => trust.importMembershipBundle(params),
    getEffectiveMembership: params => trust.getEffectiveMembership(params),
    authorizeDisclosure: params => trust.authorizeDisclosure(params),
    discloseGroup: params => trust.discloseGroup(params),
    verifyDisclosure: params => trust.verifyDisclosure(params),
    affirmOrRepudiate: params => attribution.affirmOrRepudiate(params),
    importActParticipationBundle: params => attribution.importActParticipationBundle(params),
    assessAct: params => attribution.assessAct(params),
    recordReliance: params => attribution.recordReliance(params),
    verifyReliance: params => attribution.verifyReliance(params),
  });
}

/**
 * Composes Projektor's domain trust models from narrow trust.core capabilities.
 *
 * The read-only AssemblyAuthorshipVerifier demand establishes causal authorship
 * without granting Projektor Assembly construction, storage or publication.
 */
export class ProjektorTrustModule {
  static demands = [
    {targetType: "EffectiveIssuerKeyProvider", required: true},
    {targetType: ASSEMBLY_AUTHORSHIP_VERIFIER_TARGET, required: true},
    {targetType: PROJEKTOR_TRUST_CONFIG_TARGET, required: true},
    {targetType: PROJEKTOR_ATTESTATION_IO_TARGET, required: false},
    {targetType: PARTICIPATION_AUTHORSHIP_SIGNER_TARGET, required: false},
    {targetType: PARTICIPATION_AUTHORSHIP_VERIFIER_TARGET, required: false},
    {targetType: "OperationRegistry", required: false},
  ];

  static supplies = [
    {targetType: PROJEKTOR_ATTESTATION_SERVICE_TARGET},
    {targetType: PROJEKTOR_TRUST_MODEL_TARGET},
    {targetType: PROJEKTOR_ATTRIBUTION_MODEL_TARGET},
  ];

  constructor() {
    this.name = "ProjektorTrustModule";
    this.dependencies = new Map();
    this.attestations = undefined;
    this.trustModel = undefined;
    this.attributionModel = undefined;
    this.operations = undefined;
  }

  setDependency(targetType, instance) {
    this.dependencies.set(targetType, instance);
  }

  async init() {
    const issuerKeys = this.dependencies.get("EffectiveIssuerKeyProvider");
    const assemblyAuthorshipVerifier = this.dependencies.get(ASSEMBLY_AUTHORSHIP_VERIFIER_TARGET);
    const config = this.dependencies.get(PROJEKTOR_TRUST_CONFIG_TARGET);
    if (!issuerKeys || !assemblyAuthorshipVerifier || !config) {
      throw new Error("[trust.projektor] ProjektorTrustModule missing required dependencies");
    }
    const receiver = requiredReceiver(config.receiver);
    const attestationIO = this.dependencies.get(PROJEKTOR_ATTESTATION_IO_TARGET) ?? {};
    for (const reserved of ["issuerKeys", "participationSigner", "participationVerifier"]) {
      if (Object.prototype.hasOwnProperty.call(attestationIO, reserved)) {
        throw new Error(`[trust.projektor] ${reserved} must be supplied through its capability demand`);
      }
    }
    this.attestations = createProjektorAttestationService({
      ...attestationIO,
      issuerKeys,
      participationSigner: this.dependencies.get(PARTICIPATION_AUTHORSHIP_SIGNER_TARGET),
      participationVerifier: this.dependencies.get(PARTICIPATION_AUTHORSHIP_VERIFIER_TARGET),
    });
    const shared = {attestations: this.attestations, receiver, now: config.now};
    this.trustModel = new ProjektorTrustModel({
      ...shared,
      storage: config.membershipStorage,
      selectGroupVersion: config.selectGroupVersion,
    });
    this.attributionModel = new ProjektorAttributionModel({
      ...shared,
      assemblyAuthorshipVerifier,
      storage: config.attributionStorage,
    });
    this.operations = publicOperations(this.trustModel, this.attributionModel);
  }

  async shutdown() {
    this.dependencies.get("OperationRegistry")?.unregister?.(PROJEKTOR_TRUST_OPERATION_DOMAIN);
    this.operations = undefined;
    this.attributionModel = undefined;
    this.trustModel = undefined;
    this.attestations = undefined;
  }

  emitSupplies(registry) {
    if (!this.attestations || !this.trustModel || !this.attributionModel || !this.operations) {
      throw new Error("[trust.projektor] ProjektorTrustModule has not been initialized");
    }
    registry.supply(PROJEKTOR_ATTESTATION_SERVICE_TARGET, this.attestations);
    registry.supply(PROJEKTOR_TRUST_MODEL_TARGET, this.trustModel);
    registry.supply(PROJEKTOR_ATTRIBUTION_MODEL_TARGET, this.attributionModel);
    this.dependencies.get("OperationRegistry")?.register?.(
      PROJEKTOR_TRUST_OPERATION_DOMAIN,
      this.operations,
      {
        category: "trust",
        description: "Projektor membership, disclosure, attribution and reliance operations",
        version: "1.0.0",
      },
    );
  }
}

export function createProjektorTrustModule() {
  return new ProjektorTrustModule();
}
