/**
 * Role-scoped invitation URLs with pairing accept, following the ecosystem
 * (Flexibel/connection.core) invite shape: an invitation is a URL capability
 * carrying finalized metadata — inviter, department, role, expiry — and
 * acceptance binds the joiner's identity to a published contact before the
 * manager-signed role assignment issues.
 *
 * Transport pairing lands through `pairingComplete` listeners: the invite
 * carries the connection.core pairing intent (topic plus connection mode,
 * primed by default so the authenticated socket is reused for CHUM), and
 * when the transport reports the completed pairing the same member binding
 * runs that a local URL accept would perform.
 */

import { departmentScope } from "./departments.js";

/** Environment-neutral random hex: WebCrypto in Node, browsers, and workers. */
function randomHex(bytes) {
  const cryptoRef = globalThis.crypto;
  if (!cryptoRef || typeof cryptoRef.getRandomValues !== "function") {
    throw new Error("Amway invites: secure randomness is unavailable in this runtime.");
  }
  return [...cryptoRef.getRandomValues(new Uint8Array(bytes))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export const AMWAY_INVITE_URL_BASE = "https://projektor.one/amway/invite";

function fail(message) {
  throw new Error(message);
}

function required(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Amway invites: ${field} is required.`);
  return text;
}

export function invitationUrl(token) {
  return `${AMWAY_INVITE_URL_BASE}/${token}`;
}

export function invitationTokenFromUrl(url) {
  const text = required(url, "invitationUrl");
  const prefix = `${AMWAY_INVITE_URL_BASE}/`;
  if (!text.startsWith(prefix)) fail("Amway invites: not an Amway invitation URL.");
  const token = text.slice(prefix.length).split(/[?#]/)[0];
  if (!token) fail("Amway invites: invitation URL carries no token.");
  return token;
}

/**
 * Validates the connection.core pairing intent carried by an invite: the
 * topic the joiner pairs into (defaulting to the department scope, the
 * joinTopic topicId) and the connection mode. Primed is the default so the
 * authenticated pairing socket is reused for CHUM instead of opening a
 * second relay connection.
 */
export function pairingIntent(pairing, department) {
  if (pairing === null || pairing === undefined) return null;
  if (typeof pairing !== "object" || Array.isArray(pairing)) {
    fail("Amway invites: pairing intent must be an object.");
  }
  const topic = typeof pairing.topic === "string" && pairing.topic.trim()
    ? pairing.topic.trim()
    : departmentScope(required(department, "department"));
  const connectionMode = pairing.connectionMode ?? "primed";
  if (!["standard", "primed"].includes(connectionMode)) {
    fail("Amway invites: pairing connectionMode must be standard or primed.");
  }
  return { topic, connectionMode };
}

export class AmwayInvites {
  constructor({ directory, phonebook, now = () => Date.now() } = {}) {
    if (!directory) fail("Amway invites: the department directory is required.");
    if (!phonebook) fail("Amway invites: the phonebook is required.");
    this.directory = directory;
    this.phonebook = phonebook;
    this.now = now;
    this.invites = new Map();
    this.pairingListeners = new Set();
  }

  /**
   * Registers a transport pairing listener, called with the pairing record
   * once `pairingComplete` binds a member. Returns an unsubscribe function.
   */
  onPairingComplete(listener) {
    if (typeof listener !== "function") fail("Amway invites: pairing listener must be a function.");
    this.pairingListeners.add(listener);
    return () => this.pairingListeners.delete(listener);
  }

  createInvite({ issuer, department, role, label = null, ttlMs = 7 * 24 * 60 * 60 * 1000, pairing = null } = {}) {
    issuer = required(issuer, "issuer");
    department = required(department, "department");
    role = required(role, "role");
    if (!["seller", "customer"].includes(role)) {
      fail("Amway invites: invitations cover sellers and customers; managers enroll through succession.");
    }
    if (!this.directory.departments.has(department)) {
      fail(`Amway invites: unknown department ${department}.`);
    }
    const atTime = this.now();
    const issuerRoles = this.directory.effectiveRoles({ subject: issuer, department, atTime });
    if (!issuerRoles.has("manager") && !issuerRoles.has("admin")) {
      fail(`Amway invites: ${issuer} may not invite into department ${department}.`);
    }
    const token = randomHex(12);
    const invite = {
      token, url: invitationUrl(token), issuer, department, role,
      label, createdAt: atTime, expiresAt: atTime + ttlMs,
      pairing: pairingIntent(pairing, department),
      acceptedBy: null, acceptedAt: null, pairedBy: null, pairedAt: null, revokedAt: null,
    };
    this.invites.set(token, invite);
    return { ...invite };
  }

  listInvites({ department, includeUsed = false } = {}) {
    return [...this.invites.values()]
      .filter(entry => !department || entry.department === department)
      .filter(entry => includeUsed || (!entry.acceptedBy && !entry.revokedAt))
      .map(entry => ({ ...entry }));
  }

  revokeInvite({ issuer, token } = {}) {
    const invite = this.invites.get(required(token, "token"));
    if (!invite) fail("Amway invites: unknown invitation.");
    if (invite.acceptedBy) fail("Amway invites: invitation already accepted.");
    const roles = this.directory.effectiveRoles({
      subject: required(issuer, "issuer"), department: invite.department, atTime: this.now(),
    });
    if (!roles.has("manager") && !roles.has("admin") && issuer !== invite.issuer) {
      fail(`Amway invites: ${issuer} may not revoke this invitation.`);
    }
    invite.revokedAt = this.now();
    return { ...invite };
  }

  /**
   * The single member binding behind every accept path: the joiner's
   * identity binds to a published contact first, then the inviter's
   * signature issues the role assignment (re-validated at accept time).
   */
  #bindMember(invite, { person, name, atTime, pairedBy }) {
    const published = this.phonebook.publishContact({
      publisher: person, person, name,
      department: invite.department, role: invite.role,
    });
    const assignment = this.directory.assignRole({
      issuer: invite.issuer, subject: person, role: invite.role,
      department: invite.department, validFrom: atTime,
    });
    invite.acceptedBy = person;
    invite.acceptedAt = atTime;
    invite.pairedBy = pairedBy;
    invite.pairedAt = pairedBy ? atTime : null;
    return {
      pairing: {
        person, role: invite.role, department: invite.department,
        contact: published.id, assignment: assignment.id,
        pairedBy, pairedAt: invite.pairedAt,
      },
      invite: { ...invite },
    };
  }

  /**
   * Accepts the invitation URL and pairs the member locally, without
   * transport pairing evidence.
   */
  acceptInvite({ invitationUrl: url, person, name } = {}) {
    const token = invitationTokenFromUrl(url);
    const invite = this.invites.get(token);
    if (!invite) fail("Amway invites: unknown invitation.");
    person = required(person, "person");
    name = required(name, "name");
    const atTime = this.now();
    if (invite.revokedAt !== null) fail("Amway invites: invitation revoked.");
    if (invite.acceptedBy) fail("Amway invites: invitation already used.");
    if (atTime > invite.expiresAt) fail("Amway invites: invitation expired.");
    return this.#bindMember(invite, { person, name, atTime, pairedBy: null });
  }

  /**
   * Lands a completed transport pairing (connection.core
   * `onPairingComplete`): validates the invite and the paired topic, then
   * runs the same member binding as a URL accept and notifies the pairing
   * listeners with the pairing record.
   */
  pairingComplete({ token = null, invitationUrl: url = null, person, name, topicId = null, remotePerson = null, pairingUrl = null } = {}) {
    if (token === null && url === null) {
      fail("Amway invites: pairing completion requires a token or invitation URL.");
    }
    const invite = this.invites.get(token ?? invitationTokenFromUrl(url));
    if (!invite) fail("Amway invites: unknown invitation.");
    person = required(person, "person");
    name = required(name, "name");
    const atTime = this.now();
    if (invite.revokedAt !== null) fail("Amway invites: invitation revoked.");
    if (invite.acceptedBy) fail("Amway invites: invitation already used.");
    if (atTime > invite.expiresAt) fail("Amway invites: invitation expired.");
    if (invite.pairing && topicId !== null && topicId !== undefined && topicId !== invite.pairing.topic) {
      fail("Amway invites: pairing arrived for a different topic.");
    }
    const pairedBy = remotePerson === null || remotePerson === undefined
      ? person
      : required(remotePerson, "remotePerson");
    if (pairingUrl !== null && pairingUrl !== undefined) {
      invite.pairingUrl = String(pairingUrl);
    }
    const result = this.#bindMember(invite, { person, name, atTime, pairedBy });
    for (const listener of this.pairingListeners) {
      listener({ ...result.pairing, invite: result.invite });
    }
    return result;
  }
}
