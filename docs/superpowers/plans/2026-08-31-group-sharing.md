# Group Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the time-bounded evidence layer that ONE.core and one.models do not already provide for group sharing — membership validity windows, the re-share right, disclosure records, and the two evaluation times — on top of the existing `Group` / `HashGroup` / `Signature` / certificate primitives.

**Architecture:** Groups are `Group` (versioned, id `{name, owner}`) referencing `HashGroup` (unversioned, content-addressed member set). The roster history is the `Group` version DAG; `HashGroup`'s content hash is the roster pin. Signatures are separate `Signature` objects. Certificates follow the one.models pattern — an unversioned claim object plus a `License`, issued and checked through `TrustedKeysManager`. This package adds only what those types lack: time.

**Tech Stack:** Plain ESM JavaScript, no build step. Tests are standalone `node` scripts using `node:assert/strict`, registered in the `test` script in `package.json`. ONE.core and one.models are consumed from the sibling checkout at `../../../one/packages/`.

---

## Design Deltas From The Spec

The [spec](../specs/2026-08-31-group-sharing-design.md) was written before checking what
the platform already provides. It invented types that exist. **The spec has been
amended to match these deltas**; they are recorded here as the reason it changed.
Its *reasoning* — two evaluation times, prospective revocation, disclosure as
evidence — is unchanged.

1. **`ProjectGroup` and `ProjectGroupMembership` are deleted.** The group type is
   ONE.core's [`Group`](/Users/gecko/src/one/packages/one.core/lib/recipes.js:282):
   versioned, `isId: {name, owner}`, referencing a `HashGroup`. `owner` is the
   issuer tier. There is no project field, which is what the spec argued for.
2. **`HashGroup` is the roster.** `{person: Set<referenceToId Person>}`,
   unversioned, so its content hash *is* the membership pin — definitionally, not
   by convention. The spec's claim that a descriptor's content hash pins a roster
   was false; this makes it true. No snapshot type is needed and `pinnedSubjects`
   is deleted.
3. **Roster history is the `Group` version DAG**, read with `getVersionsNodes`,
   not a hand-rolled `issuedAt` field. `VersionNode` carries `depth`,
   `creationTime` and `prev`, and `VersionNodeMerge` makes concurrent versions an
   explicit case rather than an array-order accident.
4. **Signatures are `Signature` objects**, `{issuer, data: SHA256Hash,
   signature}`, created with `sign(dataHash)`. A `signature` field on a recipe is
   rejected by the serializer (`O2M-COBJ2: Unknown properties`), which is correct
   behaviour rather than an obstacle.
5. **Authorization is `TrustedKeysManager.isCertifiedBy` / `getCertificates`**,
   not a signature check against a caller-supplied key. Verifying a signature
   against a key the caller handed you establishes nothing about issuer authority.
6. **A membership certificate proves membership of a pinned `HashGroup`, not
   open-ended membership of a group.** This is the significant change. It makes
   the certificate a portable *proof* rather than the authoritative membership
   record, and it dissolves the certificate-revocation problem: one.models
   certificates are unversioned and cannot be superseded, but a certificate
   pinned to roster H proves only "was in H", never "is in the group now". The
   authoritative present-tense record is the `Group` version DAG. This is the
   spec's evidence/access split expressed in the type system rather than in a
   convention.

7. **Effective validity is the narrowest window across a membership lineage.**
   Found while amending the spec: because one.models certificates are
   unversioned, a revoking certificate sits *alongside* the original rather than
   replacing it, so a consumer that accepts any valid certificate would make
   revocation a no-op. Consumers must combine, never pick. Nothing widens, and a
   renewal is a new lineage with a later `validFrom`.

**What is genuinely new, and is therefore all this package builds:** no existing
certificate carries a validity window. `AffirmationCertificate` is `{data,
license}`; `RelationCertificate` is `{app, relation, person1, person2, license}`.
Time is the gap.

---

## Global Constraints

- Reuse before adding. Every new recipe must be justified by something the
  existing types cannot express. That justification is time bounds and the
  re-share right.
- New type names carry no `Project` prefix unless genuinely project-scoped.
  `ProjectAccessAssertion` earns it; nothing else here does.
- Certificates follow the one.models shape: unversioned, `{...claim, license:
  SHA256Hash<License>}`, issued via `TrustedKeysManager.certify`. Never a
  `signature` field.
- Reference-typed fields use `referenceToId` / `referenceToObj` with
  `allowedTypes`, never a bare string standing in for a hash.
- `validUntil` is the only input to validity. `learnedAt` and `compromisedSince`
  never affect it. Revocation ends authority at issuance, never earlier.
- There is no `getMembers(group)`. Only `rosterAsOf` and `mayAct`.
- Fail fast and throw. No fallback values, no silent defaults for required input.
- Commit messages: imperative, sentence case, no prefix, no AI attribution.

---

### Task 1: Walking Skeleton — One End-To-End Slice

This task exists to settle contracts, not to produce reusable modules. It proves
the whole loop against a live instance: create a group, sign it, admit a member,
remove them, then show historical verification still succeeds while present
access fails.

**Everything after this task depends on what this test discovers.** The API
shapes below are read from the `.d.ts` files but have not been executed. Where
the runtime disagrees, the runtime wins — fix the test, then carry the correction
into later tasks before starting them.

Specifically unverified, to be confirmed on first run:
- whether storing a `Group` requires its `HashGroup` stored first
- the exact field names on `storeVersionedObject` / `storeUnversionedObject` results
- whether `sign()` works with only an initialised instance, or needs `LeuteModel`
- what `getVersionsNodes` returns, and in what order

**Files:**
- Create: `packages/group.core/skeleton.test.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `Group`, `HashGroup` from one.core; `sign`, `getSignatures` from one.models.
- Produces: confirmed API contracts, recorded as comments in the test and consumed by every later task.

- [ ] **Step 1: Write the end-to-end test**

Create `packages/group.core/skeleton.test.js`:

```js
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import "../../../one/packages/one.core/lib/system/load-nodejs.js";
import {
  closeInstance,
  initInstance,
  getInstanceOwnerIdHash,
} from "../../../one/packages/one.core/lib/instance.js";
import { storeUnversionedObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {
  storeVersionedObject,
  getVersionsNodes,
  getVersion,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { sign, getSignatures } from "../../../one/packages/one.models/lib/misc/Signature.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-group-"));
let initialized = false;

try {
  await initInstance({
    name: "projektor-group-skeleton",
    email: "projektor-group-skeleton@example.invalid",
    secret: "projektor-group-skeleton-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
  });
  initialized = true;

  const owner = getInstanceOwnerIdHash();
  assert.ok(owner, "instance owner id hash is available");

  // The owner stands in for a member so the test needs no contact wiring.
  const anna = owner;

  // --- Admit a member: HashGroup first, then the Group version pointing at it.
  const rosterV1 = await storeUnversionedObject({
    $type$: "HashGroup",
    person: new Set([anna]),
  });
  const groupV1 = await storeVersionedObject({
    $type$: "Group",
    name: "tragwerksplanung",
    owner,
    hashGroup: rosterV1.hash,
  });

  assert.ok(groupV1.idHash, "Group has an id hash");
  assert.ok(groupV1.hash, "Group version has a content hash");
  assert.notEqual(groupV1.idHash, groupV1.hash);

  // The roster pin is the HashGroup hash, and it is a function of membership.
  const emptyRoster = await storeUnversionedObject({
    $type$: "HashGroup",
    person: new Set(),
  });
  assert.notEqual(
    rosterV1.hash,
    emptyRoster.hash,
    "HashGroup hash changes with membership",
  );

  // --- Sign the group version. The signature is its own object.
  const signature = await sign(groupV1.hash);
  assert.ok(signature.hash, "Signature is stored as its own object");
  const signatures = await getSignatures(groupV1.hash);
  assert.equal(signatures.length, 1);
  assert.equal(signatures[0].issuer, owner);

  // --- Remove the member: a new Group version pointing at a new HashGroup.
  const groupV2 = await storeVersionedObject({
    $type$: "Group",
    name: "tragwerksplanung",
    owner,
    hashGroup: emptyRoster.hash,
  });
  assert.equal(groupV2.idHash, groupV1.idHash, "same identity across versions");
  assert.notEqual(groupV2.hash, groupV1.hash, "different version");

  // --- The version DAG is the roster history, ordered by the platform.
  const nodes = await getVersionsNodes(groupV1.idHash);
  assert.ok(nodes.length >= 2, "both versions are in the version DAG");
  for (const node of nodes) {
    assert.ok(Number.isFinite(node.creationTime), "each node carries creationTime");
    assert.ok(Number.isFinite(node.depth), "each node carries depth");
  }

  // --- Present access fails: the current roster no longer contains Anna.
  const currentNode = nodes[nodes.length - 1];
  const currentGroup = await getVersion(currentNode.data);
  assert.equal(
    currentGroup.hashGroup,
    emptyRoster.hash,
    "current version points at the empty roster",
  );

  // --- Historical verification still succeeds: version 1 is intact, still
  // signed, and still names the roster that contained Anna.
  const historicGroup = await getVersion(groupV1.hash);
  assert.equal(historicGroup.hashGroup, rosterV1.hash);
  const historicSignatures = await getSignatures(groupV1.hash);
  assert.equal(historicSignatures.length, 1, "the earlier version is still signed");

  console.log("group.core skeleton test passed");
} finally {
  if (initialized) {
    closeInstance();
  }
  await rm(directory, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run it and record what the runtime actually does**

Run: `node ./packages/group.core/skeleton.test.js`

This is expected to fail on the first run — that is the point. Fix the test to
match the runtime, one failure at a time. Record each correction as a comment at
the top of the file under a `// Confirmed contracts:` heading, covering at least
the four unknowns listed above.

Do not proceed to Step 3 until the test passes and those four are written down.

- [ ] **Step 3: Register the test in package.json**

In `package.json`, append to the end of the `test` script value:

```
 && node ./packages/group.core/skeleton.test.js
```

Run: `npm test`
Expected: all existing tests pass, ending with `group.core skeleton test passed`.

- [ ] **Step 4: Commit**

```bash
git add packages/group.core package.json
git commit -m "Prove the group sharing slice against a live instance"
```

- [ ] **Step 5: Reconcile the rest of the plan**

Re-read Tasks 2–7 against the confirmed contracts. Where a task's code uses an
API shape the skeleton disproved, correct the task before starting it, and note
the correction in that task's commit message.

---

### Task 2: rosterAsOf And mayAct Over The Version DAG

**Files:**
- Create: `packages/group.core/roster.js`
- Create: `packages/group.core/index.js`
- Create: `packages/group.core/roster.test.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `getVersionsNodes`, `getVersion`, `getObject` from one.core; contracts confirmed in Task 1.
- Produces:
  - `StaleChainError` — class extending `Error`, `name === "StaleChainError"`
  - `ConcurrentVersionsError` — class extending `Error`, thrown when the version in force at a time is ambiguous
  - `rosterAsOf(groupIdHash, atTime) -> Promise<string[]>` — sorted Person id hashes
  - `mayAct({groupIdHash, subject, now, replicaAsOf, maxStalenessMs}) -> Promise<boolean>`

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/roster.test.js`:

```js
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import "../../../one/packages/one.core/lib/system/load-nodejs.js";
import {
  closeInstance,
  initInstance,
  getInstanceOwnerIdHash,
} from "../../../one/packages/one.core/lib/instance.js";
import { storeUnversionedObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { storeVersionedObject } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { StaleChainError, rosterAsOf, mayAct } from "./index.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-roster-"));
let initialized = false;
const DAY = 24 * 60 * 60 * 1000;

try {
  await initInstance({
    name: "projektor-roster-test",
    email: "projektor-roster-test@example.invalid",
    secret: "projektor-roster-test-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
  });
  initialized = true;

  const owner = getInstanceOwnerIdHash();

  const withMember = await storeUnversionedObject({
    $type$: "HashGroup",
    person: new Set([owner]),
  });
  const v1 = await storeVersionedObject({
    $type$: "Group",
    name: "tragwerksplanung",
    owner,
    hashGroup: withMember.hash,
  });
  const afterV1 = Date.now();

  const withoutMember = await storeUnversionedObject({
    $type$: "HashGroup",
    person: new Set(),
  });
  await storeVersionedObject({
    $type$: "Group",
    name: "tragwerksplanung",
    owner,
    hashGroup: withoutMember.hash,
  });
  const afterV2 = Date.now();

  // Evidence: at afterV1 the member was in the group, and removing them later
  // does not reach back.
  assert.deepEqual(await rosterAsOf(v1.idHash, afterV1), [owner]);

  // Evidence: at afterV2 they are not.
  assert.deepEqual(await rosterAsOf(v1.idHash, afterV2), []);

  // Before the group existed, the roster is empty rather than an error.
  assert.deepEqual(await rosterAsOf(v1.idHash, 0), []);

  // Access: evaluated now, under a freshness policy.
  assert.equal(
    await mayAct({
      groupIdHash: v1.idHash,
      subject: owner,
      now: afterV2,
      replicaAsOf: afterV2 - DAY,
      maxStalenessMs: 7 * DAY,
    }),
    false,
  );

  // A replica staler than the policy fails closed, distinguishably from a deny.
  await assert.rejects(
    () =>
      mayAct({
        groupIdHash: v1.idHash,
        subject: owner,
        now: afterV2,
        replicaAsOf: afterV2 - 30 * DAY,
        maxStalenessMs: 7 * DAY,
      }),
    StaleChainError,
  );

  await assert.rejects(
    () => mayAct({ groupIdHash: v1.idHash, subject: owner, now: afterV2 }),
    /replicaAsOf is required/,
  );
  await assert.rejects(() => rosterAsOf(v1.idHash), /atTime is required/);

  console.log("group.core roster tests passed");
} finally {
  if (initialized) {
    closeInstance();
  }
  await rm(directory, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/roster.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./index.js`.

- [ ] **Step 3: Write the roster module**

Create `packages/group.core/roster.js`:

```js
import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import {
  getVersion,
  getVersionsNodes,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";

export class StaleChainError extends Error {
  constructor(message) {
    super(message);
    this.name = "StaleChainError";
  }
}

export class ConcurrentVersionsError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConcurrentVersionsError";
  }
}

/**
 * Select the single Group version in force at `atTime`.
 *
 * The version DAG, not a timestamp field on the object, is the ordering
 * authority. Concurrent unmerged branches are an explicit error rather than an
 * arbitrary pick: two versions at the same depth with no merge between them
 * means the roster genuinely is ambiguous at that time.
 */
function versionInForce(nodes, atTime) {
  const candidates = nodes.filter((node) => node.creationTime <= atTime);
  if (candidates.length === 0) {
    return undefined;
  }
  const maxDepth = Math.max(...candidates.map((node) => node.depth));
  const deepest = candidates.filter((node) => node.depth === maxDepth);
  if (deepest.length > 1) {
    throw new ConcurrentVersionsError(
      `Group has ${deepest.length} concurrent versions at depth ${maxDepth} as of ${atTime}; merge before evaluating`,
    );
  }
  return deepest[0];
}

/**
 * The evidence question: who was in the group at `atTime`?
 */
export async function rosterAsOf(groupIdHash, atTime) {
  if (!groupIdHash) {
    throw new Error("rosterAsOf: groupIdHash is required");
  }
  if (!Number.isFinite(atTime)) {
    throw new Error("rosterAsOf: atTime is required");
  }
  const nodes = await getVersionsNodes(groupIdHash);
  const node = versionInForce(nodes, atTime);
  if (node === undefined) {
    return [];
  }
  const group = await getVersion(node.data);
  const hashGroup = await getObject(group.hashGroup);
  return [...hashGroup.person].sort();
}

/**
 * The access question: may this participant act now?
 *
 * A replica older than the freshness policy allows throws rather than returning
 * false, so a stale chain can never be misread as an ordinary deny.
 */
export async function mayAct({
  groupIdHash,
  subject,
  now,
  replicaAsOf,
  maxStalenessMs,
} = {}) {
  if (!subject) {
    throw new Error("mayAct: subject is required");
  }
  if (!Number.isFinite(now)) {
    throw new Error("mayAct: now is required");
  }
  if (!Number.isFinite(replicaAsOf)) {
    throw new Error("mayAct: replicaAsOf is required");
  }
  if (!Number.isFinite(maxStalenessMs)) {
    throw new Error("mayAct: maxStalenessMs is required");
  }
  if (now - replicaAsOf > maxStalenessMs) {
    throw new StaleChainError(
      `mayAct: chain replica is ${now - replicaAsOf}ms old, policy allows ${maxStalenessMs}ms`,
    );
  }
  const roster = await rosterAsOf(groupIdHash, now);
  return roster.includes(subject);
}
```

Create `packages/group.core/index.js`:

```js
export * from "./roster.js";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node ./packages/group.core/roster.test.js`
Expected: PASS, prints `group.core roster tests passed`.

- [ ] **Step 5: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/roster.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/group.core package.json
git commit -m "Read group rosters from the version DAG at two evaluation times"
```

---

### Task 3: The Membership Certificate And Its Validity Window

The only genuinely new evidence type. It states: *the issuer certifies that this
person was in this exact roster, for this window, with or without the right to
re-share the definition.* It pins `HashGroup`, so it can never be read as an
open-ended present-tense grant.

**Files:**
- Create: `packages/group.core/certificates.js`
- Create: `packages/group.core/certificates.test.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `HashGroup` hashes from Task 1.
- Produces:
  - `GROUP_MEMBERSHIP_CERTIFICATE_TYPE`, `GroupMembershipLicense`, `GroupMembershipCertificateRecipe`, `GroupCoreRecipes`
  - `createGroupMembershipCertificate({group, hashGroup, person, mayReshare, validFrom, validUntil, licenseHash}) -> object`
  - `isMembershipValidAt(certificate, atTime) -> boolean`
  - `effectiveMembershipWindow(certificates) -> {validFrom, validUntil}` — the narrowest window across one lineage
  - `revokeMembershipCertificate(previous, {revokedAt, learnedAt, reason, endAt}) -> object`

**Why a combining rule is required.** one.models certificates are unversioned, so
revocation is a second certificate carrying an earlier `validUntil` — and the
original still exists and still verifies. A consumer that accepts *any* valid
certificate would keep accepting the original, and revocation would do nothing.
Effective validity is therefore the **narrowest** window across all certificates
from the same issuer, for the same person and group, sharing the same
`validFrom`. Narrowing takes effect; nothing widens. A renewal is a new lineage
with a later `validFrom`, evaluated on its own.

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/certificates.test.js`:

```js
import assert from "node:assert/strict";
import {
  GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  GroupCoreRecipes,
  createGroupMembershipCertificate,
  effectiveMembershipWindow,
  isMembershipValidAt,
  revokeMembershipCertificate,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);
const DEC = Date.UTC(2026, 11, 1);

const GROUP = "0".repeat(64);
const ROSTER = "1".repeat(64);
const PERSON = "2".repeat(64);
const LICENSE = "3".repeat(64);

const cert = createGroupMembershipCertificate({
  group: GROUP,
  hashGroup: ROSTER,
  person: PERSON,
  mayReshare: true,
  validFrom: JAN,
  validUntil: DEC,
  licenseHash: LICENSE,
});

assert.equal(cert.$type$, GROUP_MEMBERSHIP_CERTIFICATE_TYPE);
// The certificate pins the exact roster, so it can never mean "is in the group now".
assert.equal(cert.hashGroup, ROSTER);
assert.equal(cert.license, LICENSE);
// Signatures are separate objects, never a field.
assert.equal("signature" in cert, false);

assert.equal(isMembershipValidAt(cert, FEB), true);
assert.equal(isMembershipValidAt(cert, Date.UTC(2027, 5, 1)), false);

// Revocation ends authority at issuance, never before.
const revoked = revokeMembershipCertificate(cert, {
  revokedAt: MAR,
  learnedAt: FEB,
  reason: "Left the partner office",
});
assert.equal(revoked.validUntil, MAR, "validUntil ends at revocation time");
assert.equal(revoked.learnedAt, FEB, "learning time is recorded");
assert.equal(revoked.validFrom, JAN, "validFrom is never rewritten");
assert.equal(revoked.hashGroup, ROSTER, "the pinned roster does not change");

// The February assertion this certificate authorised is still covered.
assert.equal(isMembershipValidAt(revoked, FEB), true);
assert.equal(isMembershipValidAt(revoked, Date.UTC(2026, 3, 1)), false);

// Ending the window before the revocation was issued is refused outright.
assert.throws(
  () =>
    revokeMembershipCertificate(cert, {
      revokedAt: MAR,
      endAt: FEB,
      reason: "backdated",
    }),
  /earliest permitted end/,
);

assert.throws(
  () =>
    createGroupMembershipCertificate({
      group: GROUP,
      hashGroup: ROSTER,
      person: PERSON,
      validFrom: DEC,
      validUntil: JAN,
      licenseHash: LICENSE,
    }),
  /validUntil must be after validFrom/,
);

// Revocation only bites if consumers combine rather than pick: the original
// certificate still exists alongside the revoking one.
assert.equal(
  effectiveMembershipWindow([cert, revoked]).validUntil,
  MAR,
  "the narrowest window wins regardless of order",
);
assert.equal(effectiveMembershipWindow([revoked, cert]).validUntil, MAR);

// Nothing widens a window another certificate already narrowed.
const widened = { ...cert, validUntil: Date.UTC(2030, 0, 1) };
assert.equal(
  effectiveMembershipWindow([cert, revoked, widened]).validUntil,
  MAR,
  "a wider certificate cannot undo a narrowing",
);

// A renewal is a separate lineage, not an extension.
const renewal = createGroupMembershipCertificate({
  group: GROUP,
  hashGroup: ROSTER,
  person: PERSON,
  validFrom: Date.UTC(2027, 0, 1),
  validUntil: Date.UTC(2027, 11, 1),
  licenseHash: LICENSE,
});
assert.throws(
  () => effectiveMembershipWindow([cert, renewal]),
  /one lineage/,
);

const recipe = GroupCoreRecipes.find(
  (entry) => entry.name === GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
);
assert.ok(recipe, "certificate recipe is registered");
assert.equal(
  recipe.rule.find((rule) => rule.itemprop === "hashGroup").itemtype.type,
  "referenceToObj",
);
assert.equal(
  recipe.rule.find((rule) => rule.itemprop === "person").itemtype.type,
  "referenceToId",
);
assert.equal(recipe.rule.some((rule) => rule.itemprop === "signature"), false);

console.log("group.core certificate tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/certificates.test.js`
Expected: FAIL with `does not provide an export named 'createGroupMembershipCertificate'`.

- [ ] **Step 3: Write the certificates module**

Create `packages/group.core/certificates.js`:

```js
export const GROUP_MEMBERSHIP_CERTIFICATE_TYPE = "GroupMembershipCertificate";

/**
 * License text follows the one.models convention: values stored in the
 * certificate are referenced in brackets.
 */
export const GroupMembershipLicense = {
  $type$: "License",
  name: "GroupMembership",
  description:
    "The [signature.issuer] certifies that [person] was a member of the roster [hashGroup] of group [group] from [validFrom] until [validUntil]. This certificate states past membership of an exact roster. It is not a statement that [person] is currently a member.",
};

export const GroupMembershipCertificateRecipe = {
  $type$: "Recipe",
  name: GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  rule: [
    {
      itemprop: "group",
      itemtype: { type: "referenceToId", allowedTypes: new Set(["Group"]) },
    },
    {
      itemprop: "hashGroup",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["HashGroup"]) },
    },
    {
      itemprop: "person",
      itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) },
    },
    { itemprop: "mayReshare", itemtype: { type: "boolean" } },
    { itemprop: "validFrom", itemtype: { type: "number" } },
    { itemprop: "validUntil", itemtype: { type: "number" } },
    { itemprop: "learnedAt", itemtype: { type: "number" }, optional: true },
    { itemprop: "revocationReason", itemtype: { type: "string" }, optional: true },
    {
      itemprop: "license",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["License"]) },
    },
  ],
};

export const GroupCoreRecipes = [GroupMembershipCertificateRecipe];

function required(value, field) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`GroupMembershipCertificate: ${field} is required`);
  }
  return value;
}

function requiredTime(value, field) {
  if (!Number.isFinite(value)) {
    throw new Error(
      `GroupMembershipCertificate: ${field} must be a timestamp in milliseconds`,
    );
  }
  return value;
}

export function createGroupMembershipCertificate({
  group,
  hashGroup,
  person,
  mayReshare = false,
  validFrom,
  validUntil,
  licenseHash,
} = {}) {
  const from = requiredTime(validFrom, "validFrom");
  const until = requiredTime(validUntil, "validUntil");
  if (until <= from) {
    throw new Error("GroupMembershipCertificate: validUntil must be after validFrom");
  }
  if (typeof mayReshare !== "boolean") {
    throw new Error("GroupMembershipCertificate: mayReshare must be a boolean");
  }
  return {
    $type$: GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
    group: required(group, "group"),
    hashGroup: required(hashGroup, "hashGroup"),
    person: required(person, "person"),
    mayReshare,
    validFrom: from,
    validUntil: until,
    license: required(licenseHash, "licenseHash"),
  };
}

export function isMembershipValidAt(certificate, atTime) {
  requiredTime(atTime, "atTime");
  return certificate.validFrom <= atTime && atTime <= certificate.validUntil;
}

/**
 * Combine every certificate in one membership lineage into its effective window.
 *
 * Certificates are unversioned, so a revocation does not replace the original —
 * both exist. Accepting whichever happens to be valid would make revocation a
 * no-op, so effective validity is the narrowest window across the lineage.
 * Narrowing takes effect and nothing widens, which also means a replayed or
 * forged "extension" achieves nothing.
 *
 * A lineage is one issuer, person, group and `validFrom`. A renewal carries a
 * later `validFrom` and is a different lineage.
 */
export function effectiveMembershipWindow(certificates) {
  if (!Array.isArray(certificates) || certificates.length === 0) {
    throw new Error("effectiveMembershipWindow: at least one certificate is required");
  }
  const [first] = certificates;
  for (const certificate of certificates) {
    if (certificate.$type$ !== GROUP_MEMBERSHIP_CERTIFICATE_TYPE) {
      throw new Error(
        "effectiveMembershipWindow: every entry must be a GroupMembershipCertificate",
      );
    }
    if (
      certificate.group !== first.group ||
      certificate.person !== first.person ||
      certificate.validFrom !== first.validFrom
    ) {
      throw new Error(
        "effectiveMembershipWindow: all certificates must belong to one lineage (same group, person and validFrom)",
      );
    }
  }
  return {
    validFrom: first.validFrom,
    validUntil: Math.min(...certificates.map((certificate) => certificate.validUntil)),
  };
}

/**
 * Issue a superseding certificate that ends authority now.
 *
 * `revokedAt` is the earliest permitted end. Ending earlier — including at the
 * time the issuer learned of the trust change — would invalidate assertions made
 * in good faith in the gap, and would not discriminate between honest and
 * hostile signatures in that window. `learnedAt` records the gap for
 * accountability and has no effect on validity.
 */
export function revokeMembershipCertificate(
  previous,
  { revokedAt, learnedAt, reason, endAt } = {},
) {
  if (!previous || previous.$type$ !== GROUP_MEMBERSHIP_CERTIFICATE_TYPE) {
    throw new Error("GroupMembershipCertificate: previous certificate is required");
  }
  const at = requiredTime(revokedAt, "revokedAt");
  const end = endAt === undefined ? at : requiredTime(endAt, "endAt");
  if (end < at) {
    throw new Error(
      "GroupMembershipCertificate: revokedAt is the earliest permitted end; a validity window may not end before the revocation was issued",
    );
  }
  const revocation = {
    ...previous,
    validUntil: end,
    revocationReason: required(reason, "revocationReason"),
  };
  if (learnedAt !== undefined) {
    revocation.learnedAt = requiredTime(learnedAt, "learnedAt");
  }
  return revocation;
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/group.core/index.js`, add:

```js
export * from "./certificates.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/group.core/certificates.test.js`
Expected: PASS, prints `group.core certificate tests passed`.

- [ ] **Step 6: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/certificates.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/group.core package.json
git commit -m "Add time-bounded group membership certificates"
```

---

### Task 4: Issuance And The Authorization Boundary

The constructors in Task 3 are pure and prove nothing. This task supplies the
authority: issuing goes through `TrustedKeysManager.certify`, and disclosing
requires stored-certificate evidence that the sharer holds a valid, issuer-signed
membership certificate **for the group being disclosed**.

**Files:**
- Create: `packages/group.core/issuance.js`
- Create: `packages/group.core/issuance.test.js`
- Modify: `packages/group.core/certificates.js` (extend `GroupCoreRecipes`)
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `TrustedKeysManager` from one.models, Task 3 factories.
- Produces:
  - `GROUP_DISCLOSURE_CERTIFICATE_TYPE`, `GroupDisclosureLicense`, `GroupDisclosureCertificateRecipe`
  - `issueMembership(trust, {group, hashGroup, person, mayReshare, validFrom, validUntil}) -> Promise<{certificate, signature, license}>`
  - `authorizeDisclosure(trust, {groupIdHash, sharer, issuer, atTime}) -> Promise<{certificateHash}>`
  - `discloseGroup(trust, {groupIdHash, hashGroup, recipient, sharer, issuer, atTime}) -> Promise<object>`

**Dependency note:** `TrustedKeysManager` takes a `LeuteModel`. Use it — this is
a decided dependency, sanctioned by the root README's "where Leute/contact model
is the owning API". The stub below exists only to drive the boundary logic in
isolation; Step 6 replaces it with the real manager and the assertions must hold
unchanged. Do not substitute a hand-rolled key check for either.

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/issuance.test.js`:

```js
import assert from "node:assert/strict";
import { authorizeDisclosure } from "./index.js";

// A stub standing in for TrustedKeysManager, exercising the boundary without
// LeuteModel. Step 6 replaces it with the real manager; these assertions must
// hold unchanged against both.
function stubTrust(entries) {
  return {
    async getCertificates(dataHash) {
      return entries.filter((entry) => entry.certificate.group === dataHash);
    },
  };
}

const FEB = Date.UTC(2026, 1, 1);
const ISSUER = "9".repeat(64);
const OTHER_ISSUER = "8".repeat(64);
const GROUP_A = "a".repeat(64);
const GROUP_B = "b".repeat(64);
const ROSTER = "1".repeat(64);
const SHARER = "2".repeat(64);

const certForGroupA = {
  issuer: ISSUER,
  certificateHash: "c".repeat(64),
  certificate: {
    $type$: "GroupMembershipCertificate",
    group: GROUP_A,
    hashGroup: ROSTER,
    person: SHARER,
    mayReshare: true,
    validFrom: Date.UTC(2026, 0, 1),
    validUntil: Date.UTC(2026, 11, 1),
    license: "3".repeat(64),
  },
};

const trust = stubTrust([certForGroupA]);

// The happy path names the exact certificate relied on.
const authorized = await authorizeDisclosure(trust, {
  groupIdHash: GROUP_A,
  sharer: SHARER,
  issuer: ISSUER,
  atTime: FEB,
});
assert.equal(authorized.certificateHash, "c".repeat(64));

// A certificate for group A must not authorize disclosure of group B.
await assert.rejects(
  () =>
    authorizeDisclosure(trust, {
      groupIdHash: GROUP_B,
      sharer: SHARER,
      issuer: ISSUER,
      atTime: FEB,
    }),
  /no membership certificate/,
);

// An expired certificate does not authorize.
await assert.rejects(
  () =>
    authorizeDisclosure(trust, {
      groupIdHash: GROUP_A,
      sharer: SHARER,
      issuer: ISSUER,
      atTime: Date.UTC(2027, 5, 1),
    }),
  /not valid at/,
);

// A certificate from a different issuer does not authorize.
await assert.rejects(
  () =>
    authorizeDisclosure(trust, {
      groupIdHash: GROUP_A,
      sharer: SHARER,
      issuer: OTHER_ISSUER,
      atTime: FEB,
    }),
  /no membership certificate/,
);

// A certificate belonging to someone else does not authorize.
await assert.rejects(
  () =>
    authorizeDisclosure(trust, {
      groupIdHash: GROUP_A,
      sharer: "7".repeat(64),
      issuer: ISSUER,
      atTime: FEB,
    }),
  /no membership certificate/,
);

// Revocation bites even though the original certificate still exists.
const revokedAlongsideOriginal = stubTrust([
  certForGroupA,
  {
    ...certForGroupA,
    certificateHash: "d".repeat(64),
    certificate: {
      ...certForGroupA.certificate,
      validUntil: Date.UTC(2026, 0, 15),
      revocationReason: "Left the partner office",
    },
  },
]);
await assert.rejects(
  () =>
    authorizeDisclosure(revokedAlongsideOriginal, {
      groupIdHash: GROUP_A,
      sharer: SHARER,
      issuer: ISSUER,
      atTime: FEB,
    }),
  /not valid at/,
  "the superseded certificate must not keep authorizing",
);

// Without mayReshare, disclosure fails closed.
const noReshare = stubTrust([
  {
    ...certForGroupA,
    certificate: { ...certForGroupA.certificate, mayReshare: false },
  },
]);
await assert.rejects(
  () =>
    authorizeDisclosure(noReshare, {
      groupIdHash: GROUP_A,
      sharer: SHARER,
      issuer: ISSUER,
      atTime: FEB,
    }),
  /does not carry mayReshare/,
);

console.log("group.core issuance tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/issuance.test.js`
Expected: FAIL with `does not provide an export named 'authorizeDisclosure'`.

- [ ] **Step 3: Write the issuance module**

Create `packages/group.core/issuance.js`:

```js
import {
  GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  effectiveMembershipWindow,
} from "./certificates.js";

export const GROUP_DISCLOSURE_CERTIFICATE_TYPE = "GroupDisclosureCertificate";

export const GroupDisclosureLicense = {
  $type$: "License",
  name: "GroupDisclosure",
  description:
    "The [signature.issuer] records that the roster [hashGroup] of group [group] was disclosed to [recipient] at [disclosedAt], under the membership certificate [underCertificate].",
};

export const GroupDisclosureCertificateRecipe = {
  $type$: "Recipe",
  name: GROUP_DISCLOSURE_CERTIFICATE_TYPE,
  rule: [
    {
      itemprop: "group",
      itemtype: { type: "referenceToId", allowedTypes: new Set(["Group"]) },
    },
    {
      itemprop: "hashGroup",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["HashGroup"]) },
    },
    {
      itemprop: "recipient",
      itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) },
    },
    { itemprop: "disclosedAt", itemtype: { type: "number" } },
    {
      itemprop: "underCertificate",
      itemtype: {
        type: "referenceToObj",
        allowedTypes: new Set([GROUP_MEMBERSHIP_CERTIFICATE_TYPE]),
      },
    },
    {
      itemprop: "license",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["License"]) },
    },
  ],
};

export async function issueMembership(
  trust,
  { group, hashGroup, person, mayReshare = false, validFrom, validUntil } = {},
) {
  if (!trust || typeof trust.certify !== "function") {
    throw new Error("issueMembership: a TrustedKeysManager is required");
  }
  return trust.certify(GROUP_MEMBERSHIP_CERTIFICATE_TYPE, {
    group,
    hashGroup,
    person,
    mayReshare,
    validFrom,
    validUntil,
  });
}

/**
 * Establish that `sharer` may disclose `groupIdHash`, and return the exact
 * certificate relied on.
 *
 * Authority is read from stored certificates through the trust manager.
 * Verifying a signature against a key the caller supplied would establish
 * nothing about issuer authority. Every failure path is closed.
 */
export async function authorizeDisclosure(
  trust,
  { groupIdHash, sharer, issuer, atTime } = {},
) {
  if (!trust || typeof trust.getCertificates !== "function") {
    throw new Error("authorizeDisclosure: a TrustedKeysManager is required");
  }
  if (!groupIdHash || !sharer || !issuer) {
    throw new Error("authorizeDisclosure: groupIdHash, sharer and issuer are required");
  }
  if (!Number.isFinite(atTime)) {
    throw new Error("authorizeDisclosure: atTime is required");
  }

  const entries = await trust.getCertificates(groupIdHash);
  const forThisGroup = entries.filter(
    (entry) =>
      entry.certificate.$type$ === GROUP_MEMBERSHIP_CERTIFICATE_TYPE &&
      entry.certificate.group === groupIdHash &&
      entry.certificate.person === sharer &&
      entry.issuer === issuer,
  );
  if (forThisGroup.length === 0) {
    throw new Error(
      `authorizeDisclosure: no membership certificate for ${sharer} in group ${groupIdHash} issued by ${issuer}`,
    );
  }

  // Combine, never pick. A revocation is a second certificate alongside the
  // original, so accepting whichever entry happens to be valid would let the
  // superseded certificate keep authorizing after revocation.
  const lineages = new Map();
  for (const entry of forThisGroup) {
    const key = String(entry.certificate.validFrom);
    const lineage = lineages.get(key) ?? [];
    lineage.push(entry);
    lineages.set(key, lineage);
  }

  const live = [];
  for (const lineage of lineages.values()) {
    const window = effectiveMembershipWindow(
      lineage.map((entry) => entry.certificate),
    );
    if (window.validFrom <= atTime && atTime <= window.validUntil) {
      live.push(lineage);
    }
  }
  if (live.length === 0) {
    throw new Error(`authorizeDisclosure: certificate is not valid at ${atTime}`);
  }

  // The re-share right is read from the lineage the same way: a certificate
  // that withdraws it must not be outvoted by the one that granted it.
  const authorizing = live.find((lineage) =>
    lineage.every((entry) => entry.certificate.mayReshare === true),
  );
  if (authorizing === undefined) {
    throw new Error("authorizeDisclosure: certificate does not carry mayReshare");
  }

  return { certificateHash: authorizing[0].certificateHash };
}

export async function discloseGroup(
  trust,
  { groupIdHash, hashGroup, recipient, sharer, issuer, atTime } = {},
) {
  const { certificateHash } = await authorizeDisclosure(trust, {
    groupIdHash,
    sharer,
    issuer,
    atTime,
  });
  return trust.certify(GROUP_DISCLOSURE_CERTIFICATE_TYPE, {
    group: groupIdHash,
    hashGroup,
    recipient,
    disclosedAt: atTime,
    underCertificate: certificateHash,
  });
}
```

- [ ] **Step 4: Register the disclosure recipe**

In `packages/group.core/index.js`, replace the `GroupCoreRecipes` re-export with
a composed list so the two modules do not import each other:

```js
export * from "./roster.js";
export * from "./certificates.js";
export * from "./issuance.js";

import { GroupMembershipCertificateRecipe } from "./certificates.js";
import { GroupDisclosureCertificateRecipe } from "./issuance.js";

export const GroupCoreRecipes = [
  GroupMembershipCertificateRecipe,
  GroupDisclosureCertificateRecipe,
];
```

Remove the `GroupCoreRecipes` export from `certificates.js` so there is one
definition.

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/group.core/issuance.test.js`
Expected: PASS, prints `group.core issuance tests passed`.

Then run: `node ./packages/group.core/certificates.test.js`
Expected: PASS — the recipe assertions still hold against the composed list.

- [ ] **Step 6: Replace the stub with the real manager**

Stand up a `LeuteModel`, construct a real `TrustedKeysManager` against it, issue
a membership through `issueMembership`, and re-run the same assertions against
it. They must hold unchanged. If an assertion only passes against the stub, the
stub is wrong — fix the stub, never the assertion.

- [ ] **Step 7: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/issuance.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/group.core package.json
git commit -m "Check disclosure authority against stored certificates"
```

---

### Task 5: Project Access Assertions, Living And Pinned

This type keeps its `Project` prefix because it is the one thing here that is
genuinely project-scoped.

**Files:**
- Create: `packages/group.core/grants.js`
- Create: `packages/group.core/grants.test.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `rosterAsOf` from Task 2, `getObject` from one.core.
- Produces:
  - `PROJECT_ACCESS_ASSERTION_TYPE`, `ProjectAccessLicense`, `ProjectAccessAssertionRecipe`
  - `createProjectAccessAssertion({group, hashGroup, binding, record, projectId, grantedAt, licenseHash}) -> object`
  - `resolveGrantAudience(assertion, atTime) -> Promise<string[]>`

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/grants.test.js`:

```js
import assert from "node:assert/strict";
import {
  PROJECT_ACCESS_ASSERTION_TYPE,
  createProjectAccessAssertion,
} from "./index.js";

const FEB = Date.UTC(2026, 1, 1);
const GROUP = "a".repeat(64);
const ROSTER = "1".repeat(64);
const LICENSE = "3".repeat(64);

const living = createProjectAccessAssertion({
  group: GROUP,
  binding: "living",
  record: "record:lp3-kostenschaetzung",
  projectId: "demo-kita-2028",
  grantedAt: FEB,
  licenseHash: LICENSE,
});
assert.equal(living.$type$, PROJECT_ACCESS_ASSERTION_TYPE);
assert.equal(living.binding, "living");
assert.equal(living.hashGroup, undefined, "a living grant pins no roster");

const pinned = createProjectAccessAssertion({
  group: GROUP,
  hashGroup: ROSTER,
  binding: "pinned",
  record: "record:lp3-vergabeentscheidung",
  projectId: "demo-kita-2028",
  grantedAt: FEB,
  licenseHash: LICENSE,
});
// The pinned audience is the HashGroup itself. There is no separate member list
// that could disagree with it.
assert.equal(pinned.hashGroup, ROSTER);
assert.equal("pinnedSubjects" in pinned, false);

assert.throws(
  () =>
    createProjectAccessAssertion({
      group: GROUP,
      binding: "pinned",
      record: "record:x",
      projectId: "demo-kita-2028",
      grantedAt: FEB,
      licenseHash: LICENSE,
    }),
  /pinned grant requires hashGroup/,
);

assert.throws(
  () =>
    createProjectAccessAssertion({
      group: GROUP,
      binding: "whatever",
      record: "record:x",
      projectId: "demo-kita-2028",
      grantedAt: FEB,
      licenseHash: LICENSE,
    }),
  /binding must be "living" or "pinned"/,
);

console.log("group.core grant tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/grants.test.js`
Expected: FAIL with `does not provide an export named 'createProjectAccessAssertion'`.

- [ ] **Step 3: Write the grants module**

Create `packages/group.core/grants.js`:

```js
import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { rosterAsOf } from "./roster.js";

export const PROJECT_ACCESS_ASSERTION_TYPE = "ProjectAccessAssertion";

export const ProjectAccessLicense = {
  $type$: "License",
  name: "ProjectAccess",
  description:
    "The [signature.issuer] grants group [group] access to [record] in project [projectId] as of [grantedAt]. A living grant follows current membership; a pinned grant fixes the audience to the roster [hashGroup].",
};

export const ProjectAccessAssertionRecipe = {
  $type$: "Recipe",
  name: PROJECT_ACCESS_ASSERTION_TYPE,
  rule: [
    {
      itemprop: "group",
      itemtype: { type: "referenceToId", allowedTypes: new Set(["Group"]) },
    },
    {
      itemprop: "hashGroup",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["HashGroup"]) },
      optional: true,
    },
    { itemprop: "binding", itemtype: { type: "string", regexp: /^(living|pinned)$/ } },
    { itemprop: "record", itemtype: { type: "string" } },
    { itemprop: "projectId", itemtype: { type: "string" } },
    { itemprop: "grantedAt", itemtype: { type: "number" } },
    {
      itemprop: "license",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["License"]) },
    },
  ],
};

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ProjectAccessAssertion: ${field} is required`);
  }
  return value.trim();
}

export function createProjectAccessAssertion({
  group,
  hashGroup,
  binding,
  record,
  projectId,
  grantedAt,
  licenseHash,
} = {}) {
  if (binding !== "living" && binding !== "pinned") {
    throw new Error('ProjectAccessAssertion: binding must be "living" or "pinned"');
  }
  if (!Number.isFinite(grantedAt)) {
    throw new Error("ProjectAccessAssertion: grantedAt is required");
  }
  if (binding === "pinned" && !hashGroup) {
    throw new Error("ProjectAccessAssertion: pinned grant requires hashGroup");
  }

  const assertion = {
    $type$: PROJECT_ACCESS_ASSERTION_TYPE,
    group: requiredText(group, "group"),
    binding,
    record: requiredText(record, "record"),
    projectId: requiredText(projectId, "projectId"),
    grantedAt,
    license: requiredText(licenseHash, "licenseHash"),
  };
  if (binding === "pinned") {
    assertion.hashGroup = hashGroup;
  }
  return assertion;
}

export async function resolveGrantAudience(assertion, atTime) {
  if (!assertion || assertion.$type$ !== PROJECT_ACCESS_ASSERTION_TYPE) {
    throw new Error("resolveGrantAudience: assertion must be a ProjectAccessAssertion");
  }
  if (assertion.binding === "pinned") {
    const hashGroup = await getObject(assertion.hashGroup);
    return [...hashGroup.person].sort();
  }
  return rosterAsOf(assertion.group, atTime);
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/group.core/index.js`, add `export * from "./grants.js";` and add
`ProjectAccessAssertionRecipe` to the composed `GroupCoreRecipes` list.

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/group.core/grants.test.js`
Expected: PASS, prints `group.core grant tests passed`.

- [ ] **Step 6: Add the live audience case**

Extend `packages/group.core/roster.test.js`: after the second Group version is
stored, build one living and one pinned assertion over the first roster, and
assert that `resolveGrantAudience` gives `[]` for the living grant at `afterV2`
while the pinned grant still gives `[owner]`.

Run: `node ./packages/group.core/roster.test.js`
Expected: PASS.

- [ ] **Step 7: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/grants.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/group.core package.json
git commit -m "Bind project access grants as living or pinned"
```

---

### Task 6: Key Compromise Claims

**Files:**
- Create: `packages/group.core/compromise.js`
- Create: `packages/group.core/compromise.test.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Produces:
  - `KEY_COMPROMISE_CLAIM_TYPE`, `KeyCompromiseLicense`, `KeyCompromiseClaimRecipe`
  - `createKeyCompromiseClaim({person, compromisedSince, claimedAt, reason, licenseHash}) -> object`
  - `markDisputedAssertions(claim, assertions) -> Array<{assertion, disputed}>`, each input assertion `{person, assertedAt}`

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/compromise.test.js`:

```js
import assert from "node:assert/strict";
import {
  KEY_COMPROMISE_CLAIM_TYPE,
  createKeyCompromiseClaim,
  markDisputedAssertions,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);
const ANNA = "2".repeat(64);
const BEN = "4".repeat(64);
const LICENSE = "3".repeat(64);

const claim = createKeyCompromiseClaim({
  person: ANNA,
  compromisedSince: FEB,
  claimedAt: MAR,
  reason: "Laptop stolen, reported in March",
  licenseHash: LICENSE,
});

assert.equal(claim.$type$, KEY_COMPROMISE_CLAIM_TYPE);
assert.equal(claim.compromisedSince, FEB);
// The claim never touches a validity window.
assert.equal("validUntil" in claim, false);

const marked = markDisputedAssertions(claim, [
  { person: ANNA, assertedAt: JAN },
  { person: ANNA, assertedAt: MAR },
  { person: BEN, assertedAt: MAR },
]);
assert.equal(marked[0].disputed, false, "before the window: untouched");
assert.equal(marked[1].disputed, true, "inside the window: disputed, not invalid");
assert.equal(marked[2].disputed, false, "a different person is unaffected");

assert.throws(
  () =>
    createKeyCompromiseClaim({
      person: ANNA,
      compromisedSince: MAR,
      claimedAt: FEB,
      reason: "impossible",
      licenseHash: LICENSE,
    }),
  /compromisedSince must not be after claimedAt/,
);

console.log("group.core compromise tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/compromise.test.js`
Expected: FAIL with `does not provide an export named 'createKeyCompromiseClaim'`.

- [ ] **Step 3: Write the compromise module**

Create `packages/group.core/compromise.js`:

```js
export const KEY_COMPROMISE_CLAIM_TYPE = "KeyCompromiseClaim";

export const KeyCompromiseLicense = {
  $type$: "License",
  name: "KeyCompromise",
  description:
    "The [signature.issuer] claims that the keys of [person] were compromised from [compromisedSince], stated at [claimedAt]. This disputes assertions made by [person] in that window. It does not invalidate them and does not alter any certificate.",
};

export const KeyCompromiseClaimRecipe = {
  $type$: "Recipe",
  name: KEY_COMPROMISE_CLAIM_TYPE,
  rule: [
    {
      itemprop: "person",
      itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) },
    },
    { itemprop: "compromisedSince", itemtype: { type: "number" } },
    { itemprop: "claimedAt", itemtype: { type: "number" } },
    { itemprop: "reason", itemtype: { type: "string" } },
    {
      itemprop: "license",
      itemtype: { type: "referenceToObj", allowedTypes: new Set(["License"]) },
    },
  ],
};

/**
 * States that a person's keys were compromised from an earlier time.
 *
 * This is how a retroactive trust change is expressed. It never rewrites a
 * certificate's validity window: assertions in the window become disputed so a
 * verifier can re-weigh them, rather than disappearing.
 */
export function createKeyCompromiseClaim({
  person,
  compromisedSince,
  claimedAt,
  reason,
  licenseHash,
} = {}) {
  if (!Number.isFinite(compromisedSince)) {
    throw new Error("KeyCompromiseClaim: compromisedSince is required");
  }
  if (!Number.isFinite(claimedAt)) {
    throw new Error("KeyCompromiseClaim: claimedAt is required");
  }
  if (compromisedSince > claimedAt) {
    throw new Error("KeyCompromiseClaim: compromisedSince must not be after claimedAt");
  }
  if (!person) {
    throw new Error("KeyCompromiseClaim: person is required");
  }
  if (typeof reason !== "string" || reason.trim() === "") {
    throw new Error("KeyCompromiseClaim: reason is required");
  }
  if (!licenseHash) {
    throw new Error("KeyCompromiseClaim: licenseHash is required");
  }
  return {
    $type$: KEY_COMPROMISE_CLAIM_TYPE,
    person,
    compromisedSince,
    claimedAt,
    reason: reason.trim(),
    license: licenseHash,
  };
}

export function markDisputedAssertions(claim, assertions) {
  if (!claim || claim.$type$ !== KEY_COMPROMISE_CLAIM_TYPE) {
    throw new Error("markDisputedAssertions: claim must be a KeyCompromiseClaim");
  }
  if (!Array.isArray(assertions)) {
    throw new Error("markDisputedAssertions: assertions must be an array");
  }
  return assertions.map((assertion) => {
    if (!Number.isFinite(assertion.assertedAt)) {
      throw new Error("markDisputedAssertions: each assertion needs assertedAt");
    }
    return {
      assertion,
      disputed:
        assertion.person === claim.person &&
        assertion.assertedAt >= claim.compromisedSince,
    };
  });
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/group.core/index.js`, add `export * from "./compromise.js";` and add
`KeyCompromiseClaimRecipe` to the composed `GroupCoreRecipes` list.

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/group.core/compromise.test.js`
Expected: PASS, prints `group.core compromise tests passed`.

- [ ] **Step 6: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/compromise.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/group.core package.json
git commit -m "Express retroactive key compromise as a separate claim"
```

---

### Task 7: Document The Package And Amend The Spec

**Files:**
- Create: `packages/group.core/README.md`
- Modify: `README.md` (the `../one` Reuse Rule section)
- Modify: `docs/superpowers/specs/2026-08-31-group-sharing-design.md`

- [ ] **Step 1: Write the package README**

Create `packages/group.core/README.md`:

````markdown
# group.core

The time-bounded evidence layer for group sharing. Everything structural is
already in ONE.core and one.models; this package adds only what those lack.

## Reused, not rebuilt

| Concern | Type | Where |
|---|---|---|
| Group identity | `Group` — versioned, id `{name, owner}` | one.core |
| The roster, and its pin | `HashGroup` — content-addressed member set | one.core |
| Roster history and ordering | the `Group` version DAG | `getVersionsNodes` |
| Signatures | `Signature` — its own object, never a field | one.models |
| Certificate shape | claim + `License`, via `TrustedKeysManager.certify` | one.models |
| Authority checks | `TrustedKeysManager.getCertificates` | one.models |
| Access enforcement | `Access` links to `Group` | one.core |

`HashGroup`'s content hash *is* the roster pin. There is no snapshot type and no
member list carried alongside a hash that could disagree with it.

## What this package adds

Time. No existing certificate carries a validity window.

- `GroupMembershipCertificate` — issuer, pinned `HashGroup`, person, validity
  window, and the re-share right.
- `GroupDisclosureCertificate` — who was shown which roster, under which
  membership certificate.
- `ProjectAccessAssertion` — a group granted access to a project record, bound
  living or pinned. The only project-scoped type here.
- `KeyCompromiseClaim` — a retroactive trust change that disputes rather than
  invalidates.

## Two questions, two functions

```js
rosterAsOf(groupIdHash, atTime);
mayAct({ groupIdHash, subject, now, replicaAsOf, maxStalenessMs });
```

There is deliberately no `getMembers(group)`. `mayAct` throws `StaleChainError`
when the replica is older than the freshness policy allows, so a stale chain is
never read as a deny. `rosterAsOf` throws `ConcurrentVersionsError` when the
version in force at a time is genuinely ambiguous, rather than picking one.

## Why a membership certificate cannot go stale

It pins a `HashGroup`, so it proves "was in this roster", never "is in the group
now". The authoritative present-tense record is the `Group` version DAG. An old
certificate is not a security hole; it is a true statement about the past.

## Revocation

A superseding certificate ends the window at `revokedAt` — never earlier, not
even at the time the issuer learned of the trust change, which is recorded as
`learnedAt` for accountability and has no effect on validity. Backdating would
destroy good-faith assertions made in the gap without discriminating between
honest and hostile signatures in it.

Revocation ends future sync. It does not retract delivered bytes.
````

- [ ] **Step 2: Link the package from the root README**

In `README.md`, in the `../one` Reuse Rule section, add after the
`@refinio/trust.core` bullet:

```markdown
- `packages/group.core` for the time-bounded evidence layer over groups: it consumes ONE.core `Group`/`HashGroup` and one.models `Signature`/certificates rather than restating them, and adds only validity windows, the re-share right, disclosure records and compromise claims
```

- [ ] **Step 3: Check the spec still matches**

The spec was amended when this plan was written, so this is a consistency check
rather than a rewrite. Confirm that every type name, function signature and rule
in `docs/superpowers/specs/2026-08-31-group-sharing-design.md` matches what was
actually built, and correct whichever document is wrong.

- [ ] **Step 4: Verify the full suite**

Run: `npm test`
Expected: all tests pass, including all six `group.core` test files.

- [ ] **Step 5: Commit**

```bash
git add packages/group.core/README.md README.md docs/superpowers/specs
git commit -m "Document the group core package and align the spec"
```

---

## Deferred

Out of scope here, and why:

- **Bundle presentation of disputed assertions.** A bundle may contain valid but
  disputed contractual assertions; the export format must show that prominently
  or a verifier reads a disputed approval as a clean one. Needs the MR-6 bundle
  work first.
- **Disclosure record readership.** The spec defaults a disclosure to sharer and
  recipient only. Producing the record is here; restricting who receives it is
  `Access` wiring.
- **Public group descriptor publication**, and its test that the descriptor is
  readable while memberships are not. `Access` wiring.
- **CHUM propagation.** The reverse maps that make `HashGroup` traversable by
  person already exist; wiring sync is runtime integration.
- **Never-attested versus attested-but-expired issuers.** Belongs to the
  organization attestation tier that `group.core` consumes.
- **Merge policy for concurrent Group versions.** `rosterAsOf` throws
  `ConcurrentVersionsError` rather than guessing. Deciding the merge rule needs
  the multi-writer story, which this prototype does not have yet.
