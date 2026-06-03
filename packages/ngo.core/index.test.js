import assert from "node:assert/strict";
import {
  addNgoDonor,
  addNgoParticipant,
  createNgoBackup,
  createNgoDemoProjectData,
  csvFromNgoDonations,
  csvFromNgoParticipants,
  csvFromNgoPeople,
  donorMetrics,
  participantMetrics,
  queryNgoDonors,
  queryNgoParticipants,
  restoreNgoBackup,
} from "./index.js";

const data = createNgoDemoProjectData();
const donorStats = donorMetrics(data);

assert.equal(donorStats.supporterCount, 3);
assert.equal(donorStats.totalReceived, 860);
assert.equal(donorStats.openThanks, 2);
assert.equal(donorStats.members, 2);
assert.equal(donorStats.recurringDonors, 1);
assert.equal(queryNgoDonors(data, { sort: "sum" })[0].name, "Murat Demir");
assert.equal(queryNgoDonors(data, { onlyOpen: true }).length, 2);

const participantStats = participantMetrics(data, "2026-06-03");
assert.equal(participantStats.participantCount, 3);
assert.equal(participantStats.withChildren, 1);
assert.equal(participantStats.inGermanCourse, 1);
assert.equal(participantStats.openVisaDeadlines, 2);

const minor = queryNgoParticipants(data, { search: "Sita" })[0];
assert.equal(minor.selfCommitmentRequired, false);
assert.equal(minor.selfCommitmentSigned, false);
assert.equal(minor.visaWarning, true);

const addedDonor = addNgoDonor(data, { name: "Projekt Freundin", isMember: true });
assert.equal(addedDonor.donors.length, 4);
assert.equal(addedDonor.donors.at(-1).isMember, true);

const addedParticipant = addNgoParticipant(data, { firstName: "Rina", lastName: "Gurung" });
assert.equal(addedParticipant.participants.length, 4);
assert.equal(addedParticipant.participants.at(-1).program.currentStage, "Erstkontakt");

assert.ok(csvFromNgoPeople(data).includes("Spendenquittung benötigt"));
assert.ok(csvFromNgoDonations(data).includes("Bildung / Ausbildung"));
assert.ok(csvFromNgoParticipants(data).includes("Selbstverpflichtung erforderlich"));

const backup = createNgoBackup(data);
assert.equal(restoreNgoBackup(backup).donors.length, data.donors.length);
