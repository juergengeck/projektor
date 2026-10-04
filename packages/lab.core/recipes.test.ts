// packages/lab.core/recipes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK, IGM } from "./brand.ts";
import { LAB_KINDS, createLabObjects, createLabRecipes, labTypes } from "./recipes.ts";
import { testBrand } from "./test/brand.ts";

const HASH = "a".repeat(64);
const PERSON = "b".repeat(64);
const brand = testBrand();
const objects = createLabObjects(brand);
const { types } = createLabRecipes(brand);

test("stored recipe names are exactly today's names", () => {
  assert.deepEqual(createLabRecipes(AMWAY).recipes.map(recipe => recipe.name),
    ["AmwayDepartment", "AmwayRoleAssignment", "AmwayContact", "AmwayOffer", "AmwayOrder", "AmwayPurchaseRequest", "AmwayPurchaseDecision", "AmwayStockReceipt", "AmwayOfferShare", "AmwayOfferAcceptance"]);
  assert.deepEqual(createLabRecipes(EK).recipes.map(recipe => recipe.name),
    ["EkDepartment", "EkRoleAssignment", "EkContact", "EkOffer", "EkOrder", "EkPurchaseRequest", "EkPurchaseDecision", "EkStockReceipt", "EkOfferShare", "EkOfferAcceptance"]);
  assert.deepEqual(createLabRecipes(IGM).recipes.map(recipe => recipe.name),
    ["IgmDepartment", "IgmRoleAssignment", "IgmContact", "IgmOffer", "IgmOrder", "IgmPurchaseRequest", "IgmPurchaseDecision", "IgmStockReceipt", "IgmOfferShare", "IgmOfferAcceptance"]);
});

test("department references allow only the brand's department type", () => {
  const assignment = createLabRecipes(brand).recipes.find(recipe => recipe.name === types.RoleAssignment)!;
  const ref = assignment.rule[0].itemtype as { allowedTypes: Set<string> };
  assert.deepEqual([...ref.allowedTypes], [types.Department]);
});

test("purchase requests are reverse-mapped by department and seller", () => {
  const maps = new Map(createLabRecipes(brand).reverseMapsForIdObjects);
  assert.deepEqual([...maps.get(types.PurchaseRequest)!], ["department", "seller"]);
  assert.deepEqual([...maps.get(types.Offer)!], ["department"]);
  assert.equal(maps.has(types.Department), false);
});

test("constructors stamp the brand type and validate", () => {
  assert.deepEqual(objects.createDepartment({ department: brand.department.id, name: brand.department.name, admin: PERSON }),
    { $type$: types.Department, department: brand.department.id, name: brand.department.name, admin: PERSON });
  assert.equal(objects.createOffer({ department: HASH, offerId: "o1", item: "ITEM@1", priceList: "retail@2026-09", channel: "facility", unitAmount: 10000, currency: "EUR", publishedBy: PERSON }).unitAmount, 10000);
  assert.equal(objects.createOrder({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, offer: "o1", quantity: 2, lot: brand.stock.lot, facility: brand.stock.facility, currency: "EUR", unitAmount: 10000, admittedAt: 1 }).quantity, 2);
  assert.throws(() => objects.createRoleAssignment({ department: HASH, subject: PERSON, role: "owner", issuer: PERSON, validFrom: 0 }),
    new RegExp(`^Error: ${brand.label}: role must be one of admin, manager, seller, customer\\.$`));
});

test("every lab kind has exactly one recipe", () => {
  assert.deepEqual(createLabRecipes(brand).recipes.map(recipe => recipe.name).sort(),
    [...LAB_KINDS.map(kind => types[kind])].sort());
});

test("every department-scoped type is reverse-mapped on department", () => {
  const mapped = new Map(createLabRecipes(brand).reverseMapsForIdObjects);
  for (const kind of LAB_KINDS.filter(name => name !== "Department")) {
    assert.deepEqual([...mapped.get(types[kind])!],
      kind === "PurchaseRequest" ? ["department", "seller"] : ["department"]);
  }
});

test("constructors produce typed objects", () => {
  assert.equal(objects.createRoleAssignment({ department: HASH, subject: PERSON, role: "seller", issuer: PERSON, validFrom: 1 }).role, "seller");
  assert.equal(objects.createContact({ department: HASH, person: PERSON, name: "Eva", role: "seller", publishedBy: PERSON, publishedAt: 1 }).name, "Eva");
  assert.equal(objects.createPurchaseRequest({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, requestedAt: 1 }).requestedAt, 1);
  assert.equal(objects.createPurchaseDecision({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, outcome: "rejected", reason: "out-of-stock", decidedAt: 2 }).reason, "out-of-stock");
});

test("constructors fail fast on invalid input", () => {
  assert.throws(() => objects.createRoleAssignment({ department: HASH, subject: PERSON, role: "boss", issuer: PERSON, validFrom: 1 }), /role/);
  assert.throws(() => objects.createOrder({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, offer: "o1", quantity: 0, lot: "l", facility: "f", currency: "EUR", unitAmount: 10000, admittedAt: 1 }), /quantity/);
  assert.throws(() => objects.createContact({ department: "not-a-hash", person: PERSON, name: "Eva", role: "seller", publishedBy: PERSON, publishedAt: 1 }), /department/);
  assert.throws(() => objects.createPurchaseDecision({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, outcome: "accepted", reason: "out-of-stock", decidedAt: 2 }), /outcome/);
});

test("labTypes covers every kind with the brand prefix", () => {
  assert.deepEqual(labTypes(AMWAY).Order, "AmwayOrder");
  assert.deepEqual(labTypes(EK).Order, "EkOrder");
  assert.deepEqual(labTypes(IGM).Order, "IgmOrder");
  assert.equal(Object.keys(labTypes(brand)).length, LAB_KINDS.length);
});
