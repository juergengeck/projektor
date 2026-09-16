/**
 * Contact-owned phonebook with certified contacts, aligned with Flexibel.
 *
 * Following the Flexibel workspace rules: published contact evidence is
 * created first and contact-owned; phonebook entries are self-verifying
 * certified-contact roots; grants share the existing phonebook id with
 * currently certified contacts. The department is part of the phonebook
 * identity, so one owner running several departments keeps one phonebook
 * per department.
 *
 * The certificate root is the role assignment id from `AmwayDirectory`
 * (the role cert chain with `subjectContact`, in Flexibel terms).
 * Certification is current only while that assignment is effective at read
 * time — revocation or expiry drops the contact from every granted view
 * without deleting history. Native `trust.role` bundles replace these
 * roots when the ONE-backed runtime lands.
 */

import { mayIssueRole } from "./roles.js";

function fail(message) {
  throw new Error(message);
}

function requiredString(value, field) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`Amway phonebook: ${field} is required.`);
  return text;
}

const encode = value => encodeURIComponent(requiredString(value, "id part"));

export function buildPhoneBookId(departmentId, ownerId) {
  return `phonebook:amway:${encode(departmentId)}:${encode(ownerId)}`;
}

export function buildCertifiedContactId(publishedContactId, certRoot) {
  return `certifiedpublishedcontact:amway:${encode(publishedContactId)}:${encode(certRoot)}`;
}

export class AmwayPhoneBook {
  constructor({ directory = null, now = () => Date.now() } = {}) {
    if (!directory) throw new Error("Amway phonebook: the department directory is required.");
    this.directory = directory;
    this.now = now;
    this.contacts = new Map();
    this.certified = new Map();
    this.books = new Map();
    this.serial = 0;
  }

  #managerOf(department) {
    const record = this.directory.departments.get(department);
    if (!record) throw new Error(`Amway phonebook: unknown department ${department}.`);
    return record.manager;
  }

  #publisherMayPublish(publisher, person, department, atTime) {
    if (publisher === person) return true;
    if (!this.directory) return false;
    const roles = this.directory.effectiveRoles({ subject: publisher, department, atTime });
    return roles.has("admin") || roles.has("manager");
  }

  /**
   * Owner-published contact evidence. Anyone may publish their own contact;
   * publishing for someone else requires an admin or manager role.
   */
  publishContact({ publisher, person, name, department, role, validUntil = null } = {}) {
    const atTime = this.now();
    publisher = requiredString(publisher, "publisher");
    person = requiredString(person, "person");
    department = requiredString(department, "department");
    if (!this.directory?.departments?.has(department)) {
      throw new Error(`Amway phonebook: unknown department ${department}.`);
    }
    if (!this.#publisherMayPublish(publisher, person, department, atTime)) {
      throw new Error(`Amway phonebook: ${publisher} may not publish a contact for ${person}.`);
    }
    this.serial += 1;
    const contact = {
      id: `publishedcontact:amway:${encode(department)}:${encode(person)}:${this.serial}`,
      person, name: requiredString(name, "name"), department,
      role: requiredString(role, "role"), publishedBy: publisher,
      publishedAt: atTime, validUntil,
    };
    this.contacts.set(contact.id, contact);
    return { ...contact };
  }

  certifyContact({ publishedContact: contactId, roleSubject, certRoot } = {}) {
    const contact = this.contacts.get(requiredString(contactId, "publishedContact"));
    if (!contact) throw new Error(`Amway phonebook: unknown contact ${contactId}.`);
    roleSubject = requiredString(roleSubject, "roleSubject");
    certRoot = requiredString(certRoot, "certRoot");
    if (contact.person !== roleSubject) {
      throw new Error("Amway phonebook: certification subject must be the contact person.");
    }
    // The manager signs members: the cert-root assignment must have been
    // issued under an issuing role for its subject role — the recorded
    // issuer roles prove this without time-travel, so succession never
    // invalidates previously signed members.
    const assignment = this.directory.assignments.get(certRoot);
    if (!assignment) throw new Error(`Amway phonebook: unknown cert-root assignment ${certRoot}.`);
    if (assignment.subject !== roleSubject || assignment.department !== contact.department) {
      throw new Error("Amway phonebook: cert root does not cover this contact.");
    }
    const orgSigned = this.directory.bootstrapIssuers.has(assignment.issuer);
    if (!orgSigned && !mayIssueRole(
      assignment.issuerRoles ?? [],
      assignment.role,
      { kind: "department", departmentId: contact.department },
    )) {
      throw new Error(`Amway phonebook: ${assignment.issuer} never held signing authority for ${assignment.role}.`);
    }
    const certified = {
      id: buildCertifiedContactId(contact.id, certRoot),
      publishedContact: contact.id, roleSubject, certRoot,
      certifiedAt: this.now(),
    };
    this.certified.set(certified.id, certified);
    return { ...certified };
  }

  /** Currently certified: the cert-root assignment is effective at read time. */
  isCertified(certifiedId, atTime = this.now()) {
    const certified = this.certified.get(certifiedId);
    if (!certified || !this.directory) return false;
    const assignment = this.directory.assignments.get(certified.certRoot);
    if (!assignment || assignment.subject !== certified.roleSubject) return false;
    const end = assignment.revokedAt ?? Number.MAX_SAFE_INTEGER;
    return assignment.validFrom <= atTime && atTime < Math.min(assignment.validUntil, end);
  }

  /**
   * The department manager owns the department phonebook: creation requires
   * the owner to be the manager of record holding an effective manager role.
   */
  createPhoneBook({ department, owner } = {}) {
    department = requiredString(department, "department");
    owner = requiredString(owner, "owner");
    if (owner !== this.#managerOf(department)) {
      throw new Error(`Amway phonebook: ${owner} is not the manager of department ${department}.`);
    }
    const roles = this.directory.effectiveRoles({ subject: owner, department, atTime: this.now() });
    if (!roles.has("manager")) {
      throw new Error(`Amway phonebook: ${owner} holds no effective manager role in department ${department}.`);
    }
    const id = buildPhoneBookId(department, owner);
    if (this.books.has(id)) return { ...this.books.get(id), entries: [...this.books.get(id).entries] };
    const book = { id, department, owner, entries: [], grants: [], createdAt: this.now() };
    this.books.set(id, book);
    return { ...book };
  }

  /**
   * Ownership follows succession: only the current manager of record may
   * take over the department phonebook, granted by an admin.
   */
  transferPhoneBook({ phonebook: bookId, newOwner, grantedBy } = {}) {
    const book = this.books.get(requiredString(bookId, "phonebook"));
    if (!book) throw new Error(`Amway phonebook: unknown phonebook ${bookId}.`);
    newOwner = requiredString(newOwner, "newOwner");
    if (newOwner !== this.#managerOf(book.department)) {
      throw new Error(`Amway phonebook: ${newOwner} is not the manager of department ${book.department}.`);
    }
    this.directory.authorize({
      subject: requiredString(grantedBy, "grantedBy"),
      action: "department.manage", department: book.department, atTime: this.now(),
    });
    const transferred = {
      ...book, owner: newOwner, id: buildPhoneBookId(book.department, newOwner),
      entries: [...book.entries], grants: book.grants.map(grant => ({ ...grant })),
    };
    this.books.delete(book.id);
    this.books.set(transferred.id, transferred);
    return { ...transferred };
  }

  addEntry({ phonebook: bookId, certifiedContact } = {}) {
    const book = this.books.get(requiredString(bookId, "phonebook"));
    if (!book) throw new Error(`Amway phonebook: unknown phonebook ${bookId}.`);
    if (!this.certified.has(requiredString(certifiedContact, "certifiedContact"))) {
      throw new Error(`Amway phonebook: unknown certified contact ${certifiedContact}.`);
    }
    if (!book.entries.includes(certifiedContact)) book.entries.push(certifiedContact);
    return { ...book, entries: [...book.entries] };
  }

  grantAccess({ phonebook: bookId, contact, grantedBy } = {}) {
    const book = this.books.get(requiredString(bookId, "phonebook"));
    if (!book) throw new Error(`Amway phonebook: unknown phonebook ${bookId}.`);
    contact = requiredString(contact, "contact");
    grantedBy = requiredString(grantedBy, "grantedBy");
    if (!book.grants.some(grant => grant.contact === contact && grant.revokedAt === null)) {
      book.grants.push({ contact, grantedBy, grantedAt: this.now(), revokedAt: null });
    }
    return { ...book, grants: book.grants.map(grant => ({ ...grant })) };
  }

  revokeAccess({ phonebook: bookId, contact, revokedBy } = {}) {
    const book = this.books.get(requiredString(bookId, "phonebook"));
    if (!book) throw new Error(`Amway phonebook: unknown phonebook ${bookId}.`);
    const grant = book.grants.find(entry => entry.contact === contact && entry.revokedAt === null);
    if (!grant) throw new Error(`Amway phonebook: no live grant for ${contact}.`);
    grant.revokedAt = this.now();
    grant.revokedBy = requiredString(revokedBy, "revokedBy");
    return { ...book, grants: book.grants.map(entry => ({ ...entry })) };
  }

  /**
   * Granted, currently certified contacts in the department. A customer sees
   * only explicitly granted relationships; an empty or lapsed certification
   * never appears, and grants never cross departments.
   */
  contactsFor({ viewer, department, atTime = this.now() } = {}) {
    viewer = requiredString(viewer, "viewer");
    department = requiredString(department, "department");
    const visible = [];
    for (const book of this.books.values()) {
      if (book.department !== department) continue;
      const granted = book.grants.some(grant => grant.contact === viewer && grant.revokedAt === null);
      const owned = book.owner === viewer;
      if (!granted && !owned) continue;
      for (const entry of book.entries) {
        if (!this.isCertified(entry, atTime)) continue;
        const certified = this.certified.get(entry);
        const contact = this.contacts.get(certified.publishedContact);
        visible.push({ ...contact, certifiedContact: entry, phonebook: book.id });
      }
    }
    return visible;
  }
}
