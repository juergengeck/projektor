import {getObject, storeUnversionedObject} from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {
  getObjectByIdObj,
  storeVersionedObject,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import {getAllEntries} from "../../../one/packages/one.core/lib/reverse-map-query.js";
import {
  ACT_ATTRIBUTION_ASSESSMENT_TYPE,
  ACT_PARTICIPATION_BUNDLE_TYPE,
  ACT_PARTICIPATION_PURPOSE,
  ACT_PARTICIPATION_STATEMENT_TYPE,
  ACT_PARTICIPATION_STATUS_TYPE,
  RELIANCE_BUNDLE_TYPE,
  RELIANCE_CERTIFICATE_TYPE,
  RELIANCE_PURPOSE,
  createActAttributionAssessment,
  createActParticipationStatementData,
  createActParticipationStatus,
  createAttributionBundle,
  createRelianceCertificateData,
} from "./attribution.js";

function storedHash(result, operation) {
  if (!result || typeof result.hash !== "string") {
    throw new Error(`${operation} did not return an object hash`);
  }
  return result.hash;
}

const defaultStorage = {
  getObject,
  async storeUnversioned(object) {
    return storedHash(await storeUnversionedObject(object), `storing ${object.$type$}`);
  },
  async storeVersioned(object) {
    return storedHash(await storeVersionedObject(object), `storing ${object.$type$}`);
  },
  getLatestByIdObj: getObjectByIdObj,
  async findReferencing(target, type, property) {
    const hashes = await getAllEntries(target, type);
    const results = [];
    for (const hash of [...new Set(hashes.map(String))].sort()) {
      const object = await getObject(hash);
      if (object.$type$ === type && same(object[property], target)) {
        results.push({hash, object});
      }
    }
    return results;
  },
};

function requireType(object, type, reference) {
  if (!object || object.$type$ !== type) {
    throw new Error(`${reference} must reference ${type}`);
  }
  return object;
}

function same(left, right) {
  return String(left) === String(right);
}

function rejected(rejectionCode) {
  return {state: "rejected", evidenceHashes: [], rejectionCode};
}

function isMissing(error) {
  return error?.name === "FileNotFoundError" || /not found|does not exist/i.test(error?.message ?? "");
}

export class ProjektorAttributionModel {
  constructor({
    attestations,
    assemblyAuthorshipVerifier,
    storage = defaultStorage,
    receiver,
    now = () => Date.now(),
  } = {}) {
    if (
      !attestations ||
      typeof attestations.attest !== "function" ||
      typeof attestations.verify !== "function" ||
      typeof attestations.findByType !== "function"
    ) {
      throw new Error("ProjektorAttributionModel requires a trust.core attestation facade");
    }
    if (!assemblyAuthorshipVerifier ||
      typeof assemblyAuthorshipVerifier.verifyAssemblyAuthorship !== "function") {
      throw new Error("ProjektorAttributionModel requires assembly.core authorship verification");
    }
    if (!receiver) throw new Error("ProjektorAttributionModel requires receiver");
    this.attestations = attestations;
    this.assemblyAuthorshipVerifier = assemblyAuthorshipVerifier;
    this.storage = storage;
    this.receiver = receiver;
    this.now = now;
  }

  async loadAttributedAct(actHash) {
    const act = await this.storage.getObject(actHash);
    if (act.$type$ === "Assembly") {
      const verified = await this.assemblyAuthorshipVerifier.verifyAssemblyAuthorship({
        assembly: actHash,
      });
      if (!same(verified.assembly, actHash) || !same(verified.signer, act.signer)) {
        throw new Error("assembly.core authorship result does not match the exact act");
      }
      return {act, baseTier: "custody", person: verified.signer};
    }
    if (
      act.$type$ !== "GroupMembershipAttestationBundle" &&
      act.$type$ !== "GroupDisclosureAttestationBundle"
    ) {
      throw new Error("act must reference an Assembly or supported Projektor attestation bundle");
    }
    if (act.attributionTier !== "custody" && act.attributionTier !== "participation-backed") {
      throw new Error("act bundle does not state its attribution tier");
    }
    const signature = requireType(
      await this.storage.getObject(act.signature),
      "Signature",
      "act.signature",
    );
    return {act, baseTier: act.attributionTier, person: signature.issuer};
  }

  async loadBundleGraph(bundleHash, bundleType, claimType) {
    const bundle = requireType(await this.storage.getObject(bundleHash), bundleType, "bundleHash");
    const claim = requireType(await this.storage.getObject(bundle.claim), claimType, "bundle.claim");
    requireType(await this.storage.getObject(bundle.signature), "Signature", "bundle.signature");
    requireType(await this.storage.getObject(bundle.signingKeys), "Keys", "bundle.signingKeys");
    if (!(bundle.issuerKeyBundles instanceof Set) || bundle.issuerKeyBundles.size === 0) {
      throw new Error("bundle.issuerKeyBundles must contain exact authority evidence");
    }
    for (const hash of bundle.issuerKeyBundles) {
      requireType(await this.storage.getObject(hash), "IssuerKeyCertificateBundle", "bundle.issuerKeyBundles");
    }
    if (!(bundle.participationEvidence instanceof Set)) {
      throw new Error("bundle.participationEvidence must be an exact evidence set");
    }
    for (const hash of bundle.participationEvidence) await this.storage.getObject(hash);
    return {bundle, claim};
  }

  async affirmOrRepudiate({act, person, value, statedAt = this.now()} = {}) {
    const attributed = await this.loadAttributedAct(act);
    if (!same(attributed.person, person)) {
      throw new Error("only the person attributed to an act may affirm or repudiate it");
    }
    const authored = await this.attestations.attest({
      type: ACT_PARTICIPATION_STATEMENT_TYPE,
      certData: createActParticipationStatementData({act, person, value, statedAt}),
      issuer: person,
      purpose: ACT_PARTICIPATION_PURPOSE,
      assertedAt: statedAt,
      attributionTier: "participation-backed",
    });
    const bundleHash = await this.storage.storeUnversioned(
      createAttributionBundle(ACT_PARTICIPATION_BUNDLE_TYPE, authored),
    );
    return {claimHash: authored.claimHash, bundleHash};
  }

  async importActParticipationBundle({receiver = this.receiver, bundleHash} = {}) {
    const {bundle, claim} = await this.loadBundleGraph(
      bundleHash,
      ACT_PARTICIPATION_BUNDLE_TYPE,
      ACT_PARTICIPATION_STATEMENT_TYPE,
    );
    let result;
    if (
      bundle.purpose !== ACT_PARTICIPATION_PURPOSE ||
      bundle.authoredAt !== claim.statedAt ||
      bundle.attributionTier !== "participation-backed" ||
      bundle.participationEvidence.size === 0
    ) {
      result = rejected("participation-bundle-metadata-mismatch");
    } else {
      const attributed = await this.loadAttributedAct(claim.act);
      if (!same(attributed.person, claim.person)) {
        result = rejected("statement-person-is-not-act-signer");
      } else {
        result = await this.attestations.verify({
          receiver,
          claimHash: bundle.claim,
          signatureHash: bundle.signature,
          signingKeysHash: bundle.signingKeys,
          issuerKeyBundleHashes: [...bundle.issuerKeyBundles],
          expectedIssuer: claim.person,
          purpose: ACT_PARTICIPATION_PURPOSE,
          authorityMode: "evidence-time",
          atTime: bundle.authoredAt,
          attributionTier: bundle.attributionTier,
          participationEvidenceHashes: [...bundle.participationEvidence],
        });
      }
    }
    return this.storage.storeVersioned(createActParticipationStatus({
      receiver,
      bundle: bundleHash,
      result,
      evaluatedAt: this.now(),
    }));
  }

  async assessAct({receiver = this.receiver, act, person, asOfTime} = {}) {
    const attributed = await this.loadAttributedAct(act);
    if (!same(attributed.person, person)) {
      throw new Error("assessment person must be the person attributed to the act");
    }
    if (asOfTime !== this.now()) {
      throw new Error("new assessments must be made at the current decision time");
    }
    const statements = [];
    const statementBundles = [];
    const statementStatuses = [];
    const claimHashes = await this.attestations.findByType({
      subject: act,
      type: ACT_PARTICIPATION_STATEMENT_TYPE,
    });
    for (const candidateHash of claimHashes) {
      const candidate = requireType(
        await this.storage.getObject(candidateHash),
        ACT_PARTICIPATION_STATEMENT_TYPE,
        "typed participation lookup",
      );
      if (!same(candidate.person, person) || candidate.statedAt > asOfTime) continue;
      const bundles = await this.storage.findReferencing(
        candidateHash,
        ACT_PARTICIPATION_BUNDLE_TYPE,
        "claim",
      );
      for (const candidateBundle of bundles) {
        let latest;
        try {
          latest = await this.storage.getLatestByIdObj({
            $type$: ACT_PARTICIPATION_STATUS_TYPE,
            receiver,
            bundle: candidateBundle.hash,
          });
        } catch (error) {
          if (isMissing(error)) continue;
          throw error;
        }
        const status = latest.obj ?? latest;
        if (status.evaluatedAt > asOfTime) continue;
        const {bundle, claim} = await this.loadBundleGraph(
          candidateBundle.hash,
          ACT_PARTICIPATION_BUNDLE_TYPE,
          ACT_PARTICIPATION_STATEMENT_TYPE,
        );
        if (
          !same(claim.act, act) ||
          !same(claim.person, person) ||
          !same(status.receiver, receiver) ||
          !same(status.bundle, candidateBundle.hash) ||
          bundle.authoredAt !== claim.statedAt
        ) {
          throw new Error("stored participation evidence crosses its attribution boundary");
        }
        statementBundles.push(candidateBundle.hash);
        statementStatuses.push(latest.hash ?? latest.$hash$);
        if (status.state === "verified") statements.push(claim);
      }
    }
    const assessment = createActAttributionAssessment({
      receiver,
      act,
      person,
      asOfTime,
      baseTier: attributed.baseTier,
      statements,
      statementBundles,
      statementStatuses,
    });
    const assessmentHash = await this.storage.storeUnversioned(assessment);
    return {assessmentHash, assessment};
  }

  async recordReliance({relyingParty, assessmentHash, reliedAt} = {}) {
    const assessment = requireType(
      await this.storage.getObject(assessmentHash),
      ACT_ATTRIBUTION_ASSESSMENT_TYPE,
      "assessmentHash",
    );
    if (!same(assessment.receiver, relyingParty)) {
      throw new Error("reliance must use the relying party's own receiver-local assessment");
    }
    const certData = createRelianceCertificateData({
      assessment: {...assessment, hash: assessmentHash},
      relyingParty,
      reliedAt,
    });
    const authored = await this.attestations.attest({
      type: RELIANCE_CERTIFICATE_TYPE,
      certData,
      issuer: relyingParty,
      purpose: RELIANCE_PURPOSE,
      assertedAt: reliedAt,
      attributionTier: "participation-backed",
    });
    const bundleHash = await this.storage.storeUnversioned(
      createAttributionBundle(RELIANCE_BUNDLE_TYPE, authored),
    );
    return {claimHash: authored.claimHash, bundleHash};
  }

  async verifyReliance({receiver = this.receiver, bundleHash} = {}) {
    const {bundle, claim} = await this.loadBundleGraph(
      bundleHash,
      RELIANCE_BUNDLE_TYPE,
      RELIANCE_CERTIFICATE_TYPE,
    );
    const assessment = requireType(
      await this.storage.getObject(claim.assessment),
      ACT_ATTRIBUTION_ASSESSMENT_TYPE,
      "claim.assessment",
    );
    if (
      bundle.purpose !== RELIANCE_PURPOSE ||
      bundle.authoredAt !== claim.reliedAt ||
      bundle.attributionTier !== "participation-backed" ||
      assessment.asOfTime !== claim.reliedAt ||
      !same(assessment.receiver, claim.relyingParty) ||
      !same(assessment.act, claim.act) ||
      !same(assessment.person, claim.attributedPerson) ||
      assessment.effectiveTier !== claim.tierAtReliance ||
      assessment.state !== claim.statementStateAtReliance
    ) {
      return rejected("reliance-bundle-metadata-mismatch");
    }
    return this.attestations.verify({
      receiver,
      claimHash: bundle.claim,
      signatureHash: bundle.signature,
      signingKeysHash: bundle.signingKeys,
      issuerKeyBundleHashes: [...bundle.issuerKeyBundles],
      expectedIssuer: claim.relyingParty,
      purpose: RELIANCE_PURPOSE,
      authorityMode: "evidence-time",
      atTime: bundle.authoredAt,
      attributionTier: bundle.attributionTier,
      participationEvidenceHashes: [...bundle.participationEvidence],
    });
  }
}
