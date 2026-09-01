import assert from "node:assert/strict";
import "../../../one/packages/one.core/lib/system/load-nodejs.js";
import { addRecipeToRuntime, hasRecipe } from "../../../one/packages/one.core/lib/object-recipes.js";
import { calculateHashOfObj, calculateIdHashOfObj } from "../../../one/packages/one.core/lib/util/object.js";
import {
  addNgoDonor,
  addNgoDonation,
  addNgoDonationVersion,
  addNgoParticipant,
  createNgoDemoProjectData,
  createNgoProjectData,
  createNgoModule,
  createNgoRecipeRuntimeConfig,
  csvFromNgoDonations,
  csvFromNgoParticipants,
  csvFromNgoPeople,
  donorMetrics,
  participantMetrics,
  queryNgoDonors,
  queryNgoParticipants,
} from "./index.js";
import {
  createNgoOneCoreSupply,
  createNgoRefinioRuntimeConfig,
  initializeNgoModuleGraph,
} from "./refinio-api.js";

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

const addedDonation = addNgoDonation(data, {
  donorId: "donor-anne-keller",
  type: "Spende",
  amount: 25,
  date: "2026-06-03",
  purpose: "Material",
  thanked: false,
  now: 1780488000000,
});
assert.equal(data.donors.find((donor) => donor.id === "donor-anne-keller").donations.length, 3);
assert.equal(addedDonation.donor.donations.length, 4);
assert.equal(donorMetrics(addedDonation.data).totalReceived, 885);
assert.equal(csvFromNgoDonations(addedDonation.data).includes("Material"), true);

const addedParticipant = addNgoParticipant(data, { firstName: "Rina", lastName: "Gurung" });
assert.equal(addedParticipant.participants.length, 4);
assert.equal(addedParticipant.participants.at(-1).program.currentStage, "Erstkontakt");

assert.ok(csvFromNgoPeople(data).includes("Spendenquittung benötigt"));
assert.ok(csvFromNgoDonations(data).includes("Bildung / Ausbildung"));
assert.ok(csvFromNgoParticipants(data).includes("Selbstverpflichtung erforderlich"));
assert.match(csvFromNgoDonations(createNgoProjectData({
  donors: [
    {
      id: "donor-risky-export",
      name: "Risky Export",
      donations: [{ type: "Spende", amount: 1, date: "2026-06-03", purpose: "=HYPERLINK()" }],
    },
  ],
})), /"'=HYPERLINK\(\)"/);

const oneCore = {
  hasRecipe,
  addRecipeToRuntime,
  calculateHashOfObj,
  calculateIdHashOfObj,
};

const versionedDonation = await addNgoDonationVersion(data, {
  donorId: "donor-anne-keller",
  type: "Spende",
  amount: 25,
  date: "2026-06-03",
  purpose: "Material",
  thanked: false,
  now: 1780488000000,
}, oneCore);
assert.equal(versionedDonation.donor.donations.length, 4);
assert.equal(versionedDonation.one.previousDonor.idHash, versionedDonation.one.nextDonor.idHash);
assert.notEqual(versionedDonation.one.previousDonor.hash, versionedDonation.one.nextDonor.hash);
assert.equal(versionedDonation.one.donation.obj.$type$, "NgoDonation");
assert.equal(versionedDonation.one.change.obj.$type$, "NgoDonorChange");
assert.equal(versionedDonation.one.change.obj.donation, versionedDonation.one.donation.idHash);

const recipeRuntimeConfig = createNgoRecipeRuntimeConfig();
assert.ok(recipeRuntimeConfig.reverseMaps.get("NgoDonorChange").has("nextDonorVersion"));

const refinioRuntimeConfig = createNgoRefinioRuntimeConfig();
assert.ok(refinioRuntimeConfig.recipes.some((recipe) => recipe.name === "NgoDonor"));
assert.ok(refinioRuntimeConfig.recipes.some((recipe) => recipe.name === "ChannelInfo"));

const suppliedOneCore = createNgoOneCoreSupply({
  storeVersionedObject: undefined,
});
assert.equal(typeof suppliedOneCore.calculateHashOfObj, "function");

const registered = [];
const module = createNgoModule({ data });
module.setDependency("OneCore", oneCore);
module.setDependency("OperationRegistry", {
  register(name, plan, options) {
    registered.push([name, plan, options]);
  },
  unregister() {},
});
await module.init();
module.emitSupplies({
  supply(targetType, instance) {
    registered.push([targetType, instance]);
  },
});
assert.equal(registered.some(([name]) => name === "NgoPlan"), true);
assert.equal(registered.some(([name]) => name === "ngo"), true);

const graph = await initializeNgoModuleGraph({
  data,
  oneCore,
  storageFunction: undefined,
});
const graphPlan = graph.getSupply("NgoPlan");
assert.ok(graphPlan);
const graphResult = await graph.getOperationRegistry().execute("ngo", "getWorkspace");
assert.equal(graphResult.product.donors.length, 3);
await graph.shutdownAll();
