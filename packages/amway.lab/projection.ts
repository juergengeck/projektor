/**
 * Pure department projection. Authority is re-derived from the replicated
 * assignment chain on every read, so a row CHUM delivered from a peer that
 * lacked authority is visible as `rejected`, never silently merged.
 */

import type {
  AmwayContact,
  AmwayDepartment,
  AmwayLabObject,
  AmwayOffer,
  AmwayOrder,
  AmwayRoleAssignment,
  AmwayStockReceipt,
} from "./recipes.ts";

export const LAB_STOCK = { lot: "demo-lot-a", facility: "demo-facility", gross: 10 };

export type PublishKind = "contact" | "offer" | "order" | "assignment" | "stock";
export type AudienceKind = "department" | "assignment" | "contact" | "offer" | "order" | "stock";

export interface Rejection {
  type: string;
  id: string;
  reason: string;
}

interface AuthorityContext {
  department: AmwayDepartment;
  assignments: AmwayRoleAssignment[];
  author?: string;
  subject?: string;
  atTime: number;
}

export function rolesOf({ department, assignments, subject, atTime }: {
  department: AmwayDepartment;
  assignments: AmwayRoleAssignment[];
  subject: string;
  atTime: number;
}): Set<string> {
  const roles = new Set<string>();
  if (subject === department.admin) roles.add("admin");
  const managers = new Set(assignments
    .filter(entry => entry.role === "manager" && entry.issuer === department.admin && entry.validFrom <= atTime)
    .map(entry => entry.subject));
  // Appointment chain: admin appoints managers, managers appoint sellers,
  // sellers appoint customers. The root admin keeps universal authority.
  const sellers = new Set(assignments
    .filter(entry => entry.role === "seller" && entry.validFrom <= atTime &&
      (entry.issuer === department.admin || managers.has(entry.issuer)))
    .map(entry => entry.subject));
  for (const entry of assignments) {
    if (entry.subject !== subject || entry.validFrom > atTime) continue;
    const issuerIsAdmin = entry.issuer === department.admin;
    const appointed =
      entry.role === "manager" ? issuerIsAdmin :
      entry.role === "seller" ? issuerIsAdmin || managers.has(entry.issuer) :
      entry.role === "customer" ? issuerIsAdmin || sellers.has(entry.issuer) :
      issuerIsAdmin || managers.has(entry.issuer);
    if (appointed) {
      roles.add(entry.role);
    }
  }
  return roles;
}

export function canPublish(kind: string, { department, assignments, author, subject, atTime }: AuthorityContext): boolean {
  const roles = rolesOf({ department, assignments, subject: author ?? "", atTime });
  const staff = roles.has("admin") || roles.has("manager");
  if (kind === "contact") return author === subject || staff;
  if (kind === "offer") return staff;
  // Stocking up is purchasing's job: the department admin — and only the
  // admin — receives goods into inventory.
  if (kind === "stock") return roles.has("admin");
  if (kind === "order") {
    if (staff || roles.has("seller")) return true;
    // Preferred-customer self-service: a customer may buy for themselves only.
    return roles.has("customer") && author === subject;
  }
  // Sellers may only ever issue customer appointments; assignRole gates the
  // exact chain and rolesOf re-validates it on every read.
  if (kind === "assignment") return roles.has("admin") || roles.has("manager") || roles.has("seller");
  throw new Error(`Amway lab: unknown publish kind ${kind}.`);
}

export function audience(kind: string, { department, assignments, row }: {
  department: AmwayDepartment;
  assignments: AmwayRoleAssignment[];
  row: AmwayLabObject;
}): string[] {
  const people = new Set<string>([department.admin]);
  if (kind === "order") {
    // Placed orders stay between the two parties; the admitted purchase is
    // shared down with the customer and reported up to staff.
    if ("admittedAt" in row && (row.admittedAt as number) === 0) {
      for (const entry of assignments) {
        if (entry.role === "seller") people.add(entry.subject);
      }
    } else {
      for (const entry of assignments) {
        if (entry.role === "manager" || entry.role === "seller") people.add(entry.subject);
      }
    }
    if ("customer" in row && typeof row.customer === "string") people.add(row.customer);
  } else if (kind === "offer") {
    // Inventory flows down the chain: a published offer reaches sellers
    // through their manager, never customers. Only the seller shares it
    // further down (shareOffer).
    for (const entry of assignments) {
      if (entry.role === "manager" || entry.role === "seller") people.add(entry.subject);
    }
  } else if (["department", "assignment", "contact", "stock"].includes(kind)) {
    // Stock receipts reach every member: each worker projects the same
    // shared balance from its local store, so the meter agrees per column.
    for (const entry of assignments) people.add(entry.subject);
  } else {
    throw new Error(`Amway lab: unknown audience kind ${kind}.`);
  }
  return [...people].sort();
}

export interface DepartmentProjection {
  department: string;
  roles: string[];
  assignments: AmwayRoleAssignment[];
  contacts: AmwayContact[];
  offers: AmwayOffer[];
  /** Admitted orders only: a purchase exists iff the seller admitted a placed order. */
  orders: AmwayOrder[];
  /** Placed but unadmitted orders (`admittedAt === 0`), awaiting the seller. */
  pendingOrders: AmwayOrder[];
  availability: { lot: string; facility: string; gross: number; stocked: number; available: number };
  rejected: Rejection[];
}

export function projectDepartment({ department, assignments, contacts, offers, orders, stock, viewer, atTime }: {
  department: AmwayDepartment;
  assignments: AmwayRoleAssignment[];
  contacts: AmwayContact[];
  offers: AmwayOffer[];
  orders: AmwayOrder[];
  stock: AmwayStockReceipt[];
  viewer: string;
  atTime: number;
}): DepartmentProjection {
  const rejected: Rejection[] = [];
  const admit = (kind: string, type: string, id: string, author?: string, subject?: string): boolean => {
    if (canPublish(kind, { department, assignments, author, subject, atTime })) return true;
    rejected.push({ type, id, reason: "publisher-not-authorized" });
    return false;
  };
  const validAssignments = assignments.filter(entry =>
    rolesOf({ department, assignments, subject: entry.subject, atTime }).has(entry.role));
  const viewerRoles = rolesOf({ department, assignments, subject: viewer, atTime });
  const customerOnly = viewerRoles.size === 1 && viewerRoles.has("customer");
  const authorizedOrders = orders.filter(entry => admit("order", "AmwayOrder", entry.idempotencyKey, entry.seller, entry.customer));
  const admittedOrders = authorizedOrders.filter(entry => entry.admittedAt > 0);
  const pendingOrders = authorizedOrders.filter(entry => entry.admittedAt === 0);
  const scopeToViewer = (list: AmwayOrder[]): AmwayOrder[] =>
    customerOnly ? list.filter(entry => entry.customer === viewer) : list;
  // One shared balance for every viewer: opening stock plus everything
  // purchasing received, minus everything admitted. Never viewer-scoped —
  // the meter must agree in every column.
  const stocked = LAB_STOCK.gross + stock.reduce((sum, entry) => sum + entry.quantity, 0);
  return {
    department: department.department,
    roles: [...viewerRoles].sort(),
    assignments: validAssignments,
    contacts: contacts.filter(entry => admit("contact", "AmwayContact", entry.person, entry.publishedBy, entry.person)),
    offers: offers.filter(entry => admit("offer", "AmwayOffer", entry.offerId, entry.publishedBy)),
    orders: scopeToViewer(admittedOrders),
    pendingOrders: scopeToViewer(pendingOrders),
    availability: {
      ...LAB_STOCK,
      stocked,
      available: stocked - admittedOrders.reduce((sum, entry) => sum + entry.quantity, 0),
    },
    rejected,
  };
}
