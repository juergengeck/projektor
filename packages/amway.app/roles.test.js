import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AMWAY_DEPARTMENT_ROLE_NAMESPACE_PREFIX,
  AMWAY_ORGANIZATION_ROLE_NAMESPACE,
  departmentIdFromRoleNamespace,
  getEffectiveRoles,
  getSelectedRole,
  hasRole,
  mayIssueRole,
  roleIssuanceEdgesForScope,
  roleNamespaceForScope,
  rootRoleForScope,
  scopeFromRoleNamespace,
} from "./roles.js";

const scope = { kind: "department", departmentId: "nord" };

test("department namespaces bind the department canonically", () => {
  const namespace = roleNamespaceForScope(scope);
  assert.ok(namespace.startsWith(AMWAY_DEPARTMENT_ROLE_NAMESPACE_PREFIX));
  assert.equal(departmentIdFromRoleNamespace(namespace), "nord");
  assert.deepEqual(scopeFromRoleNamespace(namespace), scope);
  assert.deepEqual(scopeFromRoleNamespace(AMWAY_ORGANIZATION_ROLE_NAMESPACE), { kind: "organization" });
  assert.equal(scopeFromRoleNamespace("unrelated"), undefined);
  assert.throws(() => roleNamespaceForScope({ kind: "department", departmentId: "" }), /department id/);
  assert.throws(() => departmentIdFromRoleNamespace(`${AMWAY_DEPARTMENT_ROLE_NAMESPACE_PREFIX}%FF`), /invalid encoding/);
  assert.equal(roleNamespaceForScope({ kind: "organization" }), AMWAY_ORGANIZATION_ROLE_NAMESPACE);
  assert.equal(rootRoleForScope(scope), "admin");
});

test("issuance edges let admins manage and managers bring sellers and customers", () => {
  const edges = roleIssuanceEdgesForScope(scope);
  assert.ok(edges.some(edge => edge.issuerRole === "admin" && edge.subjectRole === "manager"));
  assert.ok(edges.some(edge => edge.issuerRole === "manager" && edge.subjectRole === "seller"));
  assert.ok(edges.some(edge => edge.issuerRole === "manager" && edge.subjectRole === "customer"));
  assert.ok(!edges.some(edge => edge.issuerRole === "manager" && edge.subjectRole === "admin"));
  assert.ok(!edges.some(edge => edge.issuerRole === "seller"));
  assert.equal(mayIssueRole(["manager"], "seller", scope), true);
  assert.equal(mayIssueRole(["manager"], "customer", scope), true);
  assert.equal(mayIssueRole(["manager"], "manager", scope), false);
  assert.equal(mayIssueRole(["admin"], "manager", scope), true);
  assert.equal(mayIssueRole(["admin"], "seller", scope), false);
  assert.equal(mayIssueRole(["seller"], "seller", scope), false);
  assert.equal(mayIssueRole([], "admin", { kind: "organization" }), true);
});

const records = [
  { subject: "person:seller", role: "seller", department: "nord", validFrom: 1_000, validUntil: 5_000, revokedAt: null },
  { subject: "person:seller", role: "customer", department: "nord", validFrom: 2_000, validUntil: 5_000, revokedAt: 3_000 },
  { subject: "person:seller", role: "seller", department: "sued", validFrom: 1_000, validUntil: 5_000, revokedAt: null },
];

test("effective roles project issued minus revoked and expired evidence", () => {
  assert.deepEqual(getEffectiveRoles(records, "person:seller", scope, 1_500), ["seller"]);
  assert.deepEqual(getEffectiveRoles(records, "person:seller", scope, 2_500), ["seller", "customer"]);
  // Revocation ends the customer role while the seller role continues.
  assert.deepEqual(getEffectiveRoles(records, "person:seller", scope, 3_500), ["seller"]);
  assert.deepEqual(getEffectiveRoles(records, "person:seller", scope, 6_000), []);
  // Another department's assignment never leaks across the namespace.
  assert.deepEqual(
    getEffectiveRoles(records, "person:seller", { kind: "department", departmentId: "sued" }, 1_500),
    ["seller"],
  );
});

test("selected role prefers among effective roles and falls back to role order", () => {
  assert.equal(getSelectedRole(records, "person:seller", scope, 2_500, "customer"), "customer");
  assert.equal(getSelectedRole(records, "person:seller", scope, 2_500, "admin"), "seller");
  assert.equal(getSelectedRole(records, "person:seller", scope, 2_500), "seller");
  assert.equal(getSelectedRole(records, "person:seller", scope, 6_000), undefined);
  assert.equal(hasRole(records, "person:seller", "seller", scope, 1_500), true);
  assert.equal(hasRole(records, "person:seller", "customer", scope, 3_500), false);
});
