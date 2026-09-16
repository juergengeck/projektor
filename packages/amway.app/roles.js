/**
 * Amway role policy, aligned with Flexibel's role management.
 *
 * Like `FlexibelRolePolicy.roleNamespaceForScope`, every Amway role lives in
 * an explicit namespace: one organization namespace plus one namespace per
 * department. The department is part of the namespace, so two departments
 * run by one owner never share role authority. Issuance follows explicit
 * edges per scope (Flexibel's `roleIssuanceEdgesForScope`): the organization
 * root enrolls admins, department admins manage their department, and
 * managers may bring in sellers and customers — nobody else issues roles.
 *
 * Effective roles project from issued assignments minus revocation and
 * expiry (Flexibel's feed-forward effective-role projection); the selected
 * role is the preferred one among the effective roles, falling back to the
 * first in role order. Native `trust.role` certificates replace these
 * records when the ONE-backed runtime lands; the namespace and edge shapes
 * are kept compatible with that migration.
 */

export const AMWAY_ROLES = ["admin", "manager", "seller", "customer"];

export const AMWAY_ROLE_NAMESPACE = "amway";
export const AMWAY_ORGANIZATION_ROLE_NAMESPACE = "amway.organization.v1";
export const AMWAY_DEPARTMENT_ROLE_NAMESPACE_PREFIX = "amway.department.v1:";

export function roleNamespaceForScope(scope) {
  if (!scope || typeof scope.kind !== "string") throw new Error("Amway: role scope is required.");
  switch (scope.kind) {
    case "organization":
      return AMWAY_ORGANIZATION_ROLE_NAMESPACE;
    case "legacy":
      return AMWAY_ROLE_NAMESPACE;
    case "department": {
      if (typeof scope.departmentId !== "string" || scope.departmentId.length === 0) {
        throw new Error("Amway: department role namespace requires a department id.");
      }
      return `${AMWAY_DEPARTMENT_ROLE_NAMESPACE_PREFIX}${encodeURIComponent(scope.departmentId)}`;
    }
    default:
      throw new Error("Amway: unknown role authority scope.");
  }
}

export function departmentIdFromRoleNamespace(namespace) {
  if (!namespace.startsWith(AMWAY_DEPARTMENT_ROLE_NAMESPACE_PREFIX)) return undefined;
  const encoded = namespace.slice(AMWAY_DEPARTMENT_ROLE_NAMESPACE_PREFIX.length);
  if (!encoded) throw new Error("Amway: department role namespace has no department id.");
  let decoded;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    throw new Error("Amway: department role namespace contains an invalid encoding.");
  }
  if (encodeURIComponent(decoded) !== encoded) {
    throw new Error("Amway: department role namespace is not canonically encoded.");
  }
  return decoded;
}

export function scopeFromRoleNamespace(namespace) {
  if (namespace === AMWAY_ORGANIZATION_ROLE_NAMESPACE) return { kind: "organization" };
  if (namespace === AMWAY_ROLE_NAMESPACE) return { kind: "legacy" };
  const departmentId = departmentIdFromRoleNamespace(namespace);
  return departmentId ? { kind: "department", departmentId } : undefined;
}

export function rootRoleForScope(scope) {
  if (!scope || typeof scope.kind !== "string") throw new Error("Amway: role scope is required.");
  return "admin";
}

export function roleIssuanceEdgesForScope(scope) {
  if (!scope || typeof scope.kind !== "string") throw new Error("Amway: role scope is required.");
  switch (scope.kind) {
    case "organization":
      return [{ issuerRole: null, subjectRole: "admin" }];
    case "department":
      // The department manager signs members: only managers issue seller
      // and customer roles. Admins enroll managers; the country organisation
      // manager (bootstrap) enrolls the first admin and department manager.
      return [
        { issuerRole: "admin", subjectRole: "manager" },
        { issuerRole: "manager", subjectRole: "seller" },
        { issuerRole: "manager", subjectRole: "customer" },
      ];
    case "legacy":
      return AMWAY_ROLES.flatMap(subjectRole => [{ issuerRole: "admin", subjectRole }]);
    default:
      throw new Error("Amway: unknown role authority scope.");
  }
}

/** Issuer roles in hand may grant this role under the scope's edges. */
export function mayIssueRole(issuerRoles, subjectRole, scope) {
  const held = new Set(issuerRoles);
  return roleIssuanceEdgesForScope(scope).some(
    edge => edge.subjectRole === subjectRole && (edge.issuerRole === null || held.has(edge.issuerRole)),
  );
}

const ROLE_ORDER = [...AMWAY_ROLES];

/**
 * Projects effective roles from assignment records (Flexibel's
 * feed-forward effective-role projection): issued, unrevoked, unexpired at
 * `atTime`, in canonical role order.
 */
export function getEffectiveRoles(assignments, person, scope, atTime) {
  const namespace = roleNamespaceForScope(scope);
  void namespace;
  const effective = new Set();
  for (const assignment of assignments) {
    if (assignment.department !== scope.departmentId) continue;
    if (assignment.subject !== person) continue;
    if (!ROLE_ORDER.includes(assignment.role)) continue;
    const end = assignment.revokedAt ?? Number.MAX_SAFE_INTEGER;
    if (assignment.validFrom <= atTime && atTime < Math.min(assignment.validUntil, end)) {
      effective.add(assignment.role);
    }
  }
  return ROLE_ORDER.filter(role => effective.has(role));
}

export function getSelectedRole(assignments, person, scope, atTime, preferred = null) {
  const effective = getEffectiveRoles(assignments, person, scope, atTime);
  if (effective.length === 0) return undefined;
  if (preferred && effective.includes(preferred)) return preferred;
  return effective[0];
}

export function hasRole(assignments, person, role, scope, atTime) {
  return getEffectiveRoles(assignments, person, scope, atTime).includes(role);
}
