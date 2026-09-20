// packages/ek.lab/recipes.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EK_LAB_TYPES, EkLabRecipes, EkLabReverseMapsForIdObjects,
  createContact, createDepartment, createOffer, createOrder, createRoleAssignment,
} from "./recipes.ts";

const HASH = "a".repeat(64);
const PERSON = "b".repeat(64);

test("every lab type has exactly one recipe", () => {
  assert.deepEqual(EkLabRecipes.map(recipe => recipe.name).sort(), [...EK_LAB_TYPES].sort());
});

test("every department-scoped type is reverse-mapped on department", () => {
  const mapped = new Map(EkLabReverseMapsForIdObjects);
  for (const type of EK_LAB_TYPES.filter(name => name !== "EkDepartment")) {
    assert.deepEqual([...mapped.get(type)], ["department"]);
  }
});

test("constructors produce typed objects", () => {
  assert.deepEqual(createDepartment({ department: "ek-de", name: "Demo DE", admin: PERSON }),
    { $type$: "EkDepartment", department: "ek-de", name: "Demo DE", admin: PERSON });
  assert.equal(createRoleAssignment({ department: HASH, subject: PERSON, role: "seller", issuer: PERSON, validFrom: 1 }).role, "seller");
  assert.equal(createContact({ department: HASH, person: PERSON, name: "Eva", role: "seller", publishedBy: PERSON, publishedAt: 1 }).name, "Eva");
  assert.equal(createOffer({ department: HASH, offerId: "o1", item: "BMA-WARTUNG@1", priceList: "ek-retail@2026-09", channel: "facility", unitAmount: 10000, currency: "EUR", publishedBy: PERSON }).unitAmount, 10000);
  assert.equal(createOrder({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, offer: "o1", quantity: 2, lot: "ek-lot-a", facility: "ek-facility", currency: "EUR", unitAmount: 10000, admittedAt: 1 }).quantity, 2);
});

test("constructors fail fast on invalid input", () => {
  assert.throws(() => createRoleAssignment({ department: HASH, subject: PERSON, role: "boss", issuer: PERSON, validFrom: 1 }), /role/);
  assert.throws(() => createOrder({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, offer: "o1", quantity: 0, lot: "l", facility: "f", currency: "EUR", unitAmount: 10000, admittedAt: 1 }), /quantity/);
  assert.throws(() => createContact({ department: "not-a-hash", person: PERSON, name: "Eva", role: "seller", publishedBy: PERSON, publishedAt: 1 }), /department/);
});
