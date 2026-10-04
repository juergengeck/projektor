import test from "node:test";
import assert from "node:assert/strict";
import { IGM, AMWAY, EK } from "./brand.ts";
import { createLabObjects, createLabRecipes } from "./recipes.ts";
import { createProjection } from "./projection.ts";

const H = (ch: string) => ch.repeat(64);
const admin = H("a"), manager = H("b"), seller = H("c"), customer = H("d"), dept = H("e");
const offerHash = H("1"), offerVersion = H("2"), handoff = H("3");
const objects = createLabObjects(IGM);
const { types, recipes, reverseMapsForIdObjects } = createLabRecipes(IGM);
const department = objects.createDepartment({ department: "acceptance-test", name: "Acceptance", admin });
const assignments = [objects.createRoleAssignment({ department: dept, subject: manager, role: "manager", issuer: admin, validFrom: 1 }),
  objects.createRoleAssignment({ department: dept, subject: seller, role: "seller", issuer: admin, validFrom: 1 }),
  objects.createRoleAssignment({ department: dept, subject: customer, role: "customer", issuer: admin, validFrom: 1 })];
const offer = objects.createOffer({ department: dept, offerId: "upstream", item: "ITEM", priceList: "p", channel: "facility", unitAmount: 200, currency: "EUR", publishedBy: admin });
const share = objects.createOfferShare({ department: dept, offer: offerHash, recipient: seller, recipientRole: "seller", sharedBy: manager, sharedAt: 2 });
const managerAcceptance = objects.createOfferAcceptance({ department: dept, idempotencyKey: "manager", offer: offerHash, offerVersion,
  handoff: offerVersion, offerId: offer.offerId, quantity: 4, acceptedBy: manager, acceptedFrom: admin, acceptedAt: 3, unitAmount: 200, currency: "EUR" });
const sellerAcceptance = objects.createOfferAcceptance({ ...managerAcceptance, idempotencyKey: "seller", handoff, acceptedBy: seller, acceptedFrom: manager });
const state = { department, deptIdHash: dept, assignments, contacts: [], offers: [offer], orders: [], stock: [], atTime: 5,
  offerVersions: { [offerVersion]: { offer, idHash: offerHash } }, offerHandoffs: { [handoff]: share }, offerShares: [share], offerIdHashes: { upstream: offerHash }, offerAcceptances: [managerAcceptance, sellerAcceptance] };
const { projectDepartment, canPublish, audience } = createProjection(IGM);

test("acceptance recipe replicates department, offer identity, exact agreed offer, and exact handoff", () => {
  const recipe = recipes.find(recipe => recipe.name === types.OfferAcceptance)!;
  for (const [field, type, allowed] of [["department", "referenceToId", types.Department], ["offer", "referenceToId", types.Offer],
    ["offerVersion", "referenceToObj", types.Offer], ["handoff", "referenceToObj", types.OfferShare]]) {
    const rule = recipe.rule.find(rule => rule.itemprop === field)!;
    const ref = rule.itemtype as { type: string; allowedTypes: Set<string> };
    assert.equal(ref.type, type);
    assert.ok(ref.allowedTypes.has(allowed));
  }
  assert.deepEqual([...new Map(reverseMapsForIdObjects).get(types.OfferAcceptance)!], ["department"]);
  assert.throws(() => objects.createOfferAcceptance({ ...managerAcceptance, quantity: 0 }), /quantity/);
  assert.throws(() => objects.createOfferAcceptance({ ...managerAcceptance, offer: "upstream" }), /offer must be a SHA/);
});

test("IGM intermediate roles accept and upstream plus acceptor see history without accounting", () => {
  for (const viewer of [admin, manager]) {
    const projection = projectDepartment({ ...state, viewer });
    assert.equal(projection.offerAcceptances.length, 2);
    assert.deepEqual(projection.orders, []);
    assert.deepEqual(projection.balances, []);
    assert.equal(projection.availability?.available, 0, "acceptance does not require or deduct inventory");
    assert.deepEqual(projection.rejected, []);
  }
  assert.equal(projectDepartment({ ...state, viewer: seller }).offerAcceptances.length, 1);
  assert.equal(projectDepartment({ ...state, viewer: customer }).offerAcceptances.length, 0);
  assert.deepEqual(audience("offer-acceptance", { department, assignments, row: sellerAcceptance }).sort(), [admin, manager, seller].sort());
  const ctx = { department, assignments, atTime: 5 };
  assert.equal(canPublish("offer-acceptance", { ...ctx, author: admin }), false);
  assert.equal(canPublish("offer-acceptance", { ...ctx, author: customer }), false);
  for (const brand of [AMWAY, EK]) assert.equal(createProjection(brand).canPublish("offer-acceptance", { ...ctx, author: manager }), false);
});

test("projection rejects foreign, forged, self-published, missing and future handoffs", () => {
  const invalid = [
    { ...sellerAcceptance, acceptedFrom: customer },
    { ...sellerAcceptance, acceptedBy: customer },
    { ...sellerAcceptance, department: H("f") },
    { ...sellerAcceptance, handoff: H("4") },
    { ...sellerAcceptance, offer: H("5") },
    { ...sellerAcceptance, acceptedAt: 1 },
    { ...sellerAcceptance, acceptedAt: 6 },
    { ...sellerAcceptance, quantity: -1 },
    { ...sellerAcceptance, unitAmount: 100 },
    { ...managerAcceptance, acceptedFrom: seller },
  ];
  for (const acceptance of invalid) {
    const projection = projectDepartment({ ...state, viewer: admin, offerAcceptances: [acceptance] });
    assert.deepEqual(projection.offerAcceptances, []);
    assert.equal(projection.rejected[0].reason, "invalid-offer-handoff");
  }
  const selfOffer = { ...offer, publishedBy: manager };
  assert.deepEqual(projectDepartment({ ...state, viewer: admin, offerAcceptances: [managerAcceptance],
    offerVersions: { [offerVersion]: { offer: selfOffer, idHash: offerHash } } }).offerAcceptances, []);
});

test("later price edits and re-sharing preserve exact accepted terms and provenance", () => {
  const projection = projectDepartment({ ...state, viewer: admin, offers: [{ ...offer, unitAmount: 999 }],
    offerShares: [{ ...share, sharedAt: 10, sharedBy: admin }] });
  assert.equal(projection.offerAcceptances[1].unitAmount, 200);
  assert.equal(projection.offerAcceptances[1].acceptedFrom, manager);
});

test("acceptance eligibility requires visible upstream offer and complete authorized share", () => {
  assert.deepEqual(projectDepartment({ ...state, viewer: manager }).acceptableOffers, ["upstream"]);
  assert.deepEqual(projectDepartment({ ...state, viewer: seller }).acceptableOffers, ["upstream"]);
  assert.deepEqual(projectDepartment({ ...state, viewer: seller, offerShares: [] }).acceptableOffers, []);
  assert.deepEqual(projectDepartment({ ...state, viewer: customer }).acceptableOffers, []);
  const prematureShare = { ...share, sharedAt: 0 };
  const invalid = projectDepartment({ ...state, viewer: seller, offerShares: [prematureShare], offerHandoffs: { [handoff]: prematureShare } });
  assert.deepEqual(invalid.acceptableOffers, []);
  assert.deepEqual(invalid.offerAcceptances, []);
});
