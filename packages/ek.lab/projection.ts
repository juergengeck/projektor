/**
 * Pure department projection. Authority is re-derived from the replicated
 * assignment chain on every read, so a row CHUM delivered from a peer that
 * lacked authority is visible as `rejected`, never silently merged.
 */

import type {
  EkContact,
  EkDepartment,
  EkLabObject,
  EkOffer,
  EkOrder,
  EkRoleAssignment,
} from "./recipes.ts";

export const EK_STOCK = { lot: "ek-lot-a", facility: "ek-facility", gross: 10 };

export type PublishKind = "contact" | "offer" | "order" | "assignment";
export type AudienceKind = "department" | "assignment" | "contact" | "offer" | "order";

export interface Rejection {
  type: string;
  id: string;
  reason: string;
}

interface AuthorityContext {
  department: EkDepartment;
  assignments: EkRoleAssignment[];
  author?: string;
  subject?: string;
  atTime: number;
}

export function rolesOf({ department, assignments, subject, atTime }: {
  department: EkDepartment;
  assignments: EkRoleAssignment[];
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
  if (kind === "order") {
    if (staff || roles.has("seller")) return true;
    // Preferred-customer self-service: a customer may buy for themselves only.
    return roles.has("customer") && author === subject;
  }
  // Sellers may only ever issue customer appointments; assignRole gates the
  // exact chain and rolesOf re-validates it on every read.
  if (kind === "assignment") return roles.has("admin") || roles.has("manager") || roles.has("seller");
  throw new Error(`Ek lab: unknown publish kind ${kind}.`);
}

export function audience(kind: string, { department, assignments, row }: {
  department: EkDepartment;
  assignments: EkRoleAssignment[];
  row: EkLabObject;
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
  } else if (["department", "assignment", "contact"].includes(kind)) {
    for (const entry of assignments) people.add(entry.subject);
  } else {
    throw new Error(`Ek lab: unknown audience kind ${kind}.`);
  }
  return [...people].sort();
}

export interface DepartmentProjection {
  department: string;
  roles: string[];
  assignments: EkRoleAssignment[];
  contacts: EkContact[];
  offers: EkOffer[];
  /** Admitted orders only: a purchase exists iff the seller admitted a placed order. */
  orders: EkOrder[];
  /** Placed but unadmitted orders (`admittedAt === 0`), awaiting the seller. */
  pendingOrders: EkOrder[];
  availability: { lot: string; facility: string; gross: number; available: number };
  rejected: Rejection[];
}

export function projectDepartment({ department, assignments, contacts, offers, orders, viewer, atTime }: {
  department: EkDepartment;
  assignments: EkRoleAssignment[];
  contacts: EkContact[];
  offers: EkOffer[];
  orders: EkOrder[];
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
  const authorizedOrders = orders.filter(entry => admit("order", "EkOrder", entry.idempotencyKey, entry.seller, entry.customer));
  const admittedOrders = authorizedOrders.filter(entry => entry.admittedAt > 0);
  const pendingOrders = authorizedOrders.filter(entry => entry.admittedAt === 0);
  const scopeToViewer = (list: EkOrder[]): EkOrder[] =>
    customerOnly ? list.filter(entry => entry.customer === viewer) : list;
  return {
    department: department.department,
    roles: [...viewerRoles].sort(),
    assignments: validAssignments,
    contacts: contacts.filter(entry => admit("contact", "EkContact", entry.person, entry.publishedBy, entry.person)),
    offers: offers.filter(entry => admit("offer", "EkOffer", entry.offerId, entry.publishedBy)),
    orders: scopeToViewer(admittedOrders),
    pendingOrders: scopeToViewer(pendingOrders),
    availability: {
      ...EK_STOCK,
      available: EK_STOCK.gross - admittedOrders.reduce((sum, entry) => sum + entry.quantity, 0),
    },
    rejected,
  };
}
