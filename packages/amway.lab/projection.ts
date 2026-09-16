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
} from "./recipes.ts";

export const LAB_STOCK = { lot: "demo-lot-a", facility: "demo-facility", gross: 10 };

export type PublishKind = "contact" | "offer" | "order" | "assignment";
export type AudienceKind = "department" | "assignment" | "contact" | "offer" | "order";

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
  for (const entry of assignments) {
    if (entry.subject !== subject || entry.validFrom > atTime) continue;
    const issuerIsAdmin = entry.issuer === department.admin;
    if (entry.role === "manager" ? issuerIsAdmin : issuerIsAdmin || managers.has(entry.issuer)) {
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
  if (kind === "order") {
    if (staff || roles.has("seller")) return true;
    // Preferred-customer self-service: a customer may buy for themselves only.
    return roles.has("customer") && author === subject;
  }
  if (kind === "assignment") return roles.has("admin") || roles.has("manager");
  throw new Error(`Amway lab: unknown publish kind ${kind}.`);
}

export function audience(kind: string, { department, assignments, row }: {
  department: AmwayDepartment;
  assignments: AmwayRoleAssignment[];
  row: AmwayLabObject;
}): string[] {
  const people = new Set<string>([department.admin]);
  if (kind === "order") {
    for (const entry of assignments) {
      if (entry.role === "manager" || entry.role === "seller") people.add(entry.subject);
    }
    if ("customer" in row && typeof row.customer === "string") people.add(row.customer);
  } else if (["department", "assignment", "contact", "offer"].includes(kind)) {
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
  availability: { lot: string; facility: string; gross: number; available: number };
  rejected: Rejection[];
}

export function projectDepartment({ department, assignments, contacts, offers, orders, viewer, atTime }: {
  department: AmwayDepartment;
  assignments: AmwayRoleAssignment[];
  contacts: AmwayContact[];
  offers: AmwayOffer[];
  orders: AmwayOrder[];
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
      available: LAB_STOCK.gross - admittedOrders.reduce((sum, entry) => sum + entry.quantity, 0),
    },
    rejected,
  };
}
