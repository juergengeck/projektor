/**
 * Ek lab object model. Every department-scoped object references its
 * EkDepartment by id hash, so receivers enumerate a department through
 * the id-object reverse map instead of any host-maintained index.
 */

export const LAB_ROLES = ["admin", "manager", "seller", "customer"] as const;
export type LabRole = (typeof LAB_ROLES)[number];
export const EK_LAB_TYPES = ["EkDepartment", "EkRoleAssignment", "EkContact", "EkOffer", "EkOrder"] as const;
export type EkLabType = (typeof EK_LAB_TYPES)[number];

interface RecipeRule {
  itemprop: string;
  isId?: boolean;
  itemtype: unknown;
}

interface LabRecipe {
  $type$: "Recipe";
  name: string;
  rule: RecipeRule[];
}

const departmentRef = { itemprop: "department", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set(["EkDepartment"]) } };
const person = (itemprop: string, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } });
const text = (itemprop: string, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "string" } });
const integer = (itemprop: string) => ({ itemprop, itemtype: { type: "integer" } });

export const EkLabRecipes: LabRecipe[] = [
  { $type$: "Recipe", name: "EkDepartment", rule: [text("department", true), text("name"), person("admin")] },
  { $type$: "Recipe", name: "EkRoleAssignment", rule: [departmentRef, person("subject", true), text("role"), person("issuer"), integer("validFrom")] },
  { $type$: "Recipe", name: "EkContact", rule: [departmentRef, person("person", true), text("name"), text("role"), person("publishedBy"), integer("publishedAt")] },
  { $type$: "Recipe", name: "EkOffer", rule: [departmentRef, text("offerId", true), text("item"), text("priceList"), text("channel"), integer("unitAmount"), text("currency"), person("publishedBy")] },
  { $type$: "Recipe", name: "EkOrder", rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller"), text("offer"), integer("quantity"), text("lot"), text("facility"), integer("admittedAt")] },
];

export const EkLabReverseMapsForIdObjects: [string, Set<string>][] = EK_LAB_TYPES
  .filter(type => type !== "EkDepartment")
  .map(type => [type, new Set(["department"])]);

const HASH = /^[0-9a-f]{64}$/;

function fail(message: string): never {
  throw new Error(`Ek lab: ${message}`);
}
function hash(value: unknown, field: string): string {
  if (typeof value !== "string" || !HASH.test(value)) fail(`${field} must be a SHA-256 hash.`);
  return value as string;
}
function nonEmpty(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} is required.`);
  return value as string;
}
function timestamp(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} must be a non-negative integer.`);
  return value as number;
}

export interface EkDepartment {
  $type$: "EkDepartment";
  department: string;
  name: string;
  admin: string;
}

export interface EkRoleAssignment {
  $type$: "EkRoleAssignment";
  department: string;
  subject: string;
  role: string;
  issuer: string;
  validFrom: number;
}

export interface EkContact {
  $type$: "EkContact";
  department: string;
  person: string;
  name: string;
  role: string;
  publishedBy: string;
  publishedAt: number;
}

export interface EkOffer {
  $type$: "EkOffer";
  department: string;
  offerId: string;
  item: string;
  priceList: string;
  channel: string;
  unitAmount: number;
  currency: string;
  publishedBy: string;
}

export interface EkOrder {
  $type$: "EkOrder";
  department: string;
  idempotencyKey: string;
  customer: string;
  seller: string;
  offer: string;
  quantity: number;
  lot: string;
  facility: string;
  admittedAt: number;
}

export type EkLabObject = EkDepartment | EkRoleAssignment | EkContact | EkOffer | EkOrder;

function isRole(role: unknown): role is LabRole {
  return typeof role === "string" && (LAB_ROLES as readonly string[]).includes(role);
}

export function createDepartment({ department, name, admin }: {
  department?: unknown; name?: unknown; admin?: unknown;
} = {}): EkDepartment {
  return { $type$: "EkDepartment", department: nonEmpty(department, "department"), name: nonEmpty(name, "name"), admin: hash(admin, "admin") };
}

export function createRoleAssignment({ department, subject, role, issuer, validFrom }: {
  department?: unknown; subject?: unknown; role?: unknown; issuer?: unknown; validFrom?: unknown;
} = {}): EkRoleAssignment {
  if (!isRole(role)) fail(`role must be one of ${LAB_ROLES.join(", ")}.`);
  return {
    $type$: "EkRoleAssignment", department: hash(department, "department"), subject: hash(subject, "subject"),
    role, issuer: hash(issuer, "issuer"), validFrom: timestamp(validFrom, "validFrom"),
  };
}

export function createContact({ department, person: who, name, role, publishedBy, publishedAt }: {
  department?: unknown; person?: unknown; name?: unknown; role?: unknown; publishedBy?: unknown; publishedAt?: unknown;
} = {}): EkContact {
  if (!isRole(role)) fail(`role must be one of ${LAB_ROLES.join(", ")}.`);
  return {
    $type$: "EkContact", department: hash(department, "department"), person: hash(who, "person"),
    name: nonEmpty(name, "name"), role, publishedBy: hash(publishedBy, "publishedBy"), publishedAt: timestamp(publishedAt, "publishedAt"),
  };
}

export function createOffer({ department, offerId, item, priceList, channel, unitAmount, currency, publishedBy }: {
  department?: unknown; offerId?: unknown; item?: unknown; priceList?: unknown; channel?: unknown;
  unitAmount?: unknown; currency?: unknown; publishedBy?: unknown;
} = {}): EkOffer {
  if (!Number.isSafeInteger(unitAmount) || (unitAmount as number) <= 0) fail("unitAmount must be a positive integer (minor units).");
  return {
    $type$: "EkOffer", department: hash(department, "department"), offerId: nonEmpty(offerId, "offerId"),
    item: nonEmpty(item, "item"), priceList: nonEmpty(priceList, "priceList"), channel: nonEmpty(channel, "channel"),
    unitAmount: unitAmount as number, currency: nonEmpty(currency, "currency"), publishedBy: hash(publishedBy, "publishedBy"),
  };
}

export function createOrder({ department, idempotencyKey, customer, seller, offer, quantity, lot, facility, admittedAt }: {
  department?: unknown; idempotencyKey?: unknown; customer?: unknown; seller?: unknown; offer?: unknown;
  quantity?: unknown; lot?: unknown; facility?: unknown; admittedAt?: unknown;
} = {}): EkOrder {
  if (!Number.isSafeInteger(quantity) || (quantity as number) <= 0) fail("quantity must be a positive integer.");
  return {
    $type$: "EkOrder", department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"),
    customer: hash(customer, "customer"), seller: hash(seller, "seller"), offer: nonEmpty(offer, "offer"), quantity: quantity as number,
    lot: nonEmpty(lot, "lot"), facility: nonEmpty(facility, "facility"), admittedAt: timestamp(admittedAt, "admittedAt"),
  };
}
