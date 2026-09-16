import assert from "node:assert/strict";
import { test } from "node:test";
import { AmwayDirectory } from "./departments.js";
import { AmwayPhoneBook, buildPhoneBookId } from "./phonebook.js";

function staffed() {
  const directory = new AmwayDirectory({ bootstrapIssuers: ["person:root"], now: () => 1_000 });
  directory.createDepartment({
    id: "nord", name: "Nord", manager: "person:manager",
    createdBy: "person:root", createdAt: 1_000,
  });
  directory.assignRole({ issuer: "person:root", subject: "person:admin", role: "admin", department: "nord", validFrom: 1_000 });
  directory.assignRole({ issuer: "person:manager", subject: "person:seller", role: "seller", department: "nord", validFrom: 1_000 });
  directory.assignRole({ issuer: "person:manager", subject: "person:customer", role: "customer", department: "nord", validFrom: 1_000 });
  return directory;
}

test("phonebook identity binds department and owner", () => {
  assert.equal(buildPhoneBookId("nord", "person:admin"), "phonebook:amway:nord:person%3Aadmin");
  assert.notEqual(buildPhoneBookId("nord", "person:admin"), buildPhoneBookId("sued", "person:admin"));
});

test("contacts are owner-published; publishing for others needs a manager", () => {
  const phonebook = new AmwayPhoneBook({ directory: staffed(), now: () => 1_500 });
  const own = phonebook.publishContact({
    publisher: "person:seller", person: "person:seller",
    name: "Selma Seller", department: "nord", role: "seller",
  });
  assert.equal(own.publishedBy, "person:seller");
  assert.throws(() => phonebook.publishContact({
    publisher: "person:seller", person: "person:customer",
    name: "Cora Customer", department: "nord", role: "customer",
  }), /may not publish/);
  const enrolled = phonebook.publishContact({
    publisher: "person:manager", person: "person:customer",
    name: "Cora Customer", department: "nord", role: "customer",
  });
  assert.equal(enrolled.publishedBy, "person:manager");
  assert.throws(() => phonebook.publishContact({
    publisher: "person:customer", person: "person:customer",
    name: "Cora", department: "sued", role: "customer",
  }), /unknown department sued/);
});

test("granted customers see only currently certified contacts", () => {
  const directory = staffed();
  const phonebook = new AmwayPhoneBook({ directory, now: () => 1_500 });
  const published = phonebook.publishContact({
    publisher: "person:manager", person: "person:seller",
    name: "Selma Seller", department: "nord", role: "seller",
  });
  const assignment = [...directory.assignments.values()].find(entry => entry.subject === "person:seller");
  const certified = phonebook.certifyContact({
    publishedContact: published.id, roleSubject: "person:seller", certRoot: assignment.id,
  });
  assert.ok(phonebook.isCertified(certified.id, 1_500));
  const book = phonebook.createPhoneBook({ department: "nord", owner: "person:manager" });
  phonebook.addEntry({ phonebook: book.id, certifiedContact: certified.id });
  phonebook.grantAccess({ phonebook: book.id, contact: "person:customer", grantedBy: "person:manager" });
  assert.equal(phonebook.contactsFor({ viewer: "person:customer", department: "nord", atTime: 1_500 }).length, 1);
  assert.equal(phonebook.contactsFor({ viewer: "person:outsider", department: "nord", atTime: 1_500 }).length, 0);
  // Revoking the role assignment lapses certification: the contact drops
  // from the granted view while history stays intact.
  directory.revokeRole({ issuer: "person:admin", assignment: assignment.id, reason: "left", atTime: 2_000 });
  assert.equal(phonebook.isCertified(certified.id, 2_000), false);
  assert.equal(phonebook.contactsFor({ viewer: "person:customer", department: "nord", atTime: 2_000 }).length, 0);
});

test("access revocation hides the phonebook without touching certification", () => {
  const directory = staffed();
  const phonebook = new AmwayPhoneBook({ directory, now: () => 1_500 });
  const published = phonebook.publishContact({
    publisher: "person:seller", person: "person:seller",
    name: "Selma Seller", department: "nord", role: "seller",
  });
  const assignment = [...directory.assignments.values()].find(entry => entry.subject === "person:seller");
  const certified = phonebook.certifyContact({
    publishedContact: published.id, roleSubject: "person:seller", certRoot: assignment.id,
  });
  const book = phonebook.createPhoneBook({ department: "nord", owner: "person:manager" });
  phonebook.addEntry({ phonebook: book.id, certifiedContact: certified.id });
  phonebook.grantAccess({ phonebook: book.id, contact: "person:customer", grantedBy: "person:manager" });
  phonebook.revokeAccess({ phonebook: book.id, contact: "person:customer", revokedBy: "person:manager" });
  assert.equal(phonebook.contactsFor({ viewer: "person:customer", department: "nord", atTime: 1_500 }).length, 0);
  assert.equal(phonebook.isCertified(certified.id, 1_500), true);
});

test("only the department manager owns the department phonebook", () => {
  const phonebook = new AmwayPhoneBook({ directory: staffed(), now: () => 1_500 });
  assert.throws(() => phonebook.createPhoneBook({ department: "nord", owner: "person:admin" }), /not the manager/);
  assert.throws(() => phonebook.createPhoneBook({ department: "nord", owner: "person:seller" }), /not the manager/);
  const book = phonebook.createPhoneBook({ department: "nord", owner: "person:manager" });
  assert.equal(book.owner, "person:manager");
});

test("phonebook ownership follows manager succession", () => {
  const directory = staffed();
  const phonebook = new AmwayPhoneBook({ directory, now: () => 1_500 });
  const book = phonebook.createPhoneBook({ department: "nord", owner: "person:manager" });
  directory.setDepartmentManager({
    issuer: "person:admin", department: "nord", manager: "person:manager-2", atTime: 2_000,
  });
  assert.throws(() => phonebook.transferPhoneBook({
    phonebook: book.id, newOwner: "person:manager-2", grantedBy: "person:seller",
  }), /may not manage/);
  const transferred = phonebook.transferPhoneBook({
    phonebook: book.id, newOwner: "person:manager-2", grantedBy: "person:admin",
  });
  assert.equal(transferred.owner, "person:manager-2");
  assert.equal(transferred.id, "phonebook:amway:nord:person%3Amanager-2");
});

test("certification requires a manager-signed cert root", () => {
  const directory = staffed();
  const phonebook = new AmwayPhoneBook({ directory, now: () => 1_500 });
  const published = phonebook.publishContact({
    publisher: "person:manager", person: "person:customer",
    name: "Cora Customer", department: "nord", role: "customer",
  });
  const assignment = [...directory.assignments.values()].find(entry => entry.subject === "person:customer");
  // A cert root whose recorded issuer never held signing authority is
  // rejected even though the assignment itself is effective.
  assignment.issuerRoles = ["seller"];
  assert.throws(() => phonebook.certifyContact({
    publishedContact: published.id, roleSubject: "person:customer", certRoot: assignment.id,
  }), /never held signing authority/);
  assignment.issuerRoles = ["manager"];
  const certified = phonebook.certifyContact({
    publishedContact: published.id, roleSubject: "person:customer", certRoot: assignment.id,
  });
  assert.ok(phonebook.isCertified(certified.id, 1_500));
});

test("certification requires the contact person as subject", () => {
  const phonebook = new AmwayPhoneBook({ directory: staffed(), now: () => 1_500 });
  const published = phonebook.publishContact({
    publisher: "person:seller", person: "person:seller",
    name: "Selma Seller", department: "nord", role: "seller",
  });
  assert.throws(() => phonebook.certifyContact({
    publishedContact: published.id, roleSubject: "person:customer", certRoot: "assignment-1",
  }), /certification subject/);
});
