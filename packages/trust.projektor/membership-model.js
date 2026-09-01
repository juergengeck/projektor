import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { storeUnversionedObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {
  getObjectByIdHash,
  getObjectByIdObj,
  storeVersionedObject,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { getOnlyLatestReferencingObjsHashAndId } from "../../../one/packages/one.core/lib/reverse-map-query.js";
import { groupVersionAsOf } from "../group.core/index.js";
import {
  EFFECTIVE_GROUP_MEMBERSHIP_TYPE,
  GROUP_DISCLOSURE_BUNDLE_TYPE,
  GROUP_DISCLOSURE_CERTIFICATE_TYPE,
  GROUP_MEMBERSHIP_BUNDLE_TYPE,
  createDisclosureBundle,
  createDisclosureCertificateData,
  createMembershipBundle,
  createMembershipStatus,
} from "./evidence.js";
import {
  GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  createGroupMembershipCertificateData,
  effectiveMembershipWindow,
  isMembershipValidAt,
} from "./membership.js";

const MEMBERSHIP_PURPOSE = "group-membership";
const DISCLOSURE_PURPOSE = "group-disclosure";

function hashOf(result, operation) {
  if (!result || typeof result.hash !== "string") {
    throw new Error(`${operation} did not return an object hash`);
  }
  return result.hash;
}

function isMissing(error) {
  return error?.name === "FileNotFoundError" || /not found|does not exist/i.test(error?.message ?? "");
}

function sameSet(left, right) {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every(value => b.has(value));
}

const defaultStorage = {
  getObject,
  getLatestByIdHash: getObjectByIdHash,
  getLatestByIdObj: getObjectByIdObj,
  async storeUnversioned(object) {
    return hashOf(await storeUnversionedObject(object), `storing ${object.$type$}`);
  },
  async storeVersioned(object) {
    return hashOf(await storeVersionedObject(object), `storing ${object.$type$}`);
  },
  async findLatestReferencing(target, type) {
    const entries = await getOnlyLatestReferencingObjsHashAndId(target, type);
    return Promise.all(entries.map(async entry => ({
      hash: typeof entry === "string" ? entry : entry.hash,
      object: await getObject(typeof entry === "string" ? entry : entry.hash),
    })));
  },
};

function requireType(object, type, reference) {
  if (!object || object.$type$ !== type) {
    throw new Error(`${reference} must reference ${type}`);
  }
  return object;
}

function rejected(rejectionCode) {
  return {state: "rejected", evidenceHashes: [], rejectionCode};
}

export class ProjektorTrustModel {
  constructor({
    attestations,
    storage = defaultStorage,
    now = () => Date.now(),
    receiver,
    selectGroupVersion = groupVersionAsOf,
  } = {}) {
    if (!attestations || typeof attestations.attest !== "function" || typeof attestations.verify !== "function") {
      throw new Error("ProjektorTrustModel requires a trust.core attestation facade");
    }
    this.attestations = attestations;
    this.storage = storage;
    this.now = now;
    this.receiver = receiver;
    this.selectGroupVersion = selectGroupVersion;
  }

  async groupAt(groupIdHash, atTime) {
    const selected = await this.selectGroupVersion(groupIdHash, atTime);
    if (!selected) throw new Error(`Group ${groupIdHash} did not exist at ${atTime}`);
    if (!selected.group.owner) throw new Error(`Group ${groupIdHash} has no owner`);
    return selected;
  }

  async loadBundleGraph(bundleHash, bundleType, claimType) {
    const bundle = requireType(await this.storage.getObject(bundleHash), bundleType, "bundleHash");
    const claim = requireType(await this.storage.getObject(bundle.claim), claimType, "bundle.claim");
    requireType(await this.storage.getObject(bundle.signature), "Signature", "bundle.signature");
    requireType(await this.storage.getObject(bundle.signingKeys), "Keys", "bundle.signingKeys");
    if (!(bundle.issuerKeyBundles instanceof Set) || bundle.issuerKeyBundles.size === 0) {
      throw new Error("bundle.issuerKeyBundles must contain exact issuer authority evidence");
    }
    for (const hash of bundle.issuerKeyBundles) {
      requireType(await this.storage.getObject(hash), "IssuerKeyCertificateBundle", "bundle.issuerKeyBundles");
    }
    if (bundle.assemblyOccurrence) {
      requireType(await this.storage.getObject(bundle.assemblyOccurrence), "Assembly", "bundle.assemblyOccurrence");
    }
    return {bundle, claim};
  }

  async issueMembership(params) {
    const assertedAt = params.assertedAt ?? this.now();
    const selected = await this.groupAt(params.groupIdHash, assertedAt);
    if (String(selected.group.hashGroup) !== String(params.hashGroup)) {
      throw new Error("Membership must name the Group roster in force at assertedAt");
    }
    const roster = requireType(await this.storage.getObject(params.hashGroup), "HashGroup", "hashGroup");
    if (!roster.person.has(params.person)) {
      throw new Error("Membership subject is not in the named HashGroup");
    }
    const certData = createGroupMembershipCertificateData({
      group: params.groupIdHash,
      hashGroup: params.hashGroup,
      person: params.person,
      mayReshare: params.mayReshare,
      issuedAt: assertedAt,
      validFrom: params.validFrom,
      validUntil: params.validUntil,
    });
    const authored = await this.attestations.attest({
      type: GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
      certData,
      issuer: selected.group.owner,
      purpose: MEMBERSHIP_PURPOSE,
      assertedAt,
    });
    const bundleHash = await this.storage.storeUnversioned(createMembershipBundle(authored));
    return {claimHash: authored.claimHash, bundleHash};
  }

  async importMembershipBundle({receiver = this.receiver, bundleHash} = {}) {
    if (!receiver) throw new Error("importMembershipBundle requires receiver");
    const {bundle, claim} = await this.loadBundleGraph(
      bundleHash,
      GROUP_MEMBERSHIP_BUNDLE_TYPE,
      GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
    );
    const selected = await this.groupAt(claim.group, bundle.authoredAt);
    let result;
    if (bundle.purpose !== MEMBERSHIP_PURPOSE || bundle.authoredAt !== claim.issuedAt) {
      result = rejected("membership-bundle-metadata-mismatch");
    } else if (String(selected.group.hashGroup) !== String(claim.hashGroup)) {
      result = rejected("group-roster-mismatch");
    } else {
      const roster = requireType(await this.storage.getObject(claim.hashGroup), "HashGroup", "claim.hashGroup");
      if (!roster.person.has(claim.person)) {
        result = rejected("subject-not-in-roster");
      } else {
        result = await this.attestations.verify({
          receiver,
          claimHash: bundle.claim,
          signatureHash: bundle.signature,
          signingKeysHash: bundle.signingKeys,
          issuerKeyBundleHashes: [...bundle.issuerKeyBundles],
          expectedIssuer: selected.group.owner,
          purpose: MEMBERSHIP_PURPOSE,
          authorityMode: "evidence-time",
          atTime: bundle.authoredAt,
          assemblyOccurrence: bundle.assemblyOccurrence,
        });
      }
    }
    const statusHash = await this.storage.storeVersioned(createMembershipStatus({
      receiver,
      bundle: bundleHash,
      result,
      evaluatedAt: this.now(),
    }));
    await this.reduceMembership({receiver, bundleHash, statusHash, bundle, claim, result});
    return statusHash;
  }

  async loadLatestStatus(receiver, bundleHash) {
    return this.storage.getLatestByIdObj({
      $type$: "GroupMembershipBundleStatus",
      receiver,
      bundle: bundleHash,
    });
  }

  async loadProjection(idObject) {
    try {
      return await this.storage.getLatestByIdObj(idObject);
    } catch (error) {
      if (isMissing(error)) return undefined;
      throw error;
    }
  }

  async reduceMembership({receiver, bundleHash, statusHash, bundle, claim, result}) {
    const idObject = {
      $type$: EFFECTIVE_GROUP_MEMBERSHIP_TYPE,
      receiver,
      group: claim.group,
      hashGroup: claim.hashGroup,
      person: claim.person,
      validFrom: claim.validFrom,
    };
    const previous = await this.loadProjection(idObject);
    const bundleHashes = new Set(previous?.obj?.sourceBundles ?? []);
    bundleHashes.add(bundleHash);

    const verified = [];
    const statusHashes = new Set();
    let conflicted = false;
    for (const candidateHash of bundleHashes) {
      const candidateBundle = candidateHash === bundleHash
        ? bundle
        : requireType(await this.storage.getObject(candidateHash), GROUP_MEMBERSHIP_BUNDLE_TYPE, "sourceBundles");
      const candidateClaim = candidateHash === bundleHash
        ? claim
        : requireType(await this.storage.getObject(candidateBundle.claim), GROUP_MEMBERSHIP_CERTIFICATE_TYPE, "source bundle claim");
      if (
        String(candidateClaim.group) !== String(claim.group) ||
        String(candidateClaim.hashGroup) !== String(claim.hashGroup) ||
        String(candidateClaim.person) !== String(claim.person) ||
        candidateClaim.validFrom !== claim.validFrom
      ) {
        throw new Error("Effective membership source crosses lineage boundaries");
      }
      const latest = candidateHash === bundleHash
        ? {hash: statusHash, obj: {...createMembershipStatus({receiver, bundle: bundleHash, result, evaluatedAt: this.now()})}}
        : await this.loadLatestStatus(receiver, candidateHash);
      statusHashes.add(latest.hash);
      if (latest.obj.state === "verified") verified.push(candidateClaim);
      if (/conflict/i.test(latest.obj.rejectionCode ?? "")) conflicted = true;
    }

    let window;
    if (verified.length > 0) {
      window = effectiveMembershipWindow(verified);
    } else if (previous) {
      window = {validUntil: previous.obj.validUntil, mayReshare: previous.obj.mayReshare};
    } else if (conflicted) {
      window = {validUntil: claim.validUntil, mayReshare: claim.mayReshare};
    } else {
      return undefined;
    }
    return this.storage.storeVersioned({
      ...idObject,
      $version$: "1",
      state: conflicted ? "conflicted" : verified.length > 0 ? "current" : "non-current",
      validUntil: window.validUntil,
      mayReshare: window.mayReshare,
      sourceBundles: bundleHashes,
      sourceStatuses: statusHashes,
      evaluatedAt: this.now(),
    });
  }

  async getEffectiveMembership(params) {
    const result = await this.loadProjection({
      $type$: EFFECTIVE_GROUP_MEMBERSHIP_TYPE,
      receiver: params.receiver ?? this.receiver,
      group: params.groupIdHash,
      hashGroup: params.hashGroup,
      person: params.person,
      validFrom: params.validFrom,
    });
    return result;
  }

  async authorizeDisclosure({receiver = this.receiver, groupIdHash, hashGroup, sharer, atTime} = {}) {
    if (!receiver) throw new Error("authorizeDisclosure requires receiver");
    const selected = await this.groupAt(groupIdHash, atTime);
    if (String(selected.group.hashGroup) !== String(hashGroup)) {
      throw new Error("Disclosure roster is not the Group roster in force at atTime");
    }
    const roster = requireType(await this.storage.getObject(hashGroup), "HashGroup", "hashGroup");
    if (!roster.person.has(sharer)) throw new Error("Sharer is not in the named roster");

    const candidates = await this.storage.findLatestReferencing(groupIdHash, EFFECTIVE_GROUP_MEMBERSHIP_TYPE);
    const eligible = candidates.filter(({object}) =>
      String(object.receiver) === String(receiver) &&
      String(object.hashGroup) === String(hashGroup) &&
      String(object.person) === String(sharer) &&
      object.state === "current" &&
      object.mayReshare === true &&
      isMembershipValidAt(object, atTime)
    );
    if (eligible.length === 0) throw new Error("No effective membership authorizes this disclosure");
    eligible.sort((left, right) => right.object.validFrom - left.object.validFrom || left.hash.localeCompare(right.hash));
    return {projectionHash: eligible[0].hash, projection: eligible[0].object};
  }

  async discloseGroup(params) {
    const authorization = await this.authorizeDisclosure(params);
    const certData = createDisclosureCertificateData({
      group: params.groupIdHash,
      hashGroup: params.hashGroup,
      recipient: params.recipient,
      sharer: params.sharer,
      disclosedAt: params.atTime,
      authorizingProjection: authorization.projectionHash,
      membershipBundles: authorization.projection.sourceBundles,
      membershipStatuses: authorization.projection.sourceStatuses,
    });
    const authored = await this.attestations.attest({
      type: GROUP_DISCLOSURE_CERTIFICATE_TYPE,
      certData,
      issuer: params.sharer,
      purpose: DISCLOSURE_PURPOSE,
      assertedAt: params.atTime,
    });
    const bundleHash = await this.storage.storeUnversioned(createDisclosureBundle(authored));
    return {claimHash: authored.claimHash, bundleHash};
  }

  async verifyDisclosure({receiver = this.receiver, bundleHash, atTime} = {}) {
    if (!receiver) throw new Error("verifyDisclosure requires receiver");
    const {bundle, claim} = await this.loadBundleGraph(
      bundleHash,
      GROUP_DISCLOSURE_BUNDLE_TYPE,
      GROUP_DISCLOSURE_CERTIFICATE_TYPE,
    );
    if (claim.disclosedAt > atTime) return rejected("disclosure-from-future");
    if (bundle.purpose !== DISCLOSURE_PURPOSE || bundle.authoredAt !== claim.disclosedAt) {
      return rejected("disclosure-bundle-metadata-mismatch");
    }
    const disclosureVerification = await this.attestations.verify({
      receiver,
      claimHash: bundle.claim,
      signatureHash: bundle.signature,
      signingKeysHash: bundle.signingKeys,
      issuerKeyBundleHashes: [...bundle.issuerKeyBundles],
      expectedIssuer: claim.sharer,
      purpose: DISCLOSURE_PURPOSE,
      authorityMode: "evidence-time",
      atTime: bundle.authoredAt,
      assemblyOccurrence: bundle.assemblyOccurrence,
    });
    if (disclosureVerification.state !== "verified") return disclosureVerification;

    const selected = await this.groupAt(claim.group, claim.disclosedAt);
    if (String(selected.group.hashGroup) !== String(claim.hashGroup)) {
      return rejected("disclosure-roster-not-in-force");
    }
    const roster = requireType(
      await this.storage.getObject(claim.hashGroup),
      "HashGroup",
      "claim.hashGroup",
    );
    if (!roster.person.has(claim.sharer)) return rejected("sharer-not-in-roster");

    const projection = requireType(
      await this.storage.getObject(claim.authorizingProjection),
      EFFECTIVE_GROUP_MEMBERSHIP_TYPE,
      "claim.authorizingProjection",
    );
    if (
      String(projection.group) !== String(claim.group) ||
      String(projection.hashGroup) !== String(claim.hashGroup) ||
      String(projection.person) !== String(claim.sharer) ||
      projection.state !== "current" ||
      projection.mayReshare !== true ||
      !isMembershipValidAt(projection, claim.disclosedAt) ||
      !sameSet(projection.sourceBundles, claim.membershipBundles) ||
      !sameSet(projection.sourceStatuses, claim.membershipStatuses)
    ) {
      return rejected("invalid-disclosure-provenance");
    }
    const statusBundles = new Set();
    for (const statusHash of claim.membershipStatuses) {
      const status = requireType(await this.storage.getObject(statusHash), "GroupMembershipBundleStatus", "membershipStatuses");
      if (status.state !== "verified") return rejected("membership-status-not-verified");
      statusBundles.add(status.bundle);
    }
    if (!sameSet(statusBundles, claim.membershipBundles)) {
      return rejected("membership-status-bundle-mismatch");
    }

    const membershipClaims = [];
    const membershipEvidence = [];
    for (const membershipBundleHash of claim.membershipBundles) {
      const graph = await this.loadBundleGraph(
        membershipBundleHash,
        GROUP_MEMBERSHIP_BUNDLE_TYPE,
        GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
      );
      if (
        String(graph.claim.group) !== String(claim.group) ||
        String(graph.claim.hashGroup) !== String(claim.hashGroup) ||
        String(graph.claim.person) !== String(claim.sharer) ||
        graph.bundle.purpose !== MEMBERSHIP_PURPOSE ||
        graph.bundle.authoredAt !== graph.claim.issuedAt
      ) {
        return rejected("membership-bundle-does-not-authorize-disclosure");
      }
      const membershipGroup = await this.groupAt(graph.claim.group, graph.bundle.authoredAt);
      if (String(membershipGroup.group.hashGroup) !== String(graph.claim.hashGroup)) {
        return rejected("membership-roster-not-in-force");
      }
      const membershipVerification = await this.attestations.verify({
        receiver,
        claimHash: graph.bundle.claim,
        signatureHash: graph.bundle.signature,
        signingKeysHash: graph.bundle.signingKeys,
        issuerKeyBundleHashes: [...graph.bundle.issuerKeyBundles],
        expectedIssuer: membershipGroup.group.owner,
        purpose: MEMBERSHIP_PURPOSE,
        authorityMode: "evidence-time",
        atTime: graph.bundle.authoredAt,
        assemblyOccurrence: graph.bundle.assemblyOccurrence,
      });
      if (membershipVerification.state !== "verified") return membershipVerification;
      membershipClaims.push(graph.claim);
      membershipEvidence.push(...membershipVerification.evidenceHashes);
    }
    const effective = effectiveMembershipWindow(membershipClaims);
    if (
      effective.mayReshare !== true ||
      !(effective.validFrom <= claim.disclosedAt && claim.disclosedAt < effective.validUntil)
    ) {
      return rejected("membership-does-not-permit-disclosure");
    }
    return {
      state: "verified",
      evidenceHashes: [...new Set([
        ...disclosureVerification.evidenceHashes,
        ...membershipEvidence,
      ])].sort(),
    };
  }
}

export {MEMBERSHIP_PURPOSE, DISCLOSURE_PURPOSE};
