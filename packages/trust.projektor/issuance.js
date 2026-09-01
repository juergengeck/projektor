import {ProjektorTrustModel} from "./membership-model.js";

function model(attestations, options) {
  return new ProjektorTrustModel({attestations, ...options});
}

export function issueMembership(attestations, params, options) {
  return model(attestations, options).issueMembership(params);
}

export function importMembershipBundle(attestations, bundleHash, options = {}) {
  return model(attestations, options).importMembershipBundle({
    receiver: options.receiver,
    bundleHash,
  });
}

export function authorizeDisclosure(attestations, params, options) {
  return model(attestations, options).authorizeDisclosure(params);
}

export function discloseGroup(attestations, params, options) {
  return model(attestations, options).discloseGroup(params);
}

export function verifyDisclosure(attestations, bundleHash, atTime, options = {}) {
  return model(attestations, options).verifyDisclosure({
    receiver: options.receiver,
    bundleHash,
    atTime,
  });
}
