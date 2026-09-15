/**
 * Pure department projection. Authority is re-derived from the replicated
 * assignment chain on every read, so a row CHUM delivered from a peer that
 * lacked authority is visible as `rejected`, never silently merged.
 */

export const LAB_STOCK = { lot: "demo-lot-a", facility: "demo-facility", gross: 10 };

export function rolesOf({ department, assignments, subject, atTime }) {
  const roles = new Set();
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

export function canPublish(kind, { department, assignments, author, subject, atTime }) {
  const roles = rolesOf({ department, assignments, subject: author, atTime });
  const staff = roles.has("admin") || roles.has("manager");
  if (kind === "contact") return author === subject || staff;
  if (kind === "offer") return staff;
  if (kind === "order") return staff || roles.has("seller");
  if (kind === "assignment") return roles.has("admin") || roles.has("manager");
  throw new Error(`Amway lab: unknown publish kind ${kind}.`);
}

export function audience(kind, { department, assignments, row }) {
  const people = new Set([department.admin]);
  if (kind === "order") {
    for (const entry of assignments) {
      if (entry.role === "manager" || entry.role === "seller") people.add(entry.subject);
    }
    people.add(row.customer);
  } else if (["department", "assignment", "contact", "offer"].includes(kind)) {
    for (const entry of assignments) people.add(entry.subject);
  } else {
    throw new Error(`Amway lab: unknown audience kind ${kind}.`);
  }
  return [...people].sort();
}

export function projectDepartment({ department, assignments, contacts, offers, orders, viewer, atTime }) {
  const rejected = [];
  const admit = (kind, type, id, author, subject) => {
    if (canPublish(kind, { department, assignments, author, subject, atTime })) return true;
    rejected.push({ type, id, reason: "publisher-not-authorized" });
    return false;
  };
  const validAssignments = assignments.filter(entry =>
    rolesOf({ department, assignments, subject: entry.subject, atTime }).has(entry.role));
  const viewerRoles = rolesOf({ department, assignments, subject: viewer, atTime });
  const customerOnly = viewerRoles.size === 1 && viewerRoles.has("customer");
  const admittedOrders = orders.filter(entry => admit("order", "AmwayOrder", entry.idempotencyKey, entry.seller));
  return {
    department: department.department,
    roles: [...viewerRoles].sort(),
    assignments: validAssignments,
    contacts: contacts.filter(entry => admit("contact", "AmwayContact", entry.person, entry.publishedBy, entry.person)),
    offers: offers.filter(entry => admit("offer", "AmwayOffer", entry.offerId, entry.publishedBy)),
    orders: customerOnly ? admittedOrders.filter(entry => entry.customer === viewer) : admittedOrders,
    availability: {
      ...LAB_STOCK,
      available: LAB_STOCK.gross - admittedOrders.reduce((sum, entry) => sum + entry.quantity, 0),
    },
    rejected,
  };
}
