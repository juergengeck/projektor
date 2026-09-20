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
  EkStockReceipt,
} from "./recipes.ts";

// The facility's stock identity. There is no opening stock: inventory exists
// only once the org (purchasing) has received goods — the manager cannot
// show inventory nobody purchased.
export const EK_STOCK = { lot: "ek-lot-a", facility: "ek-facility" };

export type PublishKind = "contact" | "offer" | "order" | "assignment" | "stock";
export type AudienceKind = "department" | "assignment" | "contact" | "offer" | "order" | "stock";

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
  // sellers appoint customers. Admin authority itself is never delegated
  // down the chain: only the root admin grants it, so a manager-issued
  // admin assignment confers nothing anywhere it replicates.
  const sellers = new Set(assignments
    .filter(entry => entry.role === "seller" && entry.validFrom <= atTime &&
      (entry.issuer === department.admin || managers.has(entry.issuer)))
    .map(entry => entry.subject));
  for (const entry of assignments) {
    if (entry.subject !== subject || entry.validFrom > atTime) continue;
    const issuerIsAdmin = entry.issuer === department.admin;
    const appointed =
      entry.role === "manager" ? issuerIsAdmin :
      entry.role === "admin" ? issuerIsAdmin :
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
    // Publishing discloses nothing beyond staff: a published offer reaches
    // the managers, never sellers or customers. The manager shares it down
    // with chosen sellers (shareOfferWithSeller), the seller further down
    // with customers (shareOffer). Appointment alone delivers no inventory.
    for (const entry of assignments) {
      if (entry.role === "manager") people.add(entry.subject);
    }
  } else if (["department", "assignment", "contact"].includes(kind)) {
    for (const entry of assignments) people.add(entry.subject);
  } else if (kind === "stock") {
    // Sellers replicate receipts so their admissions settle against the
    // shared balance; customers never hold inventory rows. Only staff
    // project the meter (see projectDepartment) — sellers see what was
    // shared down to them, customers their orders and balances.
    for (const entry of assignments) {
      if (entry.role === "manager" || entry.role === "seller") people.add(entry.subject);
    }
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
  /**
   * Settled purchases only: an admitted order exists here iff stock settled
   * it; oversold admissions land in rejected. Customers replicate neither
   * receipts nor competing admissions, so they see their own admitted
   * orders instead of the global settlement.
   */
  orders: EkOrder[];
  /** Placed but unadmitted orders (`admittedAt === 0`), awaiting the seller. */
  pendingOrders: EkOrder[];
  /** Facility balance, staff-only: sellers and customers project null and never see stock. */
  availability: { lot: string; facility: string; stocked: number; available: number } | null;
  /**
   * Money positions in minor units. Consignment chain: admission accrues the
   * customer's payable to the seller, the seller's receivable from customers
   * and equal payable to the org, and the org's receivable from sellers.
   * Placing alone moves no money.
   */
  balances: Balance[];
  rejected: Rejection[];
}

export interface Balance {
  party: string;
  role: "customer" | "seller" | "org";
  receivable: number;
  payable: number;
  currency: string;
}

export function projectDepartment({ department, assignments, contacts, offers, orders, stock, viewer, atTime }: {
  department: EkDepartment;
  assignments: EkRoleAssignment[];
  contacts: EkContact[];
  offers: EkOffer[];
  orders: EkOrder[];
  stock: EkStockReceipt[];
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
  const pendingOrders = authorizedOrders.filter(entry => entry.admittedAt === 0);
  const scopeToViewer = (list: EkOrder[]): EkOrder[] =>
    customerOnly ? list.filter(entry => entry.customer === viewer) : list;
  // One shared balance for every viewer: everything purchasing received,
  // minus everything admitted. Never viewer-scoped — the meter must agree
  // in every column.
  const stocked = stock.reduce((sum, entry) => sum + entry.quantity, 0);
  const admittedAll = authorizedOrders.filter(entry => entry.admittedAt > 0);
  // Settlement is deterministic across workers: every instance holding the
  // full picture settles the same admitted rows in the same order —
  // earliest admission first, ties broken by key — so concurrent admissions
  // for the last unit converge on one winner instead of driving
  // availability negative. The losers are rejected, never silently merged;
  // availability can never go below zero. Customers replicate neither
  // receipts nor competing admissions, so they cannot project the global
  // settlement and instead see their own admitted orders.
  const settledOrders: EkOrder[] = [];
  let settledQuantity = 0;
  if (!customerOnly) {
    for (const entry of [...admittedAll].sort((a, b) => a.admittedAt - b.admittedAt ||
      (a.idempotencyKey < b.idempotencyKey ? -1 : a.idempotencyKey > b.idempotencyKey ? 1 : 0))) {
      if (settledQuantity + entry.quantity <= stocked) {
        settledOrders.push(entry);
        settledQuantity += entry.quantity;
      } else {
        rejected.push({ type: "EkOrder", id: entry.idempotencyKey, reason: "oversold" });
      }
    }
  }
  const listedOrders = customerOnly ? scopeToViewer(admittedAll) : settledOrders;
  const staffViewer = viewerRoles.has("admin") || viewerRoles.has("manager");
  const balancesByKey = new Map<string, Balance>();
  const addBalance = (party: string, role: Balance["role"], receivable: number, payable: number, currency: string): void => {
    const key = `${party}:${currency}`;
    const entry = balancesByKey.get(key) ?? { party, role, receivable: 0, payable: 0, currency };
    entry.receivable += receivable;
    entry.payable += payable;
    balancesByKey.set(key, entry);
  };
  for (const entry of listedOrders) {
    const value = entry.quantity * entry.unitAmount;
    addBalance(entry.customer, "customer", 0, value, entry.currency);
    addBalance(entry.seller, "seller", value, value, entry.currency);
    addBalance(department.admin, "org", value, 0, entry.currency);
  }
  const balances = [...balancesByKey.values()]
    .filter(entry => !customerOnly || entry.party === viewer)
    .sort((a, b) => (a.party < b.party ? -1 : a.party > b.party ? 1 : 0));
  return {
    department: department.department,
    roles: [...viewerRoles].sort(),
    assignments: validAssignments,
    contacts: contacts.filter(entry => admit("contact", "EkContact", entry.person, entry.publishedBy, entry.person)),
    offers: offers.filter(entry => admit("offer", "EkOffer", entry.offerId, entry.publishedBy)),
    orders: listedOrders,
    pendingOrders: scopeToViewer(pendingOrders),
    availability: staffViewer
      ? { ...EK_STOCK, stocked, available: stocked - settledQuantity }
      : null,
    balances,
    rejected,
  };
}
