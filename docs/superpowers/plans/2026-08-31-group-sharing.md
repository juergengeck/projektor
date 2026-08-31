# Group Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `packages/group.core` — group definitions, per-member certificates, access grants, and signed disclosure records — per [the design spec](../specs/2026-08-31-group-sharing-design.md).

**Architecture:** Membership is per-member certificates (versioned ONE objects keyed by `{group, subject, issuer}`); the roster is a derived projection, never stored as authoritative. Two evaluation functions replace any single membership lookup: `rosterAsOf` walks version history to an assertion time, `mayAct` reads latest under a freshness policy. Revocation reuses ONE.core version supersession and never moves `validUntil` earlier than issuance.

**Tech Stack:** Plain ESM JavaScript, no build step. Tests are standalone `node` scripts using `node:assert/strict`, run from the `test` script in `package.json`. ONE.core is consumed from the sibling checkout at `../../../one/packages/one.core/lib/`.

## Global Constraints

- Object type names exactly: `ProjectGroup`, `ProjectGroupMembership`, `ProjectGroupDisclosure`, `ProjectAccessAssertion`, `ProjectKeyCompromiseClaim`.
- `PROJECT_GROUP_SCHEMA_VERSION = "0.1.0"`; every stored object carries `schemaVersion`.
- Every recipe carries `$type$` with a `regexp` guard and `$version$` matching `/^v1$/`, following `packages/project-source.core/index.js`.
- `ProjectGroup` has **no** project field and **no** scope field. Scope is read off the issuer.
- `validUntil` is the only input to validity. `learnedAt` and `compromisedSince` never affect it.
- Revocation sets `validUntil = revokedAt`. A version whose `validUntil` precedes an assertion it authorized is rejected at write time.
- There is no `getMembers(group)`. Only `rosterAsOf` and `mayAct`.
- Disclosures pin a **content** hash. Living access grants bind an **id** hash; pinned grants bind a **content** hash.
- Fail fast and throw. No fallback values, no silent defaults for missing required input.
- Commit messages: imperative, sentence case, no prefix (repo style, e.g. "Add project source core"). No AI attribution.

---

### Task 1: Recipes And Group Descriptor

**Files:**
- Create: `packages/group.core/recipes.js`
- Create: `packages/group.core/groups.js`
- Create: `packages/group.core/index.js`
- Create: `packages/group.core/index.test.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: nothing.
- Produces: `PROJECT_GROUP_TYPE`, `PROJECT_GROUP_MEMBERSHIP_TYPE`, `PROJECT_GROUP_DISCLOSURE_TYPE`, `PROJECT_ACCESS_ASSERTION_TYPE`, `PROJECT_KEY_COMPROMISE_CLAIM_TYPE`, `PROJECT_GROUP_SCHEMA_VERSION`, `GroupCoreRecipes` (array), `createProjectGroup({groupId, name, purpose, issuer}) -> object`.

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/index.test.js`:

```js
import assert from "node:assert/strict";
import {
  PROJECT_GROUP_TYPE,
  PROJECT_GROUP_SCHEMA_VERSION,
  GroupCoreRecipes,
  createProjectGroup,
} from "./index.js";

const group = createProjectGroup({
  groupId: "tragwerksplanung",
  name: "Tragwerksplanung",
  purpose: "Structural engineers working with the office",
  issuer: "person:admin@buero.example.invalid",
});

assert.equal(group.$type$, PROJECT_GROUP_TYPE);
assert.equal(group.$version$, "v1");
assert.equal(group.groupId, "group:tragwerksplanung");
assert.equal(group.schemaVersion, PROJECT_GROUP_SCHEMA_VERSION);

// A group is a set of identities, and identities are organization-level.
// It must carry no project or scope field.
assert.equal("projectId" in group, false);
assert.equal("scope" in group, false);

assert.throws(
  () => createProjectGroup({ groupId: "x", name: "X", purpose: "p" }),
  /issuer is required/,
);

const groupRecipe = GroupCoreRecipes.find((recipe) => recipe.name === PROJECT_GROUP_TYPE);
assert.ok(groupRecipe, "ProjectGroup recipe is registered");
assert.ok(groupRecipe.rule.some((rule) => rule.itemprop === "groupId" && rule.isId === true));
assert.equal(groupRecipe.rule.some((rule) => rule.itemprop === "projectId"), false);

console.log("group.core index tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/index.test.js`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./index.js`.

- [ ] **Step 3: Write the recipes module**

Create `packages/group.core/recipes.js`:

```js
export const PROJECT_GROUP_TYPE = "ProjectGroup";
export const PROJECT_GROUP_MEMBERSHIP_TYPE = "ProjectGroupMembership";
export const PROJECT_GROUP_DISCLOSURE_TYPE = "ProjectGroupDisclosure";
export const PROJECT_ACCESS_ASSERTION_TYPE = "ProjectAccessAssertion";
export const PROJECT_KEY_COMPROMISE_CLAIM_TYPE = "ProjectKeyCompromiseClaim";
export const PROJECT_GROUP_SCHEMA_VERSION = "0.1.0";

export const ProjectGroupRecipe = {
  $type$: "Recipe",
  name: PROJECT_GROUP_TYPE,
  rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectGroup$/ } },
    { itemprop: "$version$", itemtype: { type: "string", regexp: /^v1$/ } },
    { itemprop: "groupId", itemtype: { type: "string" }, isId: true },
    { itemprop: "name", itemtype: { type: "string" } },
    { itemprop: "purpose", itemtype: { type: "string" } },
    { itemprop: "issuer", itemtype: { type: "string" } },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};

export const GroupCoreRecipes = [ProjectGroupRecipe];
```

- [ ] **Step 4: Write the group factory**

Create `packages/group.core/groups.js`:

```js
import {
  PROJECT_GROUP_TYPE,
  PROJECT_GROUP_SCHEMA_VERSION,
} from "./recipes.js";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ProjectGroup: ${field} is required`);
  }
  return value.trim();
}

export function createProjectGroup({ groupId, name, purpose, issuer } = {}) {
  const id = requiredText(groupId, "groupId");
  return {
    $type$: PROJECT_GROUP_TYPE,
    $version$: "v1",
    groupId: id.startsWith("group:") ? id : `group:${id}`,
    name: requiredText(name, "name"),
    purpose: requiredText(purpose, "purpose"),
    issuer: requiredText(issuer, "issuer"),
    schemaVersion: PROJECT_GROUP_SCHEMA_VERSION,
  };
}
```

- [ ] **Step 5: Write the barrel module**

Create `packages/group.core/index.js`:

```js
export * from "./recipes.js";
export * from "./groups.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node ./packages/group.core/index.test.js`
Expected: PASS, prints `group.core index tests passed`.

- [ ] **Step 7: Register the test in package.json**

In `package.json`, append to the end of the `test` script value, before the closing quote:

```
 && node ./packages/group.core/index.test.js
```

Run: `npm test`
Expected: all existing tests pass, ending with `group.core index tests passed`.

- [ ] **Step 8: Commit**

```bash
git add packages/group.core package.json
git commit -m "Add group core recipes and group descriptor"
```

---

### Task 2: Membership Certificates And Revocation Timing

**Files:**
- Create: `packages/group.core/memberships.js`
- Create: `packages/group.core/memberships.test.js`
- Modify: `packages/group.core/recipes.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `PROJECT_GROUP_MEMBERSHIP_TYPE`, `PROJECT_GROUP_SCHEMA_VERSION` from Task 1.
- Produces:
  - `createProjectGroupMembership({group, subject, issuer, validFrom, validUntil, mayReshare, issuedAt}) -> object`
  - `reviseProjectGroupMembership(previous, {validUntil, issuedAt, mayReshare, authorizedAssertionTimes}) -> object`
  - `revokeProjectGroupMembership(previous, {revokedAt, learnedAt, reason, authorizedAssertionTimes}) -> object`
  - Membership objects carry: `group`, `subject`, `issuer`, `validFrom`, `validUntil`, `issuedAt`, `mayReshare`, `schemaVersion`, and on revocation `revoked`, `revokedAt`, `learnedAt`, `revocationReason`.

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/memberships.test.js`:

```js
import assert from "node:assert/strict";
import {
  PROJECT_GROUP_MEMBERSHIP_TYPE,
  createProjectGroupMembership,
  reviseProjectGroupMembership,
  revokeProjectGroupMembership,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);
const DEC = Date.UTC(2026, 11, 1);

const base = createProjectGroupMembership({
  group: "group:tragwerksplanung",
  subject: "person:statik@partner.example.invalid",
  issuer: "person:admin@buero.example.invalid",
  validFrom: JAN,
  validUntil: DEC,
  mayReshare: false,
  issuedAt: JAN,
});

assert.equal(base.$type$, PROJECT_GROUP_MEMBERSHIP_TYPE);
assert.equal(base.mayReshare, false);
assert.equal(base.revoked, undefined);

// Revocation ends authority at the moment it is issued, never before.
const revoked = revokeProjectGroupMembership(base, {
  revokedAt: MAR,
  learnedAt: FEB,
  reason: "Left the partner office",
  authorizedAssertionTimes: [FEB],
});

assert.equal(revoked.validUntil, MAR, "validUntil ends at revocation time");
assert.equal(revoked.revokedAt, MAR);
assert.equal(revoked.learnedAt, FEB, "learning time is recorded");
assert.equal(revoked.revoked, true);
assert.equal(revoked.validFrom, JAN, "validFrom is never rewritten");

// Backdating to the learning time would destroy the assertion made in between.
assert.throws(
  () =>
    revokeProjectGroupMembership(base, {
      revokedAt: FEB,
      learnedAt: FEB,
      reason: "backdated",
      authorizedAssertionTimes: [MAR],
    }),
  /precedes an assertion it authorized/,
);

// The same guard applies to an ordinary revision that shortens the window.
assert.throws(
  () =>
    reviseProjectGroupMembership(base, {
      validUntil: FEB,
      issuedAt: MAR,
      authorizedAssertionTimes: [MAR],
    }),
  /precedes an assertion it authorized/,
);

const extended = reviseProjectGroupMembership(base, {
  validUntil: Date.UTC(2027, 5, 1),
  issuedAt: MAR,
  authorizedAssertionTimes: [FEB],
});
assert.equal(extended.validUntil, Date.UTC(2027, 5, 1));
assert.equal(extended.issuedAt, MAR);
assert.equal(extended.group, base.group, "identity props are preserved across versions");
assert.equal(extended.subject, base.subject);
assert.equal(extended.issuer, base.issuer);

assert.throws(
  () =>
    createProjectGroupMembership({
      group: "group:x",
      subject: "person:a",
      issuer: "person:b",
      validFrom: DEC,
      validUntil: JAN,
      issuedAt: JAN,
    }),
  /validUntil must be after validFrom/,
);

console.log("group.core membership tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/memberships.test.js`
Expected: FAIL with `SyntaxError: The requested module './index.js' does not provide an export named 'createProjectGroupMembership'`.

- [ ] **Step 3: Add the membership recipe**

In `packages/group.core/recipes.js`, add before the `GroupCoreRecipes` export:

```js
export const ProjectGroupMembershipRecipe = {
  $type$: "Recipe",
  name: PROJECT_GROUP_MEMBERSHIP_TYPE,
  rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectGroupMembership$/ } },
    { itemprop: "$version$", itemtype: { type: "string", regexp: /^v1$/ } },
    { itemprop: "group", itemtype: { type: "string" }, isId: true },
    { itemprop: "subject", itemtype: { type: "string" }, isId: true },
    { itemprop: "issuer", itemtype: { type: "string" }, isId: true },
    { itemprop: "validFrom", itemtype: { type: "number" } },
    { itemprop: "validUntil", itemtype: { type: "number" } },
    { itemprop: "issuedAt", itemtype: { type: "number" } },
    { itemprop: "mayReshare", itemtype: { type: "boolean" } },
    { itemprop: "revoked", itemtype: { type: "boolean" }, optional: true },
    { itemprop: "revokedAt", itemtype: { type: "number" }, optional: true },
    { itemprop: "learnedAt", itemtype: { type: "number" }, optional: true },
    { itemprop: "revocationReason", itemtype: { type: "string" }, optional: true },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};
```

Then change the `GroupCoreRecipes` export to:

```js
export const GroupCoreRecipes = [ProjectGroupRecipe, ProjectGroupMembershipRecipe];
```

- [ ] **Step 4: Write the membership module**

Create `packages/group.core/memberships.js`:

```js
import {
  PROJECT_GROUP_MEMBERSHIP_TYPE,
  PROJECT_GROUP_SCHEMA_VERSION,
} from "./recipes.js";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ProjectGroupMembership: ${field} is required`);
  }
  return value.trim();
}

function requiredTime(value, field) {
  if (!Number.isFinite(value)) {
    throw new Error(`ProjectGroupMembership: ${field} must be a timestamp in milliseconds`);
  }
  return value;
}

// validUntil is the only input to validity. A version may never end authority
// before an assertion that version's chain already authorized.
function assertCoversAuthorizedAssertions(validUntil, authorizedAssertionTimes) {
  const times = Array.isArray(authorizedAssertionTimes) ? authorizedAssertionTimes : [];
  for (const time of times) {
    requiredTime(time, "authorizedAssertionTimes entry");
    if (validUntil < time) {
      throw new Error(
        `ProjectGroupMembership: validUntil ${validUntil} precedes an assertion it authorized at ${time}`,
      );
    }
  }
}

export function createProjectGroupMembership({
  group,
  subject,
  issuer,
  validFrom,
  validUntil,
  mayReshare = false,
  issuedAt,
} = {}) {
  const from = requiredTime(validFrom, "validFrom");
  const until = requiredTime(validUntil, "validUntil");
  if (until <= from) {
    throw new Error("ProjectGroupMembership: validUntil must be after validFrom");
  }
  if (typeof mayReshare !== "boolean") {
    throw new Error("ProjectGroupMembership: mayReshare must be a boolean");
  }
  return {
    $type$: PROJECT_GROUP_MEMBERSHIP_TYPE,
    $version$: "v1",
    group: requiredText(group, "group"),
    subject: requiredText(subject, "subject"),
    issuer: requiredText(issuer, "issuer"),
    validFrom: from,
    validUntil: until,
    issuedAt: requiredTime(issuedAt, "issuedAt"),
    mayReshare,
    schemaVersion: PROJECT_GROUP_SCHEMA_VERSION,
  };
}

export function reviseProjectGroupMembership(
  previous,
  { validUntil, issuedAt, mayReshare, authorizedAssertionTimes } = {},
) {
  if (!previous || previous.$type$ !== PROJECT_GROUP_MEMBERSHIP_TYPE) {
    throw new Error("ProjectGroupMembership: previous version is required");
  }
  const until = requiredTime(validUntil, "validUntil");
  if (until <= previous.validFrom) {
    throw new Error("ProjectGroupMembership: validUntil must be after validFrom");
  }
  assertCoversAuthorizedAssertions(until, authorizedAssertionTimes);
  return {
    ...previous,
    validUntil: until,
    issuedAt: requiredTime(issuedAt, "issuedAt"),
    mayReshare: typeof mayReshare === "boolean" ? mayReshare : previous.mayReshare,
  };
}

export function revokeProjectGroupMembership(
  previous,
  { revokedAt, learnedAt, reason, authorizedAssertionTimes } = {},
) {
  if (!previous || previous.$type$ !== PROJECT_GROUP_MEMBERSHIP_TYPE) {
    throw new Error("ProjectGroupMembership: previous version is required");
  }
  const at = requiredTime(revokedAt, "revokedAt");
  assertCoversAuthorizedAssertions(at, authorizedAssertionTimes);
  const revocation = {
    ...previous,
    // Authority ends when the revocation is issued, never earlier.
    validUntil: at,
    issuedAt: at,
    revoked: true,
    revokedAt: at,
    revocationReason: requiredText(reason, "revocationReason"),
  };
  if (learnedAt !== undefined) {
    // Recorded for accountability. Never an input to validity.
    revocation.learnedAt = requiredTime(learnedAt, "learnedAt");
  }
  return revocation;
}
```

- [ ] **Step 5: Export from the barrel**

In `packages/group.core/index.js`, add:

```js
export * from "./memberships.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node ./packages/group.core/memberships.test.js`
Expected: PASS, prints `group.core membership tests passed`.

- [ ] **Step 7: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/memberships.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/group.core package.json
git commit -m "Add group membership certificates with prospective revocation"
```

---

### Task 3: rosterAsOf — The Evidence Question

**Files:**
- Create: `packages/group.core/roster.js`
- Create: `packages/group.core/roster.test.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: membership objects from Task 2 (`group`, `subject`, `issuer`, `validFrom`, `validUntil`, `issuedAt`).
- Produces: `rosterAsOf(memberships, atTime) -> string[]` — sorted subject identifiers.

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/roster.test.js`:

```js
import assert from "node:assert/strict";
import {
  createProjectGroupMembership,
  revokeProjectGroupMembership,
  rosterAsOf,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);
const DEC = Date.UTC(2026, 11, 1);

const anna = createProjectGroupMembership({
  group: "group:tragwerksplanung",
  subject: "person:anna@partner.example.invalid",
  issuer: "person:admin@buero.example.invalid",
  validFrom: JAN,
  validUntil: DEC,
  issuedAt: JAN,
});

const ben = createProjectGroupMembership({
  group: "group:tragwerksplanung",
  subject: "person:ben@partner.example.invalid",
  issuer: "person:admin@buero.example.invalid",
  validFrom: MAR,
  validUntil: DEC,
  issuedAt: MAR,
});

const annaRevoked = revokeProjectGroupMembership(anna, {
  revokedAt: MAR,
  reason: "Left the partner office",
  authorizedAssertionTimes: [FEB],
});

const versions = [anna, ben, annaRevoked];

// The revocation is dated March. It must not reach back into February.
assert.deepEqual(rosterAsOf(versions, FEB), ["person:anna@partner.example.invalid"]);

// In April, Anna's authority has ended and Ben's has begun.
assert.deepEqual(rosterAsOf(versions, Date.UTC(2026, 3, 1)), [
  "person:ben@partner.example.invalid",
]);

// Before anyone was admitted, the roster is empty.
assert.deepEqual(rosterAsOf(versions, Date.UTC(2025, 11, 1)), []);

// Only the version in force at the evaluated time governs it.
const extended = createProjectGroupMembership({
  group: "group:tragwerksplanung",
  subject: "person:anna@partner.example.invalid",
  issuer: "person:admin@buero.example.invalid",
  validFrom: JAN,
  validUntil: DEC,
  issuedAt: Date.UTC(2026, 5, 1),
});
assert.deepEqual(rosterAsOf([...versions, extended], FEB), [
  "person:anna@partner.example.invalid",
]);

assert.throws(() => rosterAsOf(versions, undefined), /atTime is required/);

console.log("group.core roster tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/roster.test.js`
Expected: FAIL with `does not provide an export named 'rosterAsOf'`.

- [ ] **Step 3: Write the roster projection**

Create `packages/group.core/roster.js`:

```js
import { PROJECT_GROUP_MEMBERSHIP_TYPE } from "./recipes.js";

function identityKey(membership) {
  return `${membership.group} ${membership.subject} ${membership.issuer}`;
}

/**
 * The evidence question: who was in the group at `atTime`?
 *
 * Only versions issued at or before `atTime` are considered, so a later
 * revocation cannot reach back into an earlier evaluation. This is a
 * projection — it is never stored as authoritative state.
 */
export function rosterAsOf(memberships, atTime) {
  if (!Number.isFinite(atTime)) {
    throw new Error("rosterAsOf: atTime is required");
  }
  if (!Array.isArray(memberships)) {
    throw new Error("rosterAsOf: memberships must be an array");
  }

  const inForce = new Map();
  for (const membership of memberships) {
    if (!membership || membership.$type$ !== PROJECT_GROUP_MEMBERSHIP_TYPE) {
      throw new Error("rosterAsOf: every entry must be a ProjectGroupMembership");
    }
    if (membership.issuedAt > atTime) {
      continue;
    }
    const key = identityKey(membership);
    const current = inForce.get(key);
    if (!current || membership.issuedAt > current.issuedAt) {
      inForce.set(key, membership);
    }
  }

  const subjects = [];
  for (const membership of inForce.values()) {
    if (membership.validFrom <= atTime && atTime <= membership.validUntil) {
      subjects.push(membership.subject);
    }
  }
  return subjects.sort();
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/group.core/index.js`, add:

```js
export * from "./roster.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/group.core/roster.test.js`
Expected: PASS, prints `group.core roster tests passed`.

- [ ] **Step 6: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/roster.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/group.core package.json
git commit -m "Project group rosters as of an assertion time"
```

---

### Task 4: mayAct — The Access Question

**Files:**
- Create: `packages/group.core/access.js`
- Create: `packages/group.core/access.test.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: membership objects from Task 2, `rosterAsOf` from Task 3.
- Produces:
  - `StaleChainError` (class extending `Error`, `name === "StaleChainError"`)
  - `mayAct(memberships, {subject, group, now, replicaAsOf, maxStalenessMs}) -> boolean`

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/access.test.js`:

```js
import assert from "node:assert/strict";
import {
  StaleChainError,
  createProjectGroupMembership,
  revokeProjectGroupMembership,
  mayAct,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);
const APR = Date.UTC(2026, 3, 1);
const DEC = Date.UTC(2026, 11, 1);
const DAY = 24 * 60 * 60 * 1000;

const anna = createProjectGroupMembership({
  group: "group:tragwerksplanung",
  subject: "person:anna@partner.example.invalid",
  issuer: "person:admin@buero.example.invalid",
  validFrom: JAN,
  validUntil: DEC,
  issuedAt: JAN,
});
const annaRevoked = revokeProjectGroupMembership(anna, {
  revokedAt: MAR,
  reason: "Left the partner office",
  authorizedAssertionTimes: [FEB],
});
const versions = [anna, annaRevoked];

const fresh = {
  subject: "person:anna@partner.example.invalid",
  group: "group:tragwerksplanung",
  now: APR,
  replicaAsOf: APR - DAY,
  maxStalenessMs: 7 * DAY,
};

// Revoked in March, so she may not act in April.
assert.equal(mayAct(versions, fresh), false);

// But she could act in February, under the same version history.
assert.equal(mayAct(versions, { ...fresh, now: FEB, replicaAsOf: FEB - DAY }), true);

// Unknown subject is denied, not errored.
assert.equal(mayAct(versions, { ...fresh, subject: "person:nobody@example.invalid" }), false);

// A replica staler than the policy fails closed and is distinguishable from a deny.
assert.throws(
  () => mayAct(versions, { ...fresh, replicaAsOf: APR - 30 * DAY }),
  StaleChainError,
);

assert.throws(
  () => mayAct(versions, { ...fresh, maxStalenessMs: undefined }),
  /maxStalenessMs is required/,
);
assert.throws(
  () => mayAct(versions, { ...fresh, replicaAsOf: undefined }),
  /replicaAsOf is required/,
);

console.log("group.core access tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/access.test.js`
Expected: FAIL with `does not provide an export named 'StaleChainError'`.

- [ ] **Step 3: Write the access module**

Create `packages/group.core/access.js`:

```js
import { rosterAsOf } from "./roster.js";

export class StaleChainError extends Error {
  constructor(message) {
    super(message);
    this.name = "StaleChainError";
  }
}

/**
 * The access question: may this participant act now?
 *
 * Evaluated against the present, under an explicit freshness policy. A replica
 * older than the policy allows throws rather than returning false, so a stale
 * chain can never be misread as an ordinary deny.
 */
export function mayAct(
  memberships,
  { subject, group, now, replicaAsOf, maxStalenessMs } = {},
) {
  if (typeof subject !== "string" || subject.trim() === "") {
    throw new Error("mayAct: subject is required");
  }
  if (typeof group !== "string" || group.trim() === "") {
    throw new Error("mayAct: group is required");
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

  const inGroup = memberships.filter((membership) => membership.group === group);
  return rosterAsOf(inGroup, now).includes(subject);
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/group.core/index.js`, add:

```js
export * from "./access.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/group.core/access.test.js`
Expected: PASS, prints `group.core access tests passed`.

- [ ] **Step 6: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/access.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/group.core package.json
git commit -m "Evaluate present group authority under a freshness policy"
```

---

### Task 5: Disclosure Records And The Re-Share Right

**Files:**
- Create: `packages/group.core/disclosure.js`
- Create: `packages/group.core/disclosure.test.js`
- Modify: `packages/group.core/recipes.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `PROJECT_GROUP_DISCLOSURE_TYPE` from Task 1, membership objects from Task 2.
- Produces: `createProjectGroupDisclosure({groupIdHash, groupVersionHash, recipient, disclosedBy, disclosedAt, sharerMembership, groupIssuer}) -> object`.

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/disclosure.test.js`:

```js
import assert from "node:assert/strict";
import {
  PROJECT_GROUP_DISCLOSURE_TYPE,
  createProjectGroupMembership,
  createProjectGroupDisclosure,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const DEC = Date.UTC(2026, 11, 1);

const ISSUER = "person:admin@buero.example.invalid";
const GROUP_ID = "group:tragwerksplanung";
const VERSION_HASH = "b1946ac92492d2347c6235b4d2611184";

function membershipFor(subject, mayReshare) {
  return createProjectGroupMembership({
    group: GROUP_ID,
    subject,
    issuer: ISSUER,
    validFrom: JAN,
    validUntil: DEC,
    mayReshare,
    issuedAt: JAN,
  });
}

const sharer = membershipFor("person:anna@partner.example.invalid", true);
const disclosure = createProjectGroupDisclosure({
  groupIdHash: GROUP_ID,
  groupVersionHash: VERSION_HASH,
  recipient: "person:bauamt@stadt.example.invalid",
  disclosedBy: "person:anna@partner.example.invalid",
  disclosedAt: FEB,
  sharerMembership: sharer,
  groupIssuer: ISSUER,
});

assert.equal(disclosure.$type$, PROJECT_GROUP_DISCLOSURE_TYPE);
// A disclosure pins the exact roster that was shown.
assert.equal(disclosure.groupVersionHash, VERSION_HASH);
assert.equal(disclosure.recipient, "person:bauamt@stadt.example.invalid");
assert.equal(disclosure.disclosedAt, FEB);

// Without the re-share right, disclosure fails closed.
const blocked = membershipFor("person:ben@partner.example.invalid", false);
assert.throws(
  () =>
    createProjectGroupDisclosure({
      groupIdHash: GROUP_ID,
      groupVersionHash: VERSION_HASH,
      recipient: "person:bauamt@stadt.example.invalid",
      disclosedBy: "person:ben@partner.example.invalid",
      disclosedAt: FEB,
      sharerMembership: blocked,
      groupIssuer: ISSUER,
    }),
  /does not carry mayReshare/,
);

// The group's own issuer discloses without needing a membership.
const byIssuer = createProjectGroupDisclosure({
  groupIdHash: GROUP_ID,
  groupVersionHash: VERSION_HASH,
  recipient: "person:bauamt@stadt.example.invalid",
  disclosedBy: ISSUER,
  disclosedAt: FEB,
  groupIssuer: ISSUER,
});
assert.equal(byIssuer.disclosedBy, ISSUER);

// A sharer cannot present someone else's certificate as their own authority.
assert.throws(
  () =>
    createProjectGroupDisclosure({
      groupIdHash: GROUP_ID,
      groupVersionHash: VERSION_HASH,
      recipient: "person:bauamt@stadt.example.invalid",
      disclosedBy: "person:ben@partner.example.invalid",
      disclosedAt: FEB,
      sharerMembership: sharer,
      groupIssuer: ISSUER,
    }),
  /certificate subject does not match/,
);

// Disclosure outside the sharer's validity window fails closed.
assert.throws(
  () =>
    createProjectGroupDisclosure({
      groupIdHash: GROUP_ID,
      groupVersionHash: VERSION_HASH,
      recipient: "person:bauamt@stadt.example.invalid",
      disclosedBy: "person:anna@partner.example.invalid",
      disclosedAt: Date.UTC(2027, 5, 1),
      sharerMembership: sharer,
      groupIssuer: ISSUER,
    }),
  /outside the sharer's validity window/,
);

console.log("group.core disclosure tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/disclosure.test.js`
Expected: FAIL with `does not provide an export named 'createProjectGroupDisclosure'`.

- [ ] **Step 3: Add the disclosure recipe**

In `packages/group.core/recipes.js`, add before the `GroupCoreRecipes` export:

```js
export const ProjectGroupDisclosureRecipe = {
  $type$: "Recipe",
  name: PROJECT_GROUP_DISCLOSURE_TYPE,
  rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectGroupDisclosure$/ } },
    { itemprop: "$version$", itemtype: { type: "string", regexp: /^v1$/ } },
    { itemprop: "groupIdHash", itemtype: { type: "string" } },
    { itemprop: "groupVersionHash", itemtype: { type: "string" } },
    { itemprop: "recipient", itemtype: { type: "string" } },
    { itemprop: "disclosedBy", itemtype: { type: "string" } },
    { itemprop: "disclosedAt", itemtype: { type: "number" } },
    { itemprop: "underCertificate", itemtype: { type: "string" }, optional: true },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};
```

Then change the `GroupCoreRecipes` export to:

```js
export const GroupCoreRecipes = [
  ProjectGroupRecipe,
  ProjectGroupMembershipRecipe,
  ProjectGroupDisclosureRecipe,
];
```

- [ ] **Step 4: Write the disclosure module**

Create `packages/group.core/disclosure.js`:

```js
import {
  PROJECT_GROUP_DISCLOSURE_TYPE,
  PROJECT_GROUP_SCHEMA_VERSION,
} from "./recipes.js";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ProjectGroupDisclosure: ${field} is required`);
  }
  return value.trim();
}

/**
 * Records that a participant disclosed a group definition to someone.
 *
 * `mayReshare` governs disclosure of the definition only. Authority to grant a
 * group access to project records comes from the project role certificate and
 * is checked elsewhere.
 */
export function createProjectGroupDisclosure({
  groupIdHash,
  groupVersionHash,
  recipient,
  disclosedBy,
  disclosedAt,
  sharerMembership,
  groupIssuer,
} = {}) {
  const by = requiredText(disclosedBy, "disclosedBy");
  const issuer = requiredText(groupIssuer, "groupIssuer");
  if (!Number.isFinite(disclosedAt)) {
    throw new Error("ProjectGroupDisclosure: disclosedAt is required");
  }

  const disclosure = {
    $type$: PROJECT_GROUP_DISCLOSURE_TYPE,
    $version$: "v1",
    groupIdHash: requiredText(groupIdHash, "groupIdHash"),
    // Pins the exact roster that was shown, not the group's later state.
    groupVersionHash: requiredText(groupVersionHash, "groupVersionHash"),
    recipient: requiredText(recipient, "recipient"),
    disclosedBy: by,
    disclosedAt,
    schemaVersion: PROJECT_GROUP_SCHEMA_VERSION,
  };

  if (by === issuer) {
    return disclosure;
  }

  if (!sharerMembership) {
    throw new Error(
      "ProjectGroupDisclosure: a non-issuer sharer must present a membership certificate",
    );
  }
  if (sharerMembership.subject !== by) {
    throw new Error(
      "ProjectGroupDisclosure: certificate subject does not match disclosedBy",
    );
  }
  if (sharerMembership.mayReshare !== true) {
    throw new Error(
      "ProjectGroupDisclosure: sharer's certificate does not carry mayReshare",
    );
  }
  if (
    disclosedAt < sharerMembership.validFrom ||
    disclosedAt > sharerMembership.validUntil
  ) {
    throw new Error(
      "ProjectGroupDisclosure: disclosedAt is outside the sharer's validity window",
    );
  }

  disclosure.underCertificate = `${sharerMembership.group} ${sharerMembership.subject} ${sharerMembership.issuer}`;
  return disclosure;
}
```

- [ ] **Step 5: Export from the barrel**

In `packages/group.core/index.js`, add:

```js
export * from "./disclosure.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node ./packages/group.core/disclosure.test.js`
Expected: PASS, prints `group.core disclosure tests passed`.

- [ ] **Step 7: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/disclosure.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/group.core package.json
git commit -m "Record group disclosures under an explicit re-share right"
```

---

### Task 6: Access Assertions With Living And Pinned Binding

**Files:**
- Create: `packages/group.core/grants.js`
- Create: `packages/group.core/grants.test.js`
- Modify: `packages/group.core/recipes.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `PROJECT_ACCESS_ASSERTION_TYPE` from Task 1, `rosterAsOf` from Task 3.
- Produces:
  - `createProjectAccessAssertion({groupIdHash, groupVersionHash, binding, pinnedSubjects, record, projectId, grantedBy, grantedAt}) -> object`
  - `resolveGrantAudience(assertion, memberships, atTime) -> string[]`

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/grants.test.js`:

```js
import assert from "node:assert/strict";
import {
  PROJECT_ACCESS_ASSERTION_TYPE,
  createProjectGroupMembership,
  createProjectAccessAssertion,
  resolveGrantAudience,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);
const DEC = Date.UTC(2026, 11, 1);

const ISSUER = "person:admin@buero.example.invalid";
const GROUP_ID = "group:tragwerksplanung";
const VERSION_AT_GRANT = "b1946ac92492d2347c6235b4d2611184";

function membershipFor(subject, validFrom, issuedAt) {
  return createProjectGroupMembership({
    group: GROUP_ID,
    subject,
    issuer: ISSUER,
    validFrom,
    validUntil: DEC,
    issuedAt,
  });
}

const anna = membershipFor("person:anna@partner.example.invalid", JAN, JAN);
// Ben joins after the grant was made.
const ben = membershipFor("person:ben@partner.example.invalid", MAR, MAR);
const memberships = [anna, ben];

const living = createProjectAccessAssertion({
  groupIdHash: GROUP_ID,
  binding: "living",
  record: "record:lp3-kostenschaetzung",
  projectId: "demo-kita-2028",
  grantedBy: ISSUER,
  grantedAt: FEB,
});
assert.equal(living.$type$, PROJECT_ACCESS_ASSERTION_TYPE);
assert.equal(living.binding, "living");
assert.equal(living.groupVersionHash, undefined);

const pinned = createProjectAccessAssertion({
  groupIdHash: GROUP_ID,
  groupVersionHash: VERSION_AT_GRANT,
  binding: "pinned",
  record: "record:lp3-vergabeentscheidung",
  projectId: "demo-kita-2028",
  grantedBy: ISSUER,
  grantedAt: FEB,
  pinnedSubjects: ["person:anna@partner.example.invalid"],
});
assert.equal(pinned.binding, "pinned");
assert.equal(pinned.groupVersionHash, VERSION_AT_GRANT);

// A living grant admits the later-added member.
assert.deepEqual(resolveGrantAudience(living, memberships, Date.UTC(2026, 3, 1)), [
  "person:anna@partner.example.invalid",
  "person:ben@partner.example.invalid",
]);

// A pinned grant does not.
assert.deepEqual(resolveGrantAudience(pinned, memberships, Date.UTC(2026, 3, 1)), [
  "person:anna@partner.example.invalid",
]);

assert.throws(
  () =>
    createProjectAccessAssertion({
      groupIdHash: GROUP_ID,
      binding: "pinned",
      record: "record:x",
      projectId: "demo-kita-2028",
      grantedBy: ISSUER,
      grantedAt: FEB,
      pinnedSubjects: ["person:anna@partner.example.invalid"],
    }),
  /pinned grant requires groupVersionHash/,
);

assert.throws(
  () =>
    createProjectAccessAssertion({
      groupIdHash: GROUP_ID,
      binding: "whatever",
      record: "record:x",
      projectId: "demo-kita-2028",
      grantedBy: ISSUER,
      grantedAt: FEB,
    }),
  /binding must be "living" or "pinned"/,
);

console.log("group.core grant tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/grants.test.js`
Expected: FAIL with `does not provide an export named 'createProjectAccessAssertion'`.

- [ ] **Step 3: Add the access assertion recipe**

In `packages/group.core/recipes.js`, add before the `GroupCoreRecipes` export:

```js
export const ProjectAccessAssertionRecipe = {
  $type$: "Recipe",
  name: PROJECT_ACCESS_ASSERTION_TYPE,
  rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectAccessAssertion$/ } },
    { itemprop: "$version$", itemtype: { type: "string", regexp: /^v1$/ } },
    { itemprop: "groupIdHash", itemtype: { type: "string" } },
    { itemprop: "groupVersionHash", itemtype: { type: "string" }, optional: true },
    { itemprop: "binding", itemtype: { type: "string", regexp: /^(living|pinned)$/ } },
    {
      itemprop: "pinnedSubjects",
      itemtype: { type: "array", item: { type: "string" } },
      optional: true,
    },
    { itemprop: "record", itemtype: { type: "string" } },
    { itemprop: "projectId", itemtype: { type: "string" } },
    { itemprop: "grantedBy", itemtype: { type: "string" } },
    { itemprop: "grantedAt", itemtype: { type: "number" } },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};
```

Then change the `GroupCoreRecipes` export to:

```js
export const GroupCoreRecipes = [
  ProjectGroupRecipe,
  ProjectGroupMembershipRecipe,
  ProjectGroupDisclosureRecipe,
  ProjectAccessAssertionRecipe,
];
```

- [ ] **Step 4: Write the grants module**

Create `packages/group.core/grants.js`:

```js
import {
  PROJECT_ACCESS_ASSERTION_TYPE,
  PROJECT_GROUP_SCHEMA_VERSION,
} from "./recipes.js";
import { rosterAsOf } from "./roster.js";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ProjectAccessAssertion: ${field} is required`);
  }
  return value.trim();
}

/**
 * Records that a group was granted access to a project record.
 *
 * A living grant binds the group id hash and follows current membership. A
 * pinned grant binds a content hash and fixes the audience to that roster. The
 * assertion records which was chosen, so an auditor can see whether the
 * audience was open or closed at grant time.
 */
export function createProjectAccessAssertion({
  groupIdHash,
  groupVersionHash,
  binding,
  pinnedSubjects,
  record,
  projectId,
  grantedBy,
  grantedAt,
} = {}) {
  if (binding !== "living" && binding !== "pinned") {
    throw new Error('ProjectAccessAssertion: binding must be "living" or "pinned"');
  }
  if (!Number.isFinite(grantedAt)) {
    throw new Error("ProjectAccessAssertion: grantedAt is required");
  }

  const assertion = {
    $type$: PROJECT_ACCESS_ASSERTION_TYPE,
    $version$: "v1",
    groupIdHash: requiredText(groupIdHash, "groupIdHash"),
    binding,
    record: requiredText(record, "record"),
    projectId: requiredText(projectId, "projectId"),
    grantedBy: requiredText(grantedBy, "grantedBy"),
    grantedAt,
    schemaVersion: PROJECT_GROUP_SCHEMA_VERSION,
  };

  if (binding === "pinned") {
    if (typeof groupVersionHash !== "string" || groupVersionHash.trim() === "") {
      throw new Error("ProjectAccessAssertion: pinned grant requires groupVersionHash");
    }
    if (!Array.isArray(pinnedSubjects) || pinnedSubjects.length === 0) {
      throw new Error("ProjectAccessAssertion: pinned grant requires pinnedSubjects");
    }
    assertion.groupVersionHash = groupVersionHash.trim();
    assertion.pinnedSubjects = [...pinnedSubjects].sort();
  }

  return assertion;
}

export function resolveGrantAudience(assertion, memberships, atTime) {
  if (!assertion || assertion.$type$ !== PROJECT_ACCESS_ASSERTION_TYPE) {
    throw new Error("resolveGrantAudience: assertion must be a ProjectAccessAssertion");
  }
  if (assertion.binding === "pinned") {
    return [...assertion.pinnedSubjects];
  }
  const inGroup = memberships.filter(
    (membership) => membership.group === assertion.groupIdHash,
  );
  return rosterAsOf(inGroup, atTime);
}
```

- [ ] **Step 5: Export from the barrel**

In `packages/group.core/index.js`, add:

```js
export * from "./grants.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node ./packages/group.core/grants.test.js`
Expected: PASS, prints `group.core grant tests passed`.

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
git commit -m "Bind group access grants as living or pinned"
```

---

### Task 7: Key Compromise Claims

**Files:**
- Create: `packages/group.core/compromise.js`
- Create: `packages/group.core/compromise.test.js`
- Modify: `packages/group.core/recipes.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `PROJECT_KEY_COMPROMISE_CLAIM_TYPE` from Task 1.
- Produces:
  - `createKeyCompromiseClaim({subject, compromisedSince, claimedBy, claimedAt, reason}) -> object`
  - `markDisputedAssertions(claim, assertions) -> Array<{assertion, disputed}>` where each input assertion has `{subject, assertedAt}`.

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/compromise.test.js`:

```js
import assert from "node:assert/strict";
import {
  PROJECT_KEY_COMPROMISE_CLAIM_TYPE,
  createKeyCompromiseClaim,
  markDisputedAssertions,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);

const claim = createKeyCompromiseClaim({
  subject: "person:anna@partner.example.invalid",
  compromisedSince: FEB,
  claimedBy: "person:admin@buero.example.invalid",
  claimedAt: MAR,
  reason: "Laptop stolen, reported in March",
});

assert.equal(claim.$type$, PROJECT_KEY_COMPROMISE_CLAIM_TYPE);
assert.equal(claim.compromisedSince, FEB);
assert.equal(claim.claimedAt, MAR);

const assertions = [
  { subject: "person:anna@partner.example.invalid", assertedAt: JAN },
  { subject: "person:anna@partner.example.invalid", assertedAt: MAR },
  { subject: "person:ben@partner.example.invalid", assertedAt: MAR },
];

const marked = markDisputedAssertions(claim, assertions);

// Before the compromise window: untouched.
assert.equal(marked[0].disputed, false);
// Inside the window, by the compromised subject: disputed, not invalid.
assert.equal(marked[1].disputed, true);
// A different subject is unaffected.
assert.equal(marked[2].disputed, false);

// The claim never alters a certificate version.
assert.equal("validUntil" in claim, false);
assert.equal("revoked" in claim, false);

assert.throws(
  () =>
    createKeyCompromiseClaim({
      subject: "person:anna@partner.example.invalid",
      compromisedSince: MAR,
      claimedBy: "person:admin@buero.example.invalid",
      claimedAt: FEB,
      reason: "impossible",
    }),
  /compromisedSince must not be after claimedAt/,
);

console.log("group.core compromise tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/compromise.test.js`
Expected: FAIL with `does not provide an export named 'createKeyCompromiseClaim'`.

- [ ] **Step 3: Add the compromise claim recipe**

In `packages/group.core/recipes.js`, add before the `GroupCoreRecipes` export:

```js
export const ProjectKeyCompromiseClaimRecipe = {
  $type$: "Recipe",
  name: PROJECT_KEY_COMPROMISE_CLAIM_TYPE,
  rule: [
    { itemprop: "$type$", itemtype: { type: "string", regexp: /^ProjectKeyCompromiseClaim$/ } },
    { itemprop: "$version$", itemtype: { type: "string", regexp: /^v1$/ } },
    { itemprop: "subject", itemtype: { type: "string" } },
    { itemprop: "compromisedSince", itemtype: { type: "number" } },
    { itemprop: "claimedBy", itemtype: { type: "string" } },
    { itemprop: "claimedAt", itemtype: { type: "number" } },
    { itemprop: "reason", itemtype: { type: "string" } },
    { itemprop: "schemaVersion", itemtype: { type: "string" } },
  ],
};
```

Then change the `GroupCoreRecipes` export to:

```js
export const GroupCoreRecipes = [
  ProjectGroupRecipe,
  ProjectGroupMembershipRecipe,
  ProjectGroupDisclosureRecipe,
  ProjectAccessAssertionRecipe,
  ProjectKeyCompromiseClaimRecipe,
];
```

- [ ] **Step 4: Write the compromise module**

Create `packages/group.core/compromise.js`:

```js
import {
  PROJECT_KEY_COMPROMISE_CLAIM_TYPE,
  PROJECT_GROUP_SCHEMA_VERSION,
} from "./recipes.js";

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ProjectKeyCompromiseClaim: ${field} is required`);
  }
  return value.trim();
}

/**
 * States that a subject's key was compromised from some earlier time.
 *
 * This is how a retroactive trust change is expressed. It never rewrites a
 * certificate's validity window: assertions in the window become disputed so a
 * verifier can re-weigh them, rather than disappearing.
 */
export function createKeyCompromiseClaim({
  subject,
  compromisedSince,
  claimedBy,
  claimedAt,
  reason,
} = {}) {
  if (!Number.isFinite(compromisedSince)) {
    throw new Error("ProjectKeyCompromiseClaim: compromisedSince is required");
  }
  if (!Number.isFinite(claimedAt)) {
    throw new Error("ProjectKeyCompromiseClaim: claimedAt is required");
  }
  if (compromisedSince > claimedAt) {
    throw new Error(
      "ProjectKeyCompromiseClaim: compromisedSince must not be after claimedAt",
    );
  }
  return {
    $type$: PROJECT_KEY_COMPROMISE_CLAIM_TYPE,
    $version$: "v1",
    subject: requiredText(subject, "subject"),
    compromisedSince,
    claimedBy: requiredText(claimedBy, "claimedBy"),
    claimedAt,
    reason: requiredText(reason, "reason"),
    schemaVersion: PROJECT_GROUP_SCHEMA_VERSION,
  };
}

export function markDisputedAssertions(claim, assertions) {
  if (!claim || claim.$type$ !== PROJECT_KEY_COMPROMISE_CLAIM_TYPE) {
    throw new Error("markDisputedAssertions: claim must be a ProjectKeyCompromiseClaim");
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
        assertion.subject === claim.subject &&
        assertion.assertedAt >= claim.compromisedSince,
    };
  });
}
```

- [ ] **Step 5: Export from the barrel**

In `packages/group.core/index.js`, add:

```js
export * from "./compromise.js";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `node ./packages/group.core/compromise.test.js`
Expected: PASS, prints `group.core compromise tests passed`.

- [ ] **Step 7: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/compromise.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/group.core package.json
git commit -m "Express retroactive key compromise as a separate claim"
```

---

### Task 8: Signing And Storage Against A Live ONE.core Instance

**Files:**
- Create: `packages/group.core/signing.js`
- Create: `packages/group.core/signing.test.js`
- Modify: `packages/group.core/index.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: every factory from Tasks 1–7, `GroupCoreRecipes` from Task 1.
- Produces:
  - `signGroupObject(object, cryptoApi) -> Promise<object>` — a copy with `signature` (base64) added.
  - `verifyGroupObject(signedObject, publicSignKey) -> boolean`
  - `storeGroupDefinition({group, cryptoApi}) -> Promise<{idHash, versionHash, signed}>`
  - `readGroupDefinition(idHash) -> Promise<object>`

ONE.core import paths mirror `packages/project-source.core/index.js`, which
imports from the sibling checkout at `../../../one/packages/one.core/lib/`.

- [ ] **Step 1: Write the failing test**

Create `packages/group.core/signing.test.js`:

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
import { createCryptoApiFromDefaultKeys } from "../../../one/packages/one.core/lib/keychain/keychain.js";
import {
  GroupCoreRecipes,
  createProjectGroup,
  createProjectGroupMembership,
  signGroupObject,
  verifyGroupObject,
  storeGroupDefinition,
} from "./index.js";

const directory = await mkdtemp(path.join(tmpdir(), "projektor-group-"));
let initialized = false;

try {
  await initInstance({
    name: "projektor-group-test",
    email: "projektor-group-test@example.invalid",
    secret: "projektor-group-test-secret",
    wipeStorage: true,
    encryptStorage: false,
    directory,
    initialRecipes: GroupCoreRecipes,
  });
  initialized = true;

  const owner = getInstanceOwnerIdHash();
  assert.ok(owner, "instance owner id hash is available");
  const cryptoApi = await createCryptoApiFromDefaultKeys(owner);

  const group = createProjectGroup({
    groupId: "tragwerksplanung",
    name: "Tragwerksplanung",
    purpose: "Structural engineers working with the office",
    issuer: `person:${owner}`,
  });

  const stored = await storeGroupDefinition({ group, cryptoApi });
  assert.ok(stored.idHash, "group definition has an id hash");
  assert.ok(stored.versionHash, "group definition has a content hash");
  assert.notEqual(stored.idHash, stored.versionHash);
  assert.ok(stored.signed.signature, "stored definition is signed");

  const membership = createProjectGroupMembership({
    group: group.groupId,
    subject: "person:anna@partner.example.invalid",
    issuer: `person:${owner}`,
    validFrom: Date.UTC(2026, 0, 1),
    validUntil: Date.UTC(2026, 11, 1),
    mayReshare: true,
    issuedAt: Date.UTC(2026, 0, 1),
  });

  const signed = await signGroupObject(membership, cryptoApi);
  assert.ok(signed.signature, "membership is signed");
  assert.equal(signed.subject, membership.subject);
  assert.equal(verifyGroupObject(signed, cryptoApi.publicSignKey), true);

  const tampered = { ...signed, mayReshare: false };
  assert.equal(
    verifyGroupObject(tampered, cryptoApi.publicSignKey),
    false,
    "a mutated signed field must not verify",
  );

  console.log("group.core signing tests passed");
} finally {
  if (initialized) {
    closeInstance();
  }
  await rm(directory, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/group.core/signing.test.js`
Expected: FAIL with `does not provide an export named 'signGroupObject'`.

- [ ] **Step 3: Write the signing module**

Create `packages/group.core/signing.js`:

```js
import { stringify as oneStableStringify } from "../../../one/packages/one.core/lib/util/sorted-stringify.js";
import { signatureVerify } from "../../../one/packages/one.core/lib/crypto/sign.js";
import {
  getObjectByIdHash,
  storeVersionedObject,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";

// The signature covers every field except the signature itself.
function signablePayload(object) {
  const { signature, ...rest } = object;
  return new TextEncoder().encode(oneStableStringify(rest));
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(text) {
  return new Uint8Array(Buffer.from(text, "base64"));
}

export async function signGroupObject(object, cryptoApi) {
  if (!object || typeof object !== "object") {
    throw new Error("signGroupObject: object is required");
  }
  if (!cryptoApi || typeof cryptoApi.sign !== "function") {
    throw new Error("signGroupObject: cryptoApi with a sign method is required");
  }
  const signature = cryptoApi.sign(signablePayload(object));
  return { ...object, signature: toBase64(signature) };
}

export function verifyGroupObject(signedObject, publicSignKey) {
  if (!signedObject || typeof signedObject.signature !== "string") {
    throw new Error("verifyGroupObject: signedObject must carry a signature");
  }
  return signatureVerify(
    signablePayload(signedObject),
    fromBase64(signedObject.signature),
    publicSignKey,
  );
}

export async function storeGroupDefinition({ group, cryptoApi } = {}) {
  if (!group) {
    throw new Error("storeGroupDefinition: group is required");
  }
  const signed = await signGroupObject(group, cryptoApi);
  const result = await storeVersionedObject(signed);
  return {
    idHash: result.idHash,
    versionHash: result.hash,
    signed,
  };
}

export async function readGroupDefinition(idHash) {
  if (!idHash) {
    throw new Error("readGroupDefinition: idHash is required");
  }
  return getObjectByIdHash(idHash);
}
```

- [ ] **Step 4: Export from the barrel**

In `packages/group.core/index.js`, add:

```js
export * from "./signing.js";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/group.core/signing.test.js`
Expected: PASS, prints `group.core signing tests passed`.

If `storeVersionedObject` reports an unknown recipe, confirm `GroupCoreRecipes`
is passed as `initialRecipes` in the test's `initInstance` call.

- [ ] **Step 6: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/group.core/signing.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/group.core package.json
git commit -m "Sign and store group definitions through ONE.core"
```

---

### Task 9: Document The Package

**Files:**
- Create: `packages/group.core/README.md`
- Modify: `README.md` (the `../one` Reuse Rule section)

**Interfaces:**
- Consumes: the full export surface from Tasks 1–8.
- Produces: no code.

- [ ] **Step 1: Write the package README**

Create `packages/group.core/README.md` with this content:

````markdown
# group.core

Group definitions, per-member certificates, access grants, and disclosure
records. Implements [the group sharing design](../../docs/superpowers/specs/2026-08-31-group-sharing-design.md).

## Model

A group is a set of identities. Identities are organization-level, so a group
carries no project field and no scope field — scope is read off the issuer. The
project appears only in `ProjectAccessAssertion`.

Membership is one certificate per member, keyed by `{group, subject, issuer}`.
The roster is a projection derived from those certificates and is never stored
as authoritative state.

## Two questions, two functions

```js
rosterAsOf(memberships, atTime);
mayAct(memberships, { subject, group, now, replicaAsOf, maxStalenessMs });
```

`rosterAsOf` answers the evidence question — who was in the group then.
`mayAct` answers the access question — may this participant act now.

There is deliberately no `getMembers(group)`. A caller must state which question
it is asking. `mayAct` throws `StaleChainError` when the local replica is older
than the freshness policy allows, so a stale chain is never read as a deny.

## Revocation

Revocation supersedes the certificate with a new version whose `validUntil`
equals `revokedAt`. It never ends authority before the revocation was issued —
including not at the time the issuer learned of the trust change, which is
recorded as `learnedAt` for accountability and has no effect on validity.

A retroactive compromise is a separate `ProjectKeyCompromiseClaim`. It marks
assertions in its window disputed, leaving them verifiable, rather than deleting
good evidence in order to reach the bad.

## Access grants

`binding: "living"` follows current membership. `binding: "pinned"` fixes the
audience to the roster at grant time. The assertion records which was chosen.

Revocation ends future sync. It does not retract delivered bytes.
````

- [ ] **Step 2: Link the package from the root README**

In `README.md`, in the `../one` Reuse Rule section, add this bullet after the
`@refinio/trust.core` bullet:

```markdown
- `packages/group.core` for group definitions, membership certificates, access grants and disclosure records; it follows the `@refinio/trust.core` certificate-versioning model — supersession through ONE.core versioning — rather than adding a second revocation mechanism, and corrects two of its evaluation rules for evidence use
```

- [ ] **Step 3: Verify the full suite still passes**

Run: `npm test`
Expected: all tests pass, including all eight `group.core` test files.

- [ ] **Step 4: Commit**

```bash
git add packages/group.core/README.md README.md
git commit -m "Document the group core package"
```

---

## Deferred

These come from the spec but are not implemented by this plan, because they
belong to the export/bundle and UI surfaces rather than to `group.core`:

- **Bundle presentation of disputed assertions.** A bundle may contain valid but
  disputed contractual assertions. The export format must show that prominently
  rather than as a footnote, or a verifier reads a disputed approval as a clean
  one. Needs the MR-6 bundle work to exist first.
- **Bundle as-of time and the question it answers.** Same dependency.
- **Per-project "which groups reach this project" view.** The UI surface that
  makes an org-wide group's blast radius visible. Depends on `app.js` cockpit
  wiring, not on this package.
- **CHUM propagation and ONE.core `Access` object wiring.** `group.core`
  produces the assertions; granting the underlying `Access` objects and syncing
  them is runtime integration.
- **Public group descriptor publication.** The model supports it (descriptor and
  memberships are separate objects); publishing under a well-known id is a
  runtime/access concern handled with the `Access` wiring above. The spec's test
  "a public group descriptor is readable while its memberships are not" lands
  there, not here.
- **Disclosure record readership.** The spec defaults a disclosure to being
  readable by sharer and recipient only. `group.core` produces the record;
  restricting who receives it is `Access` wiring.
- **Never-attested versus attested-but-expired issuers.** The spec lists a test
  for this. It belongs to the organization attestation tier above `group.core`,
  which this package consumes rather than implements.
