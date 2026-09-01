import {
  GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  GroupMembershipLicense,
} from "./membership.js";
import {
  GROUP_DISCLOSURE_CERTIFICATE_TYPE,
  GroupDisclosureLicense,
} from "./evidence.js";
import {
  PROJECT_ACCESS_ASSERTION_TYPE,
  ProjectAccessLicense,
} from "./project-access.js";
import {
  PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
  ProjektorEvidenceDisputeLicense,
} from "./disputes.js";

export const ProjektorAttestationDefinitions = Object.freeze([
  Object.freeze({
    type: GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
    license: GroupMembershipLicense,
    reverseMapProperty: "group",
  }),
  Object.freeze({
    type: GROUP_DISCLOSURE_CERTIFICATE_TYPE,
    license: GroupDisclosureLicense,
    reverseMapProperty: "group",
  }),
  Object.freeze({
    type: PROJECT_ACCESS_ASSERTION_TYPE,
    license: ProjectAccessLicense,
    reverseMapProperty: "group",
  }),
  Object.freeze({
    type: PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
    license: ProjektorEvidenceDisputeLicense,
    reverseMapProperty: "person",
  }),
]);
