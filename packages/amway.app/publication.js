/**
 * Durable department roots in ONE storage, following the aggregat shop.core
 * publication seam: a platform-neutral persistence interface, identity-
 * verified stores (precomputed hashes must match what storage returns), and
 * the stable id root granted as the completion signal.
 *
 * The Amway root is a versioned ONE object whose stable identity is the
 * department alone (`isId: true` on `department` only); every publish is a
 * new version carrying opaque canonical snapshots. Members stay logical
 * `person:*` strings — cross-identity access grants arrive with the ONE
 * person mapping, so publication grants the root to the custodial instance
 * owner and nothing else.
 */

import { addRecipeToRuntime, hasRecipe } from "../../../one/packages/one.core/lib/object-recipes.js";
import { calculateHashOfObj, calculateIdHashOfObj } from "../../../one/packages/one.core/lib/util/object.js";

export const AMWAY_DEPARTMENT_ROOT_TYPE = "AmwayDepartmentRoot";

export const AmwayDepartmentRootRecipe = {
  $type$: "Recipe",
  name: AMWAY_DEPARTMENT_ROOT_TYPE,
  rule: [
    { itemprop: "department", isId: true, itemtype: { type: "string" } },
    { itemprop: "exportedAt", itemtype: { type: "number" } },
    { itemprop: "catalog", itemtype: { type: "string" } },
    { itemprop: "members", itemtype: { type: "string" } },
    { itemprop: "orders", itemtype: { type: "string" } },
  ],
};

/** Registers the Amway recipes exactly once; safe to call on every boot. */
export function registerAmwayRecipes() {
  if (!hasRecipe(AMWAY_DEPARTMENT_ROOT_TYPE)) {
    addRecipeToRuntime(AmwayDepartmentRootRecipe);
  }
}

function fail(message) {
  throw new Error(`Amway publication: ${message}`);
}

function required(value, field) {
  if (value === undefined || value === null || value === "") fail(`${field} is required.`);
  return value;
}

export function createAmwayDepartmentRoot({ department, exportedAt, catalog, members, orders } = {}) {
  const id = required(department, "department");
  if (typeof id !== "string") fail("department must be a string.");
  if (!Number.isSafeInteger(exportedAt) || exportedAt < 0) fail("exportedAt must be a non-negative integer.");
  for (const [field, value] of [["catalog", catalog], ["members", members], ["orders", orders]]) {
    if (typeof value !== "string") fail(`${field} must be a canonical JSON string.`);
  }
  return { $type$: AMWAY_DEPARTMENT_ROOT_TYPE, department: id, exportedAt, catalog, members, orders };
}

/**
 * Builds the canonical opaque snapshots for one department. Pure: fixed key
 * order and sorted collections, so identical state always serializes
 * identically. No ONE runtime needed.
 */
export function buildDepartmentSnapshot(modules, department, { exportedAt } = {}) {
  const { directory, shop, lifecycle } = modules;
  if (!directory?.departments.has(department)) fail(`unknown department ${department}.`);
  const atTime = exportedAt ?? Date.now();
  const items = [...shop.catalog.items.values()]
    .map(entry => ({
      brand: entry.brand, bv: entry.bv, category: entry.category, itemNumber: entry.itemNumber,
      name: entry.name, pv: entry.pv, unit: entry.unit,
    }))
    .sort((a, b) => (a.itemNumber < b.itemNumber ? -1 : 1));
  const offers = [...shop.catalog.offers.values()]
    .map(entry => ({
      channel: entry.channel, id: entry.id, item: entry.item,
      unitPrice: { amount: entry.unitPrice.amount, currency: entry.unitPrice.currency },
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const members = [...directory.assignments.values()]
    .filter(entry => entry.department === department)
    .map(entry => ({
      id: entry.id, issuer: entry.issuer, revokedAt: entry.revokedAt, role: entry.role, subject: entry.subject,
    }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const orders = [...shop.transactions.values()]
    .filter(entry => entry.department === department)
    .map(entry => {
      const ledger = lifecycle.projection(entry.id);
      return {
        channel: entry.channel, customer: entry.customer, id: entry.id, seller: entry.seller,
        status: ledger.status, total: { amount: entry.total.amount, currency: entry.total.currency },
      };
    })
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  return {
    root: createAmwayDepartmentRoot({
      department,
      exportedAt: atTime,
      catalog: JSON.stringify({ items, offers }),
      members: JSON.stringify(members),
      orders: JSON.stringify(orders),
    }),
    counts: { items: items.length, offers: offers.length, members: members.length, orders: orders.length },
  };
}

/**
 * Stores the department root and grants its stable id to the custodian. The
 * root write is the completion signal: supporting content lives inside the
 * root version itself, so no child grants are needed.
 */
export async function publishDepartmentRoot({ directory, shop, lifecycle, persistence, department, issuer, custodian, exportedAt } = {}) {
  if (!directory?.departments.has(department)) fail(`unknown department ${department}.`);
  required(custodian, "custodian");
  const atTime = exportedAt ?? Date.now();
  const publisher = required(issuer, "issuer");
  if (!directory.effectiveRoles({ subject: publisher, department, atTime }).has("manager")) {
    fail(`issuer ${publisher} holds no manager role for ${department}.`);
  }
  const { root, counts } = buildDepartmentSnapshot({ directory, shop, lifecycle }, department, { exportedAt: atTime });
  const expectedIdHash = String(await calculateIdHashOfObj(root));
  const expectedHash = String(await calculateHashOfObj(root));
  const stored = await persistence.storeVersioned(root);
  if (stored.idHash !== expectedIdHash || stored.hash !== expectedHash) {
    fail("persistence changed the department root identity.");
  }
  await persistence.grantIdRoots([expectedIdHash], custodian);
  return { rootRef: expectedIdHash, rootVersionRef: stored.hash, exportedAt: root.exportedAt, counts };
}
