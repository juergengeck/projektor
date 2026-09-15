/**
 * Amway lab object model. Every department-scoped object references its
 * AmwayDepartment by id hash, so receivers enumerate a department through
 * the id-object reverse map instead of any host-maintained index.
 */

export const LAB_ROLES = ["admin", "manager", "seller", "customer"];
export const AMWAY_LAB_TYPES = ["AmwayDepartment", "AmwayRoleAssignment", "AmwayContact", "AmwayOffer", "AmwayOrder"];

const departmentRef = { itemprop: "department", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set(["AmwayDepartment"]) } };
const person = (itemprop, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } });
const text = (itemprop, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "string" } });
const integer = itemprop => ({ itemprop, itemtype: { type: "integer" } });

export const AmwayLabRecipes = [
  { $type$: "Recipe", name: "AmwayDepartment", rule: [text("department", true), text("name"), person("admin")] },
  { $type$: "Recipe", name: "AmwayRoleAssignment", rule: [departmentRef, person("subject", true), text("role"), person("issuer"), integer("validFrom")] },
  { $type$: "Recipe", name: "AmwayContact", rule: [departmentRef, person("person", true), text("name"), text("role"), person("publishedBy"), integer("publishedAt")] },
  { $type$: "Recipe", name: "AmwayOffer", rule: [departmentRef, text("offerId", true), text("item"), text("priceList"), text("channel"), integer("unitAmount"), text("currency"), person("publishedBy")] },
  { $type$: "Recipe", name: "AmwayOrder", rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller"), text("offer"), integer("quantity"), text("lot"), text("facility"), integer("admittedAt")] },
];

export const AmwayLabReverseMapsForIdObjects = AMWAY_LAB_TYPES
  .filter(type => type !== "AmwayDepartment")
  .map(type => [type, new Set(["department"])]);

const HASH = /^[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(`Amway lab: ${message}`);
}
function hash(value, field) {
  if (typeof value !== "string" || !HASH.test(value)) fail(`${field} must be a SHA-256 hash.`);
  return value;
}
function nonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} is required.`);
  return value;
}
function timestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${field} must be a non-negative integer.`);
  return value;
}

export function createDepartment({ department, name, admin } = {}) {
  return { $type$: "AmwayDepartment", department: nonEmpty(department, "department"), name: nonEmpty(name, "name"), admin: hash(admin, "admin") };
}

export function createRoleAssignment({ department, subject, role, issuer, validFrom } = {}) {
  if (!LAB_ROLES.includes(role)) fail(`role must be one of ${LAB_ROLES.join(", ")}.`);
  return {
    $type$: "AmwayRoleAssignment", department: hash(department, "department"), subject: hash(subject, "subject"),
    role, issuer: hash(issuer, "issuer"), validFrom: timestamp(validFrom, "validFrom"),
  };
}

export function createContact({ department, person: who, name, role, publishedBy, publishedAt } = {}) {
  if (!LAB_ROLES.includes(role)) fail(`role must be one of ${LAB_ROLES.join(", ")}.`);
  return {
    $type$: "AmwayContact", department: hash(department, "department"), person: hash(who, "person"),
    name: nonEmpty(name, "name"), role, publishedBy: hash(publishedBy, "publishedBy"), publishedAt: timestamp(publishedAt, "publishedAt"),
  };
}

export function createOffer({ department, offerId, item, priceList, channel, unitAmount, currency, publishedBy } = {}) {
  if (!Number.isSafeInteger(unitAmount) || unitAmount <= 0) fail("unitAmount must be a positive integer (minor units).");
  return {
    $type$: "AmwayOffer", department: hash(department, "department"), offerId: nonEmpty(offerId, "offerId"),
    item: nonEmpty(item, "item"), priceList: nonEmpty(priceList, "priceList"), channel: nonEmpty(channel, "channel"),
    unitAmount, currency: nonEmpty(currency, "currency"), publishedBy: hash(publishedBy, "publishedBy"),
  };
}

export function createOrder({ department, idempotencyKey, customer, seller, offer, quantity, lot, facility, admittedAt } = {}) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) fail("quantity must be a positive integer.");
  return {
    $type$: "AmwayOrder", department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"),
    customer: hash(customer, "customer"), seller: hash(seller, "seller"), offer: nonEmpty(offer, "offer"), quantity,
    lot: nonEmpty(lot, "lot"), facility: nonEmpty(facility, "facility"), admittedAt: timestamp(admittedAt, "admittedAt"),
  };
}
