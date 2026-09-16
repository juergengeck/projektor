/**
 * Amway departments, scoped role assignments, and phonebook contracts.
 *
 * Semantics mirror `trust.projektor` (validity windows, revocation as new
 * evidence, action-time evaluation, fail-closed denial) without creating a
 * second identity store: subjects, issuers, and contacts are existing person
 * identity references. Full attestation-backed issuance through
 * `ProjektorTrustModule` is a later runtime integration; this module takes no
 * storage dependency so the swap stays clean.
 *
 * Every mutation appends a stable lifecycle event to `directory.events`,
 * which the journal producers (Phase 6) read as their assignment roots.
 */

import { AMWAY_ROLES, mayIssueRole } from "./roles.js";

export { AMWAY_ROLES };

/** Stable department scope. The department is part of the identity so two
 * departments run by one owner never collapse into one phonebook. */
export function departmentScope(departmentId) {
  if (typeof departmentId !== "string" || departmentId.length === 0) {
    throw new Error("Amway: department id is required.");
  }
  return `amway.department:${departmentId}`;
}

function requireIdentity(value, field) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Amway: ${field} must reference an existing person identity.`);
  }
  return value;
}

function requireWindow({ validFrom, validUntil }, what) {
  if (!Number.isSafeInteger(validFrom) || validFrom < 0) {
    throw new Error(`Amway: ${what} validFrom must be a non-negative integer.`);
  }
  if (!Number.isSafeInteger(validUntil) || validUntil <= validFrom) {
    throw new Error(`Amway: ${what} validUntil must be after validFrom.`);
  }
}

function effectiveUntil(record, atTime) {
  void atTime;
  const revokedEnd = record.revokedAt ?? Number.MAX_SAFE_INTEGER;
  return Math.min(record.validUntil, revokedEnd);
}

function isEffectiveAt(record, atTime) {
  return record.validFrom <= atTime && atTime < effectiveUntil(record, atTime);
}

export class AmwayDirectory {
  /**
   * `bootstrapIssuers` are the country organisation managers: the cert root.
   * Only they create departments and enroll the first admin; department
   * authority derives from them through the department manager.
   */
  constructor({ bootstrapIssuers = [], now = () => Date.now() } = {}) {
    this.bootstrapIssuers = new Set(bootstrapIssuers);
    this.now = now;
    this.departments = new Map();
    this.assignments = new Map();
    this.contracts = new Map();
    this.entries = new Map();
    this.events = [];
    this.serial = 0;
  }

  #record(type, detail, atTime) {
    this.serial += 1;
    const event = { seq: this.serial, type, atTime, ...detail };
    this.events.push(event);
    return event;
  }

  #assignmentId() {
    return `assignment-${this.serial + 1}`;
  }

  #contractId() {
    return `contract-${this.serial + 1}`;
  }

  createDepartment({ id, name, manager, createdBy, createdAt } = {}) {
    requireIdentity(createdBy, "createdBy");
    if (!this.bootstrapIssuers.has(createdBy)) {
      throw new Error("Amway: department creation requires the country organisation manager.");
    }
    if (typeof id !== "string" || id.length === 0) throw new Error("Amway: department id is required.");
    if (typeof name !== "string" || name.length === 0) throw new Error("Amway: department name is required.");
    requireIdentity(manager, "manager");
    if (this.departments.has(id)) throw new Error(`Amway: department ${id} already exists.`);
    const atTime = createdAt ?? this.now();
    const department = { id, name, manager, scope: departmentScope(id), createdBy, createdAt: atTime };
    this.departments.set(id, department);
    this.#record("department.created", { department: id, manager, createdBy }, atTime);
    // Root enrollment: the country organisation manager directly enrolls
    // the department manager. Every later authority derives from this act.
    this.#issueManagerAssignment({ issuer: createdBy, subject: manager, department: id, from: atTime });
    return { ...department };
  }

  #issueManagerAssignment({ issuer, subject, department, from }) {
    const id = this.#assignmentId();
    const assignment = {
      id, issuer, subject, role: "manager", department,
      issuerRoles: this.bootstrapIssuers.has(issuer) ? ["organization-manager"] : [...this.#roleAt(issuer, department, from)],
      facility: null, validFrom: from, validUntil: Number.MAX_SAFE_INTEGER,
      delegationLimits: null, revokedAt: null, revocationReason: null,
    };
    this.assignments.set(id, assignment);
    this.#record("assignment.issued", { assignment: id, issuer, subject, role: "manager", department }, from);
    return assignment;
  }

  /**
   * Succession: an admin or the country organisation manager transfers the
   * department to a new manager. Prior live manager assignments are revoked
   * so the department always has exactly one manager of record.
   */
  setDepartmentManager({ issuer, department, manager, atTime } = {}) {
    requireIdentity(issuer, "issuer");
    requireIdentity(manager, "manager");
    const record = this.#requireDepartment(department);
    const at = atTime ?? this.now();
    const orgRoot = this.bootstrapIssuers.has(issuer);
    if (!orgRoot && !mayIssueRole([...this.#roleAt(issuer, department, at)], "manager", { kind: "department", departmentId: department })) {
      throw new Error(`Amway: ${issuer} may not transfer department ${department}.`);
    }
    for (const assignment of this.assignments.values()) {
      if (assignment.department === department && assignment.role === "manager" && isEffectiveAt(assignment, at)) {
        assignment.revokedAt = at;
        assignment.revocationReason = "succession";
        this.#record("assignment.revoked", { assignment: assignment.id, issuer, reason: "succession" }, at);
      }
    }
    this.#issueManagerAssignment({ issuer, subject: manager, department, from: at });
    record.manager = manager;
    this.#record("department.manager-transferred", { department, manager, issuer }, at);
    return { ...record };
  }

  #requireDepartment(id) {
    const department = this.departments.get(id);
    if (!department) throw new Error(`Amway: unknown department ${id}.`);
    return department;
  }

  #isAdminAt(person, department, atTime) {
    if (this.bootstrapIssuers.has(person)) return true;
    for (const assignment of this.assignments.values()) {
      if (
        assignment.department === department && assignment.subject === person &&
        assignment.role === "admin" && isEffectiveAt(assignment, atTime)
      ) {
        return true;
      }
    }
    return false;
  }

  #roleAt(person, department, atTime) {
    const roles = new Set();
    for (const assignment of this.assignments.values()) {
      if (
        assignment.department === department && assignment.subject === person &&
        isEffectiveAt(assignment, atTime)
      ) {
        roles.add(assignment.role);
      }
    }
    return roles;
  }

  assignRole({ issuer, subject, role, department, facility, validFrom, validUntil, delegationLimits } = {}) {
    requireIdentity(issuer, "issuer");
    requireIdentity(subject, "subject");
    this.#requireDepartment(department);
    if (!AMWAY_ROLES.includes(role)) throw new Error(`Amway: unknown role ${role}.`);
    const from = validFrom ?? this.now();
    const until = validUntil ?? Number.MAX_SAFE_INTEGER;
    requireWindow({ validFrom: from, validUntil: until }, "assignment");
    // Flexibel-style issuance edges: bootstrap issuers enroll the first
    // admin under the organization scope; within a department, admins manage
    // and managers may bring sellers and customers. Nothing else issues.
    const scope = { kind: "department", departmentId: department };
    const issuerRoles = new Set(this.#roleAt(issuer, department, from));
    const permitted = this.bootstrapIssuers.has(issuer) && role === "admin"
      ? true
      : mayIssueRole([...issuerRoles], role, scope);
    if (!permitted) {
      throw new Error(`Amway: ${issuer} may not assign role ${role} in department ${department}.`);
    }
    const id = this.#assignmentId();
    const assignment = {
      id, issuer, subject, role, department,
      issuerRoles: this.bootstrapIssuers.has(issuer) ? ["organization-manager"] : [...issuerRoles],
      facility: facility ?? null, validFrom: from, validUntil: until,
      delegationLimits: delegationLimits ?? null, revokedAt: null, revocationReason: null,
    };
    this.assignments.set(id, assignment);
    this.#record("assignment.issued", { assignment: id, issuer, subject, role, department }, from);
    return assignment;
  }

  revokeRole({ issuer, assignment: id, reason, atTime } = {}) {
    requireIdentity(issuer, "issuer");
    const assignment = this.assignments.get(id);
    if (!assignment) throw new Error(`Amway: unknown assignment ${id}.`);
    const at = atTime ?? this.now();
    if (!this.#isAdminAt(issuer, assignment.department, at)) {
      throw new Error(`Amway: ${issuer} may not revoke roles in department ${assignment.department}.`);
    }
    if (typeof reason !== "string" || reason.length === 0) {
      throw new Error("Amway: revocation requires a reason.");
    }
    if (assignment.revokedAt !== null) throw new Error(`Amway: assignment ${id} is already revoked.`);
    assignment.revokedAt = at;
    assignment.revocationReason = reason;
    this.#record("assignment.revoked", { assignment: id, issuer, reason }, at);
    return assignment;
  }

  effectiveRoles({ subject, department, atTime } = {}) {
    this.#requireDepartment(department);
    return this.#roleAt(requireIdentity(subject, "subject"), department, atTime ?? this.now());
  }

  #isManagerAt(person, department, atTime) {
    return this.#isAdminAt(person, department, atTime) || this.#roleAt(person, department, atTime).has("manager");
  }

  /**
   * A phonebook contract authorizes contact between holder and contact for an
   * explicit purpose. Directory entries and role labels alone never authorize
   * messaging or attachment access.
   */
  grantContract({ issuer, holder, contact, purpose, participants, department, validFrom, validUntil } = {}) {
    requireIdentity(issuer, "issuer");
    requireIdentity(holder, "holder");
    requireIdentity(contact, "contact");
    this.#requireDepartment(department);
    if (holder === contact) throw new Error("Amway: a contract requires two distinct persons.");
    if (typeof purpose !== "string" || purpose.length === 0) {
      throw new Error("Amway: a contract requires an explicit purpose.");
    }
    const from = validFrom ?? this.now();
    const until = validUntil ?? Number.MAX_SAFE_INTEGER;
    requireWindow({ validFrom: from, validUntil: until }, "contract");
    if (!this.#isManagerAt(issuer, department, from)) {
      throw new Error(`Amway: ${issuer} may not grant contracts in department ${department}.`);
    }
    const id = this.#contractId();
    const contract = {
      id, issuer, holder, contact, purpose, department,
      participants: participants ?? [holder, contact],
      validFrom: from, validUntil: until, revokedAt: null, revocationReason: null,
    };
    this.contracts.set(id, contract);
    this.#upsertEntry({ department, person: contact, sharedWith: holder, atTime: from });
    this.#record("contract.granted", { contract: id, issuer, holder, contact, department }, from);
    return contract;
  }

  revokeContract({ issuer, contract: id, reason, atTime } = {}) {
    requireIdentity(issuer, "issuer");
    const contract = this.contracts.get(id);
    if (!contract) throw new Error(`Amway: unknown contract ${id}.`);
    const at = atTime ?? this.now();
    if (!this.#isManagerAt(issuer, contract.department, at)) {
      throw new Error(`Amway: ${issuer} may not revoke contracts in department ${contract.department}.`);
    }
    if (typeof reason !== "string" || reason.length === 0) {
      throw new Error("Amway: revocation requires a reason.");
    }
    if (contract.revokedAt !== null) throw new Error(`Amway: contract ${id} is already revoked.`);
    // Explicit revocation governs future contract-dependent actions. Content
    // already received is preserved; only future actions are denied.
    contract.revokedAt = at;
    contract.revocationReason = reason;
    this.#record("contract.revoked", { contract: id, issuer, reason }, at);
    return contract;
  }

  effectiveContract({ holder, contact, department, atTime } = {}) {
    const at = atTime ?? this.now();
    for (const contract of this.contracts.values()) {
      if (
        contract.department === department && contract.holder === holder &&
        contract.contact === contact && isEffectiveAt(contract, at)
      ) {
        return contract;
      }
    }
    return undefined;
  }

  #entryKey(department, person, sharedWith) {
    return `${departmentScope(department)}:${person}:${sharedWith}`;
  }

  #upsertEntry({ department, person, sharedWith, atTime }) {
    const key = this.#entryKey(department, person, sharedWith);
    const existing = this.entries.get(key);
    if (existing) {
      existing.sharedAt = atTime;
      return existing;
    }
    const entry = { department, person, sharedWith, sharedAt: atTime, published: true };
    this.entries.set(key, entry);
    return entry;
  }

  /**
   * Unpublishing is a directory action only: it hides the entry from future
   * directory reads but never revokes an existing pairing or chat contract.
   */
  unpublishEntry({ issuer, department, person, sharedWith, atTime } = {}) {
    requireIdentity(issuer, "issuer");
    const at = atTime ?? this.now();
    if (!this.#isManagerAt(issuer, department, at)) {
      throw new Error(`Amway: ${issuer} may not unpublish entries in department ${department}.`);
    }
    const entry = this.entries.get(this.#entryKey(department, person, sharedWith));
    if (!entry) throw new Error("Amway: unknown directory entry.");
    entry.published = false;
    this.#record("entry.unpublished", { department, person, sharedWith, issuer }, at);
    return entry;
  }

  /**
   * Customer phonebooks expose only relationships shared with that customer.
   * Sellers see contacts they hold effective contracts with; admins and
   * managers see the department directory.
   */
  directoryFor({ viewer, department, atTime } = {}) {
    requireIdentity(viewer, "viewer");
    this.#requireDepartment(department);
    const at = atTime ?? this.now();
    const roles = this.#roleAt(viewer, department, at);
    const privileged = roles.has("admin") || roles.has("manager") || this.bootstrapIssuers.has(viewer);
    const visible = [];
    for (const entry of this.entries.values()) {
      if (entry.department !== department) continue;
      if (!entry.published && !privileged) continue;
      if (privileged || entry.sharedWith === viewer) visible.push({ ...entry });
    }
    return visible;
  }

  /**
   * Action-time authority check. Missing, revoked, expired, or insufficient
   * authority denies by throwing; the absence of an exception is a decision
   * for this exact action and time only.
   */
  authorize({ subject, action, department, facility, contact, atTime } = {}) {
    requireIdentity(subject, "subject");
    this.#requireDepartment(department);
    const at = atTime ?? this.now();
    const roles = this.#roleAt(subject, department, at);
    switch (action) {
      case "department.manage":
        if (!roles.has("admin") && !this.bootstrapIssuers.has(subject)) {
          throw new Error(`Amway: ${subject} may not manage department ${department}.`);
        }
        return true;
      case "facility.operate": {
        if (!roles.has("manager") && !roles.has("admin")) {
          throw new Error(`Amway: ${subject} may not operate facilities in department ${department}.`);
        }
        if (facility !== undefined) {
          const scoped = [...this.assignments.values()].some(assignment =>
            assignment.department === department && assignment.subject === subject &&
            (assignment.role === "manager" || assignment.role === "admin") &&
            (assignment.facility === null || assignment.facility === facility) &&
            isEffectiveAt(assignment, at));
          if (!scoped && !this.bootstrapIssuers.has(subject)) {
            throw new Error(`Amway: ${subject} may not operate facility ${facility}.`);
          }
        }
        return true;
      }
      case "goods.sell":
        if (!roles.has("seller")) {
          throw new Error(`Amway: ${subject} may not sell in department ${department}.`);
        }
        return true;
      case "chat.send": {
        requireIdentity(contact, "contact");
        const outgoing = this.effectiveContract({ holder: subject, contact, department, atTime: at });
        const incoming = this.effectiveContract({ holder: contact, contact: subject, department, atTime: at });
        if (!outgoing && !incoming) {
          throw new Error(`Amway: no effective contract authorizes chat between ${subject} and ${contact}.`);
        }
        return true;
      }
      default:
        throw new Error(`Amway: unknown action ${action}.`);
    }
  }
}
