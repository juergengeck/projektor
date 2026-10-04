/**
 * Lab object model. Every department-scoped object references its
 * department by id hash, so receivers enumerate a department through the
 * id-object reverse map instead of any host-maintained index. Type names
 * come from the brand and are the stored ONE type names; never rename them.
 */
import type { SHA256IdHash, SHA256Hash } from "../../../one/packages/one.core/lib/util/type-checks.js";
import type { LabBrand } from "./brand.ts";

export const LAB_ROLES = ["admin", "manager", "seller", "customer"] as const;
export type LabRole = (typeof LAB_ROLES)[number];
export const LAB_KINDS = ["Department", "RoleAssignment", "Contact", "Offer", "Order", "PurchaseRequest", "PurchaseDecision", "StockReceipt", "OfferShare", "OfferAcceptance"] as const;
export type LabKind = (typeof LAB_KINDS)[number];

interface RecipeRule {
  itemprop: string;
  isId?: boolean;
  itemtype: unknown;
}

export interface LabRecipe {
  $type$: "Recipe";
  name: string;
  rule: RecipeRule[];
}

export function labTypes(brand: LabBrand): Record<LabKind, string> {
  return Object.fromEntries(LAB_KINDS.map(kind => [kind, `${brand.typePrefix}${kind}`])) as Record<LabKind, string>;
}

const person = (itemprop: string, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } });
const text = (itemprop: string, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "string" } });
const integer = (itemprop: string) => ({ itemprop, itemtype: { type: "integer" } });

export function createLabRecipes(brand: LabBrand) {
  const types = labTypes(brand);
  const departmentRef = { itemprop: "department", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set([types.Department]) } };
  const recipes: LabRecipe[] = [
    { $type$: "Recipe", name: types.Department, rule: [text("department", true), text("name"), person("admin")] },
    { $type$: "Recipe", name: types.RoleAssignment, rule: [departmentRef, person("subject", true), text("role"), person("issuer"), integer("validFrom")] },
    { $type$: "Recipe", name: types.Contact, rule: [departmentRef, person("person", true), text("name"), text("role"), person("publishedBy"), integer("publishedAt")] },
    { $type$: "Recipe", name: types.Offer, rule: [departmentRef, text("offerId", true), text("item"), text("priceList"), text("channel"), integer("unitAmount"), text("currency"), person("publishedBy")] },
    { $type$: "Recipe", name: types.Order, rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller"), text("offer"), integer("quantity"), text("lot"), text("facility"), text("currency"), integer("unitAmount"), integer("admittedAt")] },
    { $type$: "Recipe", name: types.PurchaseRequest, rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller", true), integer("requestedAt")] },
    { $type$: "Recipe", name: types.PurchaseDecision, rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller"), text("outcome"), text("reason"), integer("decidedAt")] },
    { $type$: "Recipe", name: types.StockReceipt, rule: [departmentRef, text("receiptId", true), text("lot"), text("facility"), integer("quantity"), person("receivedBy"), integer("receivedAt")] },
    { $type$: "Recipe", name: types.OfferShare, rule: [departmentRef, { itemprop: "offer", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set([types.Offer]) } }, person("sharedBy", true), person("recipient", true), text("recipientRole"), integer("sharedAt")] },
    { $type$: "Recipe", name: types.OfferAcceptance, rule: [departmentRef, text("idempotencyKey", true), { itemprop: "offer", itemtype: { type: "referenceToId", allowedTypes: new Set([types.Offer]) } }, { itemprop: "offerVersion", itemtype: { type: "referenceToObj", allowedTypes: new Set([types.Offer]) } }, { itemprop: "handoff", itemtype: { type: "referenceToObj", allowedTypes: new Set([types.Offer, types.OfferShare]) } }, text("offerId"), integer("quantity"), person("acceptedBy"), person("acceptedFrom"), integer("acceptedAt"), integer("unitAmount"), text("currency")] },
  ];
  const reverseMapsForIdObjects: [string, Set<string>][] = LAB_KINDS
    .filter(kind => kind !== "Department")
    .map(kind => [types[kind], new Set(kind === "PurchaseRequest" ? ["department", "seller"] : ["department"])]);
  return { types, recipes, reverseMapsForIdObjects };
}

export interface LabDepartment { $type$: string; department: string; name: string; admin: string }
export interface LabRoleAssignment { $type$: string; department: string; subject: string; role: string; issuer: string; validFrom: number }
export interface LabContact { $type$: string; department: string; person: string; name: string; role: string; publishedBy: string; publishedAt: number }
export interface LabOffer { $type$: string; department: string; offerId: string; item: string; priceList: string; channel: string; unitAmount: number; currency: string; publishedBy: string }
export interface LabOrder {
  $type$: string; department: string; idempotencyKey: string; customer: string; seller: string; offer: string;
  quantity: number; lot: string; facility: string;
  /** Price agreed at placement, in minor units — admission settles exactly this, never the current offer price. */
  currency: string; unitAmount: number; admittedAt: number;
}
export interface LabStockReceipt { $type$: string; department: string; receiptId: string; lot: string; facility: string; quantity: number; receivedBy: string; receivedAt: number }
export interface LabPurchaseRequest { $type$: string; department: string; idempotencyKey: string; customer: string; seller: string; requestedAt: number }
export interface LabPurchaseDecision { $type$: string; department: string; idempotencyKey: string; customer: string; seller: string; outcome: "rejected"; reason: "out-of-stock"; decidedAt: number }
export interface LabOfferShare { $type$: string; department: string; offer: string; sharedBy: string; recipient: string; recipientRole: "seller" | "customer"; sharedAt: number }
/** A handoff acknowledgement, independent of stock settlement and accounting. */
export interface LabOfferAcceptance {
  $type$: string; department: SHA256IdHash<never>; idempotencyKey: string;
  offer: SHA256IdHash<never>; offerVersion: SHA256Hash<never>; handoff: SHA256Hash<never>; offerId: string;
  quantity: number; acceptedBy: string; acceptedFrom: string; acceptedAt: number; unitAmount: number; currency: string;
}
export type LabObject = LabDepartment | LabRoleAssignment | LabContact | LabOffer | LabOrder | LabPurchaseRequest | LabPurchaseDecision | LabStockReceipt | LabOfferShare | LabOfferAcceptance;

const HASH = /^[0-9a-f]{64}$/;

export function createLabObjects(brand: LabBrand) {
  const types = labTypes(brand);
  const fail = (message: string): never => { throw new Error(`${brand.label}: ${message}`); };
  const hash = (value: unknown, field: string): string => {
    if (typeof value !== "string" || !HASH.test(value)) fail(`${field} must be a SHA-256 hash.`);
    return value as string;
  };
  const nonEmpty = (value: unknown, field: string): string => {
    if (typeof value !== "string" || value.trim() === "") fail(`${field} is required.`);
    return value as string;
  };
  const timestamp = (value: unknown, field: string): number => {
    if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} must be a non-negative integer.`);
    return value as number;
  };
  const role = (value: unknown): LabRole => {
    if (typeof value !== "string" || !(LAB_ROLES as readonly string[]).includes(value)) fail(`role must be one of ${LAB_ROLES.join(", ")}.`);
    return value as LabRole;
  };
  const positive = (value: unknown, message: string): number => {
    if (!Number.isSafeInteger(value) || (value as number) <= 0) fail(message);
    return value as number;
  };
  return {
    createDepartment({ department, name, admin }: { department?: unknown; name?: unknown; admin?: unknown } = {}): LabDepartment {
      return { $type$: types.Department, department: nonEmpty(department, "department"), name: nonEmpty(name, "name"), admin: hash(admin, "admin") };
    },
    createRoleAssignment({ department, subject, role: value, issuer, validFrom }: {
      department?: unknown; subject?: unknown; role?: unknown; issuer?: unknown; validFrom?: unknown;
    } = {}): LabRoleAssignment {
      const checked = role(value);
      return { $type$: types.RoleAssignment, department: hash(department, "department"), subject: hash(subject, "subject"), role: checked, issuer: hash(issuer, "issuer"), validFrom: timestamp(validFrom, "validFrom") };
    },
    createContact({ department, person: who, name, role: value, publishedBy, publishedAt }: {
      department?: unknown; person?: unknown; name?: unknown; role?: unknown; publishedBy?: unknown; publishedAt?: unknown;
    } = {}): LabContact {
      const checked = role(value);
      return { $type$: types.Contact, department: hash(department, "department"), person: hash(who, "person"), name: nonEmpty(name, "name"), role: checked, publishedBy: hash(publishedBy, "publishedBy"), publishedAt: timestamp(publishedAt, "publishedAt") };
    },
    createOffer({ department, offerId, item, priceList, channel, unitAmount, currency, publishedBy }: {
      department?: unknown; offerId?: unknown; item?: unknown; priceList?: unknown; channel?: unknown; unitAmount?: unknown; currency?: unknown; publishedBy?: unknown;
    } = {}): LabOffer {
      const amount = positive(unitAmount, "unitAmount must be a positive integer (minor units).");
      return { $type$: types.Offer, department: hash(department, "department"), offerId: nonEmpty(offerId, "offerId"), item: nonEmpty(item, "item"), priceList: nonEmpty(priceList, "priceList"), channel: nonEmpty(channel, "channel"), unitAmount: amount, currency: nonEmpty(currency, "currency"), publishedBy: hash(publishedBy, "publishedBy") };
    },
    createOfferAcceptance({ department, idempotencyKey, offer, offerVersion, handoff, offerId, quantity, acceptedBy, acceptedFrom, acceptedAt, unitAmount, currency }: {
      department?: unknown; idempotencyKey?: unknown; offer?: unknown; offerVersion?: unknown; handoff?: unknown; offerId?: unknown;
      quantity?: unknown; acceptedBy?: unknown; acceptedFrom?: unknown; acceptedAt?: unknown; unitAmount?: unknown; currency?: unknown;
    } = {}): LabOfferAcceptance {
      return { $type$: types.OfferAcceptance, department: hash(department, "department") as SHA256IdHash<never>,
        idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"), offer: hash(offer, "offer") as SHA256IdHash<never>,
        offerVersion: hash(offerVersion, "offerVersion") as SHA256Hash<never>, handoff: hash(handoff, "handoff") as SHA256Hash<never>,
        offerId: nonEmpty(offerId, "offerId"), quantity: positive(quantity, "quantity must be a positive integer."),
        acceptedBy: hash(acceptedBy, "acceptedBy"), acceptedFrom: hash(acceptedFrom, "acceptedFrom"), acceptedAt: timestamp(acceptedAt, "acceptedAt"),
        unitAmount: positive(unitAmount, "unitAmount must be a positive integer (minor units)."), currency: nonEmpty(currency, "currency") };
    },
    createOfferShare({ department, offer, sharedBy, recipient, recipientRole, sharedAt }: {
      department?: unknown; offer?: unknown; sharedBy?: unknown; recipient?: unknown; recipientRole?: unknown; sharedAt?: unknown;
    } = {}): LabOfferShare {
      if (recipientRole !== "seller" && recipientRole !== "customer") fail("offer recipient role must be seller or customer.");
      return { $type$: types.OfferShare, department: hash(department, "department"), offer: hash(offer, "offer"), sharedBy: hash(sharedBy, "sharedBy"), recipient: hash(recipient, "recipient"), recipientRole: recipientRole as "seller" | "customer", sharedAt: timestamp(sharedAt, "sharedAt") };
    },
    createStockReceipt({ department, receiptId, lot, facility, quantity, receivedBy, receivedAt }: {
      department?: unknown; receiptId?: unknown; lot?: unknown; facility?: unknown; quantity?: unknown; receivedBy?: unknown; receivedAt?: unknown;
    } = {}): LabStockReceipt {
      const count = positive(quantity, "quantity must be a positive integer.");
      return { $type$: types.StockReceipt, department: hash(department, "department"), receiptId: nonEmpty(receiptId, "receiptId"), lot: nonEmpty(lot, "lot"), facility: nonEmpty(facility, "facility"), quantity: count, receivedBy: hash(receivedBy, "receivedBy"), receivedAt: timestamp(receivedAt, "receivedAt") };
    },
    createOrder({ department, idempotencyKey, customer, seller, offer, quantity, lot, facility, currency, unitAmount, admittedAt }: {
      department?: unknown; idempotencyKey?: unknown; customer?: unknown; seller?: unknown; offer?: unknown; quantity?: unknown; lot?: unknown; facility?: unknown; currency?: unknown; unitAmount?: unknown; admittedAt?: unknown;
    } = {}): LabOrder {
      const count = positive(quantity, "quantity must be a positive integer.");
      const amount = positive(unitAmount, "unitAmount must be a positive integer (minor units).");
      return { $type$: types.Order, department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"), customer: hash(customer, "customer"), seller: hash(seller, "seller"), offer: nonEmpty(offer, "offer"), quantity: count, lot: nonEmpty(lot, "lot"), facility: nonEmpty(facility, "facility"), currency: nonEmpty(currency, "currency"), unitAmount: amount, admittedAt: timestamp(admittedAt, "admittedAt") };
    },
    createPurchaseRequest({ department, idempotencyKey, customer, seller, requestedAt }: {
      department?: unknown; idempotencyKey?: unknown; customer?: unknown; seller?: unknown; requestedAt?: unknown;
    } = {}): LabPurchaseRequest {
      return { $type$: types.PurchaseRequest, department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"), customer: hash(customer, "customer"), seller: hash(seller, "seller"), requestedAt: timestamp(requestedAt, "requestedAt") };
    },
    createPurchaseDecision({ department, idempotencyKey, customer, seller, outcome, reason, decidedAt }: {
      department?: unknown; idempotencyKey?: unknown; customer?: unknown; seller?: unknown; outcome?: unknown; reason?: unknown; decidedAt?: unknown;
    } = {}): LabPurchaseDecision {
      if (outcome !== "rejected") fail("purchase outcome must be rejected.");
      if (reason !== "out-of-stock") fail("purchase reason must be out-of-stock.");
      return { $type$: types.PurchaseDecision, department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"), customer: hash(customer, "customer"), seller: hash(seller, "seller"), outcome: "rejected", reason: "out-of-stock", decidedAt: timestamp(decidedAt, "decidedAt") };
    },
  };
}
