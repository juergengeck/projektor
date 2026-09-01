# Group Sharing Implementation Plan

> **SUPERSEDED — 2026-09-01. Do not execute.**
>
> This plan targets `packages/group.core`. The work was carried out instead in
> [`packages/trust.projektor`](../../../packages/trust.projektor/README.md),
> which is ahead of this plan and differs from it deliberately:
>
> - Membership evidence is split into three layers — a portable attestation
>   bundle, a receiver-local verification status, and a versioned effective
>   projection — rather than the single certificate type below.
> - The narrowing rule covers `mayReshare` as well as `validUntil`: the most
>   restrictive value in a lineage wins.
> - Attestation types are named in `ProjektorAttestationDefinitions` and read
>   through trust.core's `TypedAttestationService`, instead of the wildcard
>   reverse maps this plan copied from one.models.
> - There is no Leute/contact model dependency. Task 4 below requires one; that
>   requirement was dropped.
> - Disclosure authority is stricter here than below: the verified signer must be
>   the Group owner, the roster pin must match, and the sharer must still be in
>   the structural roster at action time.
>
> Kept for the reasoning in its task notes — particularly the certificate
> combining rule and the API contracts recorded against one.core and one.models.
> The current design is [the spec](../specs/2026-08-31-group-sharing-design.md).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing generic typed-attestation service to `trust.core`,
keep structural roster history in `group.core`, and build Projektor's
time-bounded trust claims and authorization projections in `trust.projektor`:
membership validity windows, the re-share right, disclosure records, exact
group/roster binding and the two evaluation times.

**Architecture:** Groups are `Group` (versioned, id `{name, owner}`) referencing
`HashGroup` (unversioned, content-addressed member set). The roster history is
the `Group` version DAG; `HashGroup`'s content hash is the roster pin.
`trust.core` owns typed attestation issuance, lookup, signature verification and
issuer-key evidence. `group.core` owns the structural `Group`/`HashGroup`
history and time-indexed roster queries. `trust.projektor` owns Projektor's
domain claims, immutable evidence bundles, receiver-local statuses, effective
membership projections and admission rules: the signer must be the group owner,
the claim must name the exact roster, membership lineages are time-bounded, and
`mayReshare` governs disclosure. Neither product package constructs or imports
`LeuteModel` or `TrustedKeysManager`.

**Tech Stack:** Plain ESM JavaScript in Projektor (`group.core` and
`trust.projektor`), TypeScript in sibling `assembly.core`/`trust.core`, and
standalone `node` tests registered in `package.json`. ONE.core, one.models
crypto primitives and trust.core are consumed from the sibling checkout at
`../../../one/packages/`.

---

## Design Deltas From The Spec

The [spec](../specs/2026-08-31-group-sharing-design.md) was written before checking what
the platform already provides. It invented types that exist. It was amended for
the ONE.core model once; Task 8 must amend it again for the trust.core boundary
defined here. Until that consistency pass is complete, this plan is authoritative
about package ownership. Its *reasoning* — two evaluation times, prospective
revocation, disclosure as evidence — is unchanged.

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
   signature}`. A `signature` field on a recipe is rejected by the serializer
   (`O2M-COBJ2: Unknown properties`), which is correct behaviour rather than an
   obstacle. Raw signing is a ONE.core/one.models primitive; attestation
   authorship and verification belong to `trust.core`.
5. **Authorization is a `trust.core` result with exact evidence**, not a
   `TrustedKeysManager` boolean and not a signature check against a
   caller-supplied key. `trust.core` verifies the signer/key credential;
   `trust.projektor` separately proves that the verified signer is `Group.owner`
   and that the claim names the exact `HashGroup` being disclosed, using
   `group.core` for roster history.
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

8. **Projektor trust evidence lives in `trust.projektor`, not `group.core` or
   `trust.core`.** The canonical trust architecture requires the semantic claim
   owner to own immutable bundles, receiver-local statuses and effective
   projections. `group.core` supplies roster facts; `trust.core` supplies exact
   authorship and issuer-key truth; `trust.projektor` joins them under Projektor
   policy.

9. **Evidence time is signed claim data, not unsigned bundle metadata.** The
   membership claim carries `issuedAt`; membership import requires
   `bundle.authoredAt === claim.issuedAt`. Disclosure already carries the signed
   `disclosedAt` and likewise requires equality with bundle authorship time.
   Without this binding, a valid claim/signature could be repackaged at a
   different historical authority or roster time.

**What is genuinely new in `trust.projektor`:** the reused one.models domain
certificate shapes carry no membership validity window.
`AffirmationCertificate` is `{data, license}`; `RelationCertificate` is `{app,
relation, person1, person2, license}`. Time, exact roster binding and the
Projektor bundle/status/projection are the gap.

---

## Global Constraints

- Reuse before adding. Every new recipe must be justified by something the
  existing types cannot express. That justification is time bounds and the
  re-share right.
- New type names carry no `Project` prefix unless genuinely project-scoped.
  `ProjectAccessAssertion` earns it; nothing else here does.
- Projektor domain claims and their bundle/status/projection schemas belong to
  `trust.projektor`. Claims are typed ONE objects with separate signatures and
  exact trust provenance, authored and cryptographically verified through the
  `trust.core` facade. Never put a `signature` field on a claim recipe.
- `group.core` and `trust.projektor` must not import, construct, initialize or
  accept a `LeuteModel`/`TrustedKeysManager`. A Projektor runtime that already
  owns an authenticated model graph may adapt its identity material into
  `trust.core`; that adapter is runtime integration, not a product-domain
  dependency.
- Typed lookup is informed: query one exact certificate type through its
  explicit reverse-map property. Do not call `getCertificates()` and do not use
  wildcard reverse maps for group-domain types.
- Key trust and Projektor authority remain separate. A verified signer
  credential does not authorize that signer to administer an arbitrary group;
  that admission decision is reduced in `trust.projektor`.
- Reference-typed fields use `referenceToId` / `referenceToObj` with
  `allowedTypes`, never a bare string standing in for a hash.
- `validUntil` is the only input to validity. `learnedAt` and `compromisedSince`
  never affect it. Revocation ends authority at issuance, never earlier.
- There is no `getMembers(group)` or structural `mayAct`. `group.core` exposes
  only `rosterAsOf` and `isRosterMemberAt`; trust.projektor owns authorization.
- Fail fast and throw. No fallback values, no silent defaults for required input.
- Commit messages: imperative, sentence case, no prefix, no AI attribution.

---

### Task 1: API Spike — Settle The Runtime Contracts

This is a spike, not a slice of the product: it produces no reusable code and
does not exercise the layer this package exists to add. Its only job is to find
out what ONE.core and one.models actually do, by poking them directly — store a
group and its roster, sign a version, store a second version, and read the
version DAG back.

The end-to-end proof of the real system is Task 5, once there is a real system
to prove.

**Everything after this task depends on what this test discovers.** The API
shapes below are read from the `.d.ts` files but have not been executed. Where
the runtime disagrees, the runtime wins — fix the test, then carry the correction
into later tasks before starting them.

Specifically unverified, to be confirmed on first run:
- whether storing a `Group` requires its `HashGroup` stored first
- the exact field names on `storeVersionedObject` / `storeUnversionedObject` results
- whether raw `sign()` needs anything beyond the initialized ONE instance (this
  proves only the crypto primitive; Task 4 owns attestation semantics)
- what `getVersionsNodes` returns, and in what order

**Files:**
- Create: `packages/group.core/spike.test.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `Group`, `HashGroup` from one.core; `sign`, `getSignatures` from one.models.
- Produces: confirmed API contracts, recorded as comments in the test and consumed by every later task.

- [ ] **Step 1: Write the end-to-end test**

Create `packages/group.core/spike.test.js`:

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
    name: "projektor-group-spike",
    email: "projektor-group-spike@example.invalid",
    secret: "projektor-group-spike-secret",
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

  console.log("group.core spike test passed");
} finally {
  if (initialized) {
    closeInstance();
  }
  await rm(directory, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run it and record what the runtime actually does**

Run: `node ./packages/group.core/spike.test.js`

This is expected to fail on the first run — that is the point. Fix the test to
match the runtime, one failure at a time. Record each correction as a comment at
the top of the file under a `// Confirmed contracts:` heading, covering at least
the four unknowns listed above.

Do not proceed to Step 3 until the test passes and those four are written down.

- [ ] **Step 3: Register the test in package.json**

In `package.json`, append to the end of the `test` script value:

```
 && node ./packages/group.core/spike.test.js
```

Run: `npm test`
Expected: all existing tests pass, ending with `group.core spike test passed`.

- [ ] **Step 4: Commit**

```bash
git add packages/group.core package.json
git commit -m "Prove the group sharing slice against a live instance"
```

- [ ] **Step 5: Reconcile the rest of the plan**

Re-read Tasks 2–8 against the confirmed contracts. Where a task's code uses an
API shape the spike disproved, correct the task before starting it, and note
the correction in that task's commit message.

---

### Task 2: Structural Roster Queries Over The Version DAG

**Files:**
- Create: `packages/group.core/roster.js`
- Create: `packages/group.core/index.js`
- Create: `packages/group.core/package.json`
- Create: `packages/group.core/roster.test.js`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `getVersionsNodes`, `getVersion`, `getObject` from one.core; contracts confirmed in Task 1.
- Produces:
  - `StaleChainError` — class extending `Error`, `name === "StaleChainError"`
  - `ConcurrentVersionsError` — class extending `Error`, thrown when the version in force at a time is ambiguous
  - `rosterAsOf(groupIdHash, atTime) -> Promise<string[]>` — sorted Person id hashes
  - `isRosterMemberAt({groupIdHash, subject, atTime, replicaAsOf, maxStalenessMs}) -> Promise<boolean>`

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
import { StaleChainError, rosterAsOf, isRosterMemberAt } from "./index.js";

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

  // Structural roster membership at the evaluation time, under a freshness policy.
  assert.equal(
    await isRosterMemberAt({
      groupIdHash: v1.idHash,
      subject: owner,
      atTime: afterV2,
      replicaAsOf: afterV2 - DAY,
      maxStalenessMs: 7 * DAY,
    }),
    false,
  );

  // A replica staler than the policy fails closed, distinguishably from a deny.
  await assert.rejects(
    () =>
      isRosterMemberAt({
        groupIdHash: v1.idHash,
        subject: owner,
        atTime: afterV2,
        replicaAsOf: afterV2 - 30 * DAY,
        maxStalenessMs: 7 * DAY,
      }),
    StaleChainError,
  );

  await assert.rejects(
    () => isRosterMemberAt({ groupIdHash: v1.idHash, subject: owner, atTime: afterV2 }),
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
 * Structural question: was this participant in the roster at the named time?
 *
 * A replica older than the freshness policy allows throws rather than returning
 * false, so a stale chain can never be misread as an ordinary deny.
 */
export async function isRosterMemberAt({
  groupIdHash,
  subject,
  atTime,
  replicaAsOf,
  maxStalenessMs,
} = {}) {
  if (!subject) {
    throw new Error("isRosterMemberAt: subject is required");
  }
  if (!Number.isFinite(atTime)) {
    throw new Error("isRosterMemberAt: atTime is required");
  }
  if (!Number.isFinite(replicaAsOf)) {
    throw new Error("isRosterMemberAt: replicaAsOf is required");
  }
  if (!Number.isFinite(maxStalenessMs)) {
    throw new Error("isRosterMemberAt: maxStalenessMs is required");
  }
  if (atTime - replicaAsOf > maxStalenessMs) {
    throw new StaleChainError(
      `isRosterMemberAt: chain replica is ${atTime - replicaAsOf}ms old, policy allows ${maxStalenessMs}ms`,
    );
  }
  const roster = await rosterAsOf(groupIdHash, atTime);
  return roster.includes(subject);
}
```

Create `packages/group.core/index.js`:

```js
export * from "./roster.js";
```

Create the package manifest following the existing Projektor convention:
`@projektor/group.core`, private ESM, main/export `./index.js`.

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

### Task 3: Define Projektor's Membership Claim And Validity Semantics

The only genuinely new evidence type. It states: *the issuer certifies that this
person was in this exact roster, for this window, with or without the right to
re-share the definition.* It pins `HashGroup`, so it can never be read as an
open-ended present-tense grant.

**Files:**
- Create: `packages/trust.projektor/membership.js`
- Create: `packages/trust.projektor/membership.test.js`
- Create: `packages/trust.projektor/index.js`
- Create: `packages/trust.projektor/package.json`
- Create: `packages/trust.projektor/@OneObjectInterfaces.d.ts`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `HashGroup` hashes from Task 1.
- Produces:
  - `GROUP_MEMBERSHIP_CERTIFICATE_TYPE`, `GroupMembershipLicense`, `GroupMembershipCertificateRecipe`, `GroupMembershipCertificateReverseMap`, `GroupMembershipRecipes`
  - `createGroupMembershipCertificateData({group, hashGroup, person, mayReshare, issuedAt, validFrom, validUntil}) -> object` — the `certData` argument to trust.core `attest`, without `$type$` or `license`
  - `isMembershipValidAt(certificate, atTime) -> boolean`
  - `effectiveMembershipWindow(certificates) -> {validFrom, validUntil}` — the narrowest window across one lineage
  - `revokeMembershipCertificate(previous, {revokedAt, learnedAt, reason, endAt}) -> object`

**Why the factory does not build the finished object.**
The trust.core attestation boundary built in Task 4 stores the License, builds
`{$type$: type, ...certData, license}` and authors the signed attestation with
exact issuer provenance. A factory that also emitted `$type$` and `license`
would supply fields the attestation service owns. These factories therefore
validate and shape `certData`; trust.core owns the attested envelope.

**Why a combining rule is required.** one.models certificates are unversioned, so
revocation is a second certificate carrying an earlier `validUntil` — and the
original still exists and still verifies. A consumer that accepts *any* valid
certificate would keep accepting the original, and revocation would do nothing.
Effective validity is therefore the **narrowest** window across all certificates
from the same issuer, for the same person and group, sharing the same
`validFrom`. Narrowing takes effect; nothing widens. A renewal is a new lineage
with a later `validFrom`, evaluated on its own.

- [ ] **Step 1: Write the failing test**

Create `packages/trust.projektor/membership.test.js`:

```js
import assert from "node:assert/strict";
import {
  GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  ProjektorTrustRecipes,
  GroupMembershipCertificateReverseMap,
  createGroupMembershipCertificateData,
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

// trust.core attestation adds $type$ and license, so the factory must not.
const certData = createGroupMembershipCertificateData({
  group: GROUP,
  hashGroup: ROSTER,
  person: PERSON,
  mayReshare: true,
  validFrom: JAN,
  validUntil: DEC,
});
assert.equal("$type$" in certData, false);
assert.equal("license" in certData, false);
assert.equal("signature" in certData, false);

// The stored shape, as trust.core attest would write it. Validity helpers read this.
const cert = {
  $type$: GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  ...certData,
  license: "3".repeat(64),
};

// The certificate pins the exact roster, so it can never mean "is in the group now".
assert.equal(cert.hashGroup, ROSTER);

assert.equal(isMembershipValidAt(cert, FEB), true);
assert.equal(isMembershipValidAt(cert, Date.UTC(2027, 5, 1)), false);

// Revocation ends authority at issuance, never before.
const revocationData = revokeMembershipCertificate(cert, {
  revokedAt: MAR,
  learnedAt: FEB,
  reason: "Left the partner office",
});
assert.equal("$type$" in revocationData, false, "revocation is certData too");
assert.equal("license" in revocationData, false);

const revoked = { $type$: GROUP_MEMBERSHIP_CERTIFICATE_TYPE, ...revocationData };
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
    createGroupMembershipCertificateData({
      group: GROUP,
      hashGroup: ROSTER,
      person: PERSON,
      validFrom: DEC,
      validUntil: JAN,
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
const renewal = {
  $type$: GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  ...createGroupMembershipCertificateData({
    group: GROUP,
    hashGroup: ROSTER,
    person: PERSON,
    validFrom: Date.UTC(2027, 0, 1),
    validUntil: Date.UTC(2027, 11, 1),
  }),
};
assert.throws(
  () => effectiveMembershipWindow([cert, renewal]),
  /one lineage/,
);

const recipe = ProjektorTrustRecipes.find(
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

// Typed lookup requires the exact indexed reverse-map property.
assert.equal(GroupMembershipCertificateReverseMap[0], GROUP_MEMBERSHIP_CERTIFICATE_TYPE);
assert.deepEqual(
  [...GroupMembershipCertificateReverseMap[1]],
  ["group"],
  "lookup is informed by the exact indexed property",
);

console.log("trust.projektor membership tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/trust.projektor/membership.test.js`
Expected: FAIL with `does not provide an export named 'createGroupMembershipCertificateData'`.

- [ ] **Step 3: Write the certificates module**

Create `packages/trust.projektor/membership.js`:

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

// Typed trust.core lookup is by the group reference. Index that property only;
// do not enumerate all reference properties through a wildcard reverse map.
export const GroupMembershipCertificateReverseMap = [
  GROUP_MEMBERSHIP_CERTIFICATE_TYPE,
  new Set(["group"]),
];

export const GroupMembershipRecipes = [GroupMembershipCertificateRecipe];

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

/**
 * Build and validate the `certData` for a membership certificate.
 *
 * `$type$` and `license` are deliberately absent: the trust.core attestation
 * service adds both, and emitting them here would duplicate its envelope.
 */
export function createGroupMembershipCertificateData({
  group,
  hashGroup,
  person,
  mayReshare = false,
  validFrom,
  validUntil,
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
    group: required(group, "group"),
    hashGroup: required(hashGroup, "hashGroup"),
    person: required(person, "person"),
    mayReshare,
    validFrom: from,
    validUntil: until,
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
  // Strip the fields trust.core attest owns, so the result is certData like any other.
  const { $type$: _type, license: _license, ...carried } = previous;
  const revocation = {
    ...carried,
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

Create `packages/trust.projektor/index.js` with the aggregate lists that later
tasks extend:

```js
import {
  GroupMembershipCertificateRecipe,
  GroupMembershipCertificateReverseMap,
} from "./membership.js";

export * from "./membership.js";

export const ProjektorTrustRecipes = [GroupMembershipCertificateRecipe];
export const ProjektorTrustReverseMaps = [GroupMembershipCertificateReverseMap];
```

Create the package manifest as `@projektor/trust.projektor`, private ESM with
main/export `./index.js` and types `./@OneObjectInterfaces.d.ts`, following the
existing `@projektor/*.core` manifests.
Declare the membership claim in `OneUnversionedObjectInterfaces`; later tasks
extend this file for bundles and versioned status/projection objects. Use branded
`SHA256IdHash`/`SHA256Hash` fields rather than plain strings in declarations.

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/trust.projektor/membership.test.js`
Expected: PASS, prints `trust.projektor membership tests passed`.

- [ ] **Step 6: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/trust.projektor/membership.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/trust.projektor package.json
git commit -m "Define Projektor membership trust claims"
```

---

### Task 4: Put Typed Attestation At The trust.core Boundary

This task corrects the package boundary before Projektor authorization is built.
Typed certificate lookup, attestation/signing, and trusted signer-key
verification are trust semantics. They belong to `trust.core`, not to
`trust.projektor` and not to an ad hoc `LeuteModel` created by a package test.

Raw mechanisms remain below that boundary:

- ONE.core stores objects and maintains explicit reverse maps.
- ONE.core/one.models provides detached-signature and keychain primitives.
- `trust.core` turns those mechanisms into typed, verified attestation evidence.
- `group.core` supplies structural roster facts.
- `trust.projektor` decides whether verified evidence authorizes a Projektor
  operation and persists the domain bundle/status/projection.

The existing `trust.core` pieces are inputs, not substitutes for the missing
service:

- `findExplicitlyVerifiedSignature` proves an exact signature/key match.
- `IssuerKeyVerifier` and `EffectiveIssuerKeyProvider` prove issuer-key
  authority and retain exact chain/root provenance.
- The existing `GroupAttestation` recipe is legacy: it duplicates a member
  array, uses a bare group string and carries issuer inline. Do not reuse it as
  a second group model. Deprecate it separately or migrate it to the
  `Group`/`HashGroup` model.

#### Task 4A: Add the narrow service to trust.core

**Repository:** `/Users/gecko/src/one`

**Files:**
- Create: `packages/trust.core/src/services/TypedAttestationService.ts`
- Create: `packages/trust.core/src/services/TypedAttestationService.test.ts`
- Modify: `packages/trust.core/src/services/index.ts`
- Port from `/Users/gecko/src/one-experimental`:
  - `packages/assembly.core/src/modules/AssemblyModule.ts`
  - `packages/assembly.core/src/services/CertificateAssemblyAdapter.ts`
  - their module/service barrel exports
  - the required `CertificateAssemblyAdapter` demand and disposal path in
    `packages/trust.core/src/modules/IssuerKeyLifecycleModule.ts`
- Modify the owning trust module if the facade is supplied through
  ModuleRegistry.

The Assembly wiring is a prerequisite, not optional cleanup. The canonical
[trust architecture](/Users/gecko/src/one/packages/trust.core/ARCHITECTURE.md)
identifies the missing adapter demand/registration/disposal as a concrete
runtime defect. Port that validated path before putting another facade over the
lifecycle provider.

**Produces:** a typed attestation service with three responsibilities:

- `attest({type, certData, issuer, purpose, assertedAt})` stores the License,
  builds the typed claim, signs the exact claim and returns an exact authorship
  value containing the claim, signature, `Keys`, issuer-key bundle and any
  applicable Assembly occurrence hashes;
- `findByType({subject, type})` performs one informed lookup for one configured
  type and reverse-map property;
- `verify({receiver, claimHash, signatureHash, signingKeysHash,
  issuerKeyBundleHashes, expectedIssuer, purpose, authorityMode, atTime,
  assemblyOccurrence})` returns
  `verified`, `pending-authority` or `rejected` with exact lifecycle
  provenance. `authorityMode` is explicitly `evidence-time` or `current`.

The names may change to match local trust.core style; the semantics may not.

`receiver` is the local Person whose root selection and effective issuer-key
heads are being consulted. This cannot be implicit: issuer authority is
receiver-local, so omitting it would make the same call silently depend on an
unidentified trust view.

The service is constructed with an immutable map of attestation definitions.
Each definition names one type, its License and the one reverse-map property
used for lookup. `findByType` rejects an unknown type instead of enumerating the
instance's enabled types; `attest` rejects data whose type is not defined. This
is explicit dependency configuration, not a mutable process-global registry.

The facade returns exact authorship evidence but does **not** invent a generic
persisted bundle, receiver-local status or effective projection. Section 10 of
the trust architecture assigns those schemas to the semantic claim owner.
Task 4B therefore persists the group-owned bundle/status/projection. The facade
must not add `TypedAttestationEvidence`, reuse `CertificateRegistry`, or turn
legacy `GroupAttestation` into a generic container.

**Constraints:**

- `findByType` performs one informed lookup for one requested type. It does not
  enumerate enabled certificate types.
- Each attestation recipe declares the precise reverse-map property used by its
  query. The service does not require `new Set(["*"])`.
- `verify` returns structured state and exact provenance. It never reduces
  authority to a context-free `trusted: boolean`.
- `verify` checks that every supplied signature, key, bundle and occurrence
  names the exact claim/issuer/purpose. Missing recursively referenced evidence
  fails hard and stores no status. Complete evidence with an unselected root is
  `pending-authority`; malformed or unauthorized evidence is `rejected` with a
  stable reason.
- Bundle construction rejects missing evidence and unrelated extra evidence.
  Do not accept an open-ended bag of plausible certificates or keys.
- `attest` requires an explicit issuer and a configured type definition with a
  License. It never derives an issuer from `leute.me()` or the current instance
  by default.
- The service does not import or construct `LeuteModel` or
  `TrustedKeysManager`.
- If issuer credential material is supplied by an authenticated identity graph,
  it enters through a narrow trust.core demand such as
  `EffectiveIssuerKeyProvider`; the graph itself stays outside the service.
- Public callable operations belong in one trust.core OperationRegistry domain;
  in-process dependencies are ModuleRegistry supplies/demands.
- `IssuerKeyLifecycleModule` must require the Assembly adapter, register it
  before lifecycle initialization, and dispose the registration on init failure
  and shutdown. Do not add manual application registration.
- Return producer-owned provenance at authorship so the domain can persist it
  immediately. Do not reconstruct issuer evidence later with a scan.

- [ ] **Step 1: Port and test the Assembly ModuleRegistry wiring**

Port the exact validated demand/supply path named above. Tests must prove that
initialization fails without `CertificateAssemblyAdapter`, registration occurs
before issuer-key lifecycle init, and the disposer runs on failure and
shutdown. Preserve `PostStoreImportBatch` as a required ordering boundary.

- [ ] **Step 2: Write failing facade tests**

Cover:

1. typed lookup requests exactly one object type;
2. an unrelated certificate type is never read;
3. a signature with a matching but unauthorized key is rejected;
4. verified output contains exact claim, signature, signing-key, issuer-bundle,
   root-selection/status and occurrence references;
5. missing or conflicting issuer authority is distinguishable from invalid
   signature;
6. `evidence-time` and `current` verification produce distinct results when a
   once-authorized key is no longer current;
7. issuance refuses an omitted issuer;
8. evidence that names a different claim is rejected;
9. an unknown/unconfigured type is rejected rather than discovered by a scan;
10. missing evidence fails hard without a partial status;
11. unrelated extra evidence is rejected;
12. no Leute/contact model is constructed.

- [ ] **Step 3: Implement the facade from existing trust.core owners**

Compose existing explicit signature verification and effective issuer-key
evidence. Use the supplied Assembly adapter for applicable versioned evidence.
Do not copy their algorithms or create a second issuer-key head.

- [ ] **Step 4: Export and, where needed, supply the service**

Export the service from `services/index.ts`. If a runtime-owned instance is
required, add one ModuleRegistry supply and narrow demands for its
storage/signing, `EffectiveIssuerKeyProvider` and Assembly adapter. Do not
demand `LeuteModel` from the facade.

- [ ] **Step 5: Run assembly.core and trust.core tests**

Run from `/Users/gecko/src/one/packages/assembly.core`:

```bash
pnpm test -- src/modules/AssemblyModule.test.ts
pnpm build
```

Then from `/Users/gecko/src/one/packages/trust.core`:

```bash
pnpm test -- src/__tests__/issuer-key-lifecycle.test.ts src/services/TypedAttestationService.test.ts
pnpm build
```

Then run `pnpm test` for the full trust.core suite. The package's actual scripts
are `vitest run` and `tsc`; no guessed workspace command is needed.

- [ ] **Step 6: Commit in the one repository**

```bash
git add packages/assembly.core packages/trust.core
git commit -m "Consolidate exact attestation verification in trust core"
```

Do not continue to Task 4B until this public contract exists in the built
sibling package. Rebuild the sibling package before consuming it from Projektor.

#### Task 4B: Build the trust.projektor evidence reducer

**Repository:** `/Users/gecko/src/projektor`

The canonical trust architecture validates a three-object boundary: immutable
bundle, receiver-local status and versioned effective projection. These are
Projektor semantics, so `trust.projektor` owns them. `trust.core` supplies exact
authorship/issuer-key verification; `group.core` supplies roster history.

**Files:**
- Create: `packages/trust.projektor/evidence.js`
- Create: `packages/trust.projektor/membership-model.js`
- Create: `packages/trust.projektor/issuance.js`
- Create: `packages/trust.projektor/issuance.test.js`
- Modify: `packages/trust.projektor/membership.js`
- Modify: `packages/trust.projektor/@OneObjectInterfaces.d.ts`
- Modify: `packages/trust.projektor/index.js`
- Modify: `package.json`

**Domain-owned ONE objects:**

1. `GroupMembershipAttestationBundle` — immutable. It references one exact
   `GroupMembershipCertificate`, detached `Signature`, signing `Keys`, the
   complete issuer-key bundle set, purpose and authorship time. The bundle
   rejects missing and unrelated extra evidence.
2. `GroupMembershipBundleStatus` — versioned and receiver-local, stably
   identified by `{receiver, bundle}`. It records `verified`,
   `pending-authority` or `rejected`, a stable reason, and every exact trust.core
   result/root/status hash used. Missing graph children fail import and do not
   create a partial status.
3. `EffectiveGroupMembership` — versioned and receiver-local, stably identified
   by `{receiver, group, hashGroup, person, validFrom}`. It records
   `current`, `non-current` or `conflicted`, the narrowest `validUntil`, the most
   restrictive `mayReshare`, and exact source bundle/status versions.

`GroupDisclosureCertificate` and its immutable
`GroupDisclosureAttestationBundle` are also owned here. A disclosure bundle
references its exact authorship evidence plus every membership bundle/status/
effective-projection version that authorized it. A disclosure is historical
evidence; it does not need a current effective projection of its own.

Every interface and recipe uses branded ids conceptually:
`referenceToId` for `Group`/`Person` and receiver identity, `referenceToObj` for
exact claims, `HashGroup`, signatures, keys, bundles, statuses and projection
versions. The JS implementation still validates every hash and fails fast.
Ambient declarations place immutable claims/bundles in
`OneUnversionedObjectInterfaces` and receiver-local statuses/projections in
`OneVersionedObjectInterfaces`; `$type$`, `$version$`, optional fields and
recipe order must agree exactly.

**Interfaces:**

- `issueMembership(attestations, params) -> {claimHash, bundleHash}`;
- `importMembershipBundle(attestations, bundleHash) -> statusHash`;
- `getEffectiveMembership({receiver, groupIdHash, hashGroup, person, validFrom})`;
- `authorizeDisclosure({receiver, groupIdHash, hashGroup, sharer, atTime})`;
- `discloseGroup({receiver, groupIdHash, hashGroup, recipient, sharer, atTime})`;
- `verifyDisclosure(disclosureBundleHash, atTime)`.

The reducer consumes committed bundle statuses and exact provider-change events.
It does not re-enumerate all certificates during each authorization call, scan
on startup, or rebuild provenance from current keys. Restart restores bounded
state from the committed effective projection heads.

**Admission rules:**

1. Load `Group` by `groupIdHash` and require an explicit `owner`. Ownerless
   legacy groups fail closed.
2. Derive the expected issuer from `Group.owner`. No public operation accepts a
   caller-selected group issuer.
3. Find claims by exact type and the `group` reverse map, then find their bundle
   roots through the bundle's exact `claim` reverse map. Bare claim/signature/key
   support nodes are inert until the bundle root is selected.
4. Require exact `group`, `hashGroup` and `person` equality before reduction.
5. Verify each complete bundle through trust.core for purpose
   `group-membership` and the named authority mode/time.
6. Never combine different `{group, hashGroup, person, owner, validFrom}`
   lineages. Within one lineage, the narrowest window and most restrictive
   `mayReshare` win.
7. Preserve competing authenticated heads as `conflicted`; arrival order never
   chooses a winner.
8. A disclosure names the exact `HashGroup` and complete authorizing projection
   provenance. A valid detached signature alone is insufficient.

The authority times are explicit: issuance requires the issuer key to be
`current` at `assertedAt`; importing or re-verifying an existing membership
bundle uses `evidence-time` at its authored time. Disclosure authorization then
evaluates the membership projection and roster at the requested action time. It
does not silently replace historical key authority with today's key state.

**Reverse maps:**

- membership claims: `new Set(["group"])`;
- membership bundles: `new Set(["claim"])`;
- bundle statuses: only the exact `bundle`/receiver-owner lookup fields used;
- effective memberships: only their stable lookup refs;
- disclosures/bundles: only the exact query refs used by verification.

No wildcard reverse map or package-wide certificate enumeration is permitted.
Export `ProjektorTrustRecipes` and `ProjektorTrustReverseMaps`; the runtime must
compose the complete one.models defaults plus these aggregates before instance
creation. Merge duplicate reverse-map entries by union, never last-write-wins.
Also export `ProjektorTrustGraphTypes` as graph vocabulary only. It states which
support types are reachable from Projektor bundle/projection roots; it does not
choose recipients, create `Access`, or treat transport reachability as trust.

- [ ] **Step 1: Write the claim/bundle/status/projection recipe tests**

Test creator validation, ambient runtime registration, correct versioned versus
unversioned storage, exact reference types and exact reverse-map properties.

- [ ] **Step 2: Write the reducer contract test**

Use a precise fake trust.core facade. Cover:

- group A or roster H1 evidence cannot authorize group B or H2;
- a cryptographically valid non-owner signer is rejected by Projektor policy;
- rejected issuer-key authority cannot authorize;
- incomplete graph stores no status;
- complete evidence with an unselected root stores `pending-authority` and only
  that exact status is re-driven when the root becomes selected;
- expired/revoked lineages and any `mayReshare: false` deny;
- different roster/renewal lineages remain independent;
- authenticated conflicts remain conflicted;
- support-node arrival is inert until bundle selection;
- an existing selected-root handler is composed and runs before the Projektor
  reducer, never replaced by generic `onImported` handling;
- restart restores the effective head without a scan;
- disclosure stores every exact source ref and bypass issuance is rejected.

- [ ] **Step 3: Implement feed-forward issuance, import and reduction**

Persist the bundle immediately from the exact authorship value returned by
trust.core. Import the same immutable bundle through the same verifier used for
remote evidence. Serialize updates per stable membership lineage, not through a
global trust queue.

- [ ] **Step 4: Register the recipes and runtime service**

Supply a narrow `ProjektorTrustProvider` through ModuleRegistry if the Projektor
runtime uses the module graph. Keep public operations in one canonical
`trust.projektor` OperationRegistry domain.

- [ ] **Step 5: Run focused and full Projektor tests**

Run the membership and issuance tests, then `npm test`.

- [ ] **Step 6: Commit in the Projektor repository**

```bash
git add packages/trust.projektor package.json
git commit -m "Reduce Projektor group trust from exact evidence"
```

---

### Task 5: Cross-Package Acceptance Through trust.projektor

This task proves the real boundary. It is not permission to bootstrap an
application model graph inside `group.core` or `trust.projektor`.

**Files:**
- Create: `packages/trust.projektor/end-to-end.test.js`
- Modify: `package.json`

**Test topology:**

```
ONE.core storage and crypto
          |
trust.core typed attestation service
          |
trust.projektor evidence reducer
          |
group.core roster history
```

Use the real trust.core service from Task 4A with deterministic test issuer
authority established through trust.core's sanctioned issuer-key test fixtures.
Do not construct `LeuteModel`, `TrustedKeysManager`, `ChannelManager`,
`TopicModel` or `IoMManager`.

Initialize ONE once with the complete one.models recipe/reverse-map aggregates
plus `ProjektorTrustRecipes`/`ProjektorTrustReverseMaps`. Supplying custom
recipes replaces the MultiUser defaults, so the aggregate must be complete.
This is explicit startup configuration, not wildcard discovery.

The test must:

1. create or load an owner-scoped `Group` through the owning GroupModel API;
2. add a member and finish `saveAndLoad()`;
3. issue and import a membership bundle for that exact `HashGroup`;
4. prove its receiver-local status and effective projection, then authorize and
   store a disclosure bundle of that same roster;
5. remove the member through GroupModel and finish `saveAndLoad()`;
6. issue the prospective revocation evidence;
7. prove `rosterAsOf(before)` and evidence-time disclosure verification still
   succeed;
8. prove `isRosterMemberAt(now)` and new disclosure authorization fail;
9. prove an alternate trusted signer cannot substitute for `Group.owner`;
10. prove changing only the requested `hashGroup` fails.

Use the real Assembly adapter and issuer-key provider wiring ported in Task 4A.
If the facade itself cannot be initialized without an authenticated contact
graph, treat that as a trust.core boundary defect and repair the narrow provider
contract. Do not restore `new LeuteModel("wss://dummy")`.

- [ ] **Step 1: Write the failing cross-package test**
- [ ] **Step 2: Run it and fix the owning layer for each failure**
- [ ] **Step 3: Register it in `package.json`**
- [ ] **Step 4: Run `npm test`**
- [ ] **Step 5: Commit**

```bash
git add packages/group.core packages/trust.projektor package.json
git commit -m "Prove Projektor trust through the core boundary"
```

**Deferred runtime adapter test.** When Projektor owns an
`AuthenticatedModelGraph`, add one integration test proving that the runtime
supplies identity/key material to trust.core and supplies trust.core plus
group.core to `trust.projektor`. That test belongs to the Projektor runtime, not
to either product package.

---

### Task 6: Project Access Assertions, Living And Pinned

This type keeps its `Project` prefix because it is the one thing here that is
genuinely project-scoped.

**Files:**
- Create: `packages/trust.projektor/project-access.js`
- Create: `packages/trust.projektor/project-access.test.js`
- Modify: `packages/trust.projektor/index.js`
- Modify: `packages/trust.projektor/@OneObjectInterfaces.d.ts`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Consumes: `rosterAsOf` from Task 2, `getObject` from one.core.
- Produces:
  - `PROJECT_ACCESS_ASSERTION_TYPE`, `ProjectAccessLicense`, `ProjectAccessAssertionRecipe`
  - `createProjectAccessAssertionData({group, hashGroup, binding, record, projectId, grantedAt}) -> object` — certData only
  - `resolveGrantAudience(assertion, atTime) -> Promise<string[]>`

This task only shapes the project-grant claim and resolves its group audience;
it does not issue or admit a grant. When `trust.role`/an
`EffectiveRoleProvider` is available, `trust.projektor` must add the claim's
immutable bundle/status and retain the exact role projection alongside
trust.core issuer-key evidence. Until then, a stored or signed assertion must
not be reported as an authorized project grant. A valid signing key is not
evidence of a project role.

- [ ] **Step 1: Write the failing test**

Create `packages/trust.projektor/project-access.test.js`:

```js
import assert from "node:assert/strict";
import {
  PROJECT_ACCESS_ASSERTION_TYPE,
  ProjectAccessAssertionReverseMap,
  createProjectAccessAssertionData,
} from "./index.js";

const FEB = Date.UTC(2026, 1, 1);
const GROUP = "a".repeat(64);
const ROSTER = "1".repeat(64);

const living = createProjectAccessAssertionData({
  group: GROUP,
  binding: "living",
  record: "record:lp3-kostenschaetzung",
  projectId: "demo-kita-2028",
  grantedAt: FEB,
});
assert.equal("$type$" in living, false);
assert.equal("license" in living, false);
assert.equal("signature" in living, false);
assert.equal(living.binding, "living");
assert.equal(living.hashGroup, undefined, "a living grant pins no roster");

const pinned = createProjectAccessAssertionData({
  group: GROUP,
  hashGroup: ROSTER,
  binding: "pinned",
  record: "record:lp3-vergabeentscheidung",
  projectId: "demo-kita-2028",
  grantedAt: FEB,
});
// The pinned audience is the HashGroup itself. There is no separate member list
// that could disagree with it.
assert.equal(pinned.hashGroup, ROSTER);
assert.equal("pinnedSubjects" in pinned, false);

assert.throws(
  () =>
    createProjectAccessAssertionData({
      group: GROUP,
      binding: "pinned",
      record: "record:x",
      projectId: "demo-kita-2028",
      grantedAt: FEB,
    }),
  /pinned grant requires hashGroup/,
);

assert.throws(
  () =>
    createProjectAccessAssertionData({
      group: GROUP,
      binding: "whatever",
      record: "record:x",
      projectId: "demo-kita-2028",
      grantedAt: FEB,
    }),
  /binding must be "living" or "pinned"/,
);

assert.equal(ProjectAccessAssertionReverseMap[0], PROJECT_ACCESS_ASSERTION_TYPE);
assert.deepEqual([...ProjectAccessAssertionReverseMap[1]], ["group"]);

console.log("trust.projektor project-access tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/trust.projektor/project-access.test.js`
Expected: FAIL with `does not provide an export named 'createProjectAccessAssertionData'`.

- [ ] **Step 3: Write the grants module**

Create `packages/trust.projektor/project-access.js`:

```js
import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { rosterAsOf } from "../group.core/index.js";

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

export const ProjectAccessAssertionReverseMap = [
  PROJECT_ACCESS_ASSERTION_TYPE,
  new Set(["group"]),
];

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`ProjectAccessAssertion: ${field} is required`);
  }
  return value.trim();
}

export function createProjectAccessAssertionData({
  group,
  hashGroup,
  binding,
  record,
  projectId,
  grantedAt,
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
    group: requiredText(group, "group"),
    binding,
    record: requiredText(record, "record"),
    projectId: requiredText(projectId, "projectId"),
    grantedAt,
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

In `packages/trust.projektor/index.js`, add
`export * from "./project-access.js";`, add
`ProjectAccessAssertionRecipe` to `ProjektorTrustRecipes`, and add
`ProjectAccessAssertionReverseMap` to `ProjektorTrustReverseMaps`. Export that
reverse map from `project-access.js` as
`[PROJECT_ACCESS_ASSERTION_TYPE, new Set(["group"])]`. Configure the Task 4
trust.core service with the exact type, recipe, reverse-map property and
`ProjectAccessLicense`; do not introduce a package-global certificate registry
or wildcard lookup.

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/trust.projektor/project-access.test.js`
Expected: PASS, prints `trust.projektor project-access tests passed`.

- [ ] **Step 6: Add the live audience case**

Extend `packages/trust.projektor/project-access.test.js` with a real group
fixture: after the second Group version is stored, build one living and one
pinned certData value over the first roster, wrap each as the typed stored shape
that trust.core authors, and
assert that `resolveGrantAudience` gives `[]` for the living grant at `afterV2`
while the pinned grant still gives `[owner]`.

Run: `node ./packages/trust.projektor/project-access.test.js`
Expected: PASS.

- [ ] **Step 7: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/trust.projektor/project-access.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/trust.projektor package.json
git commit -m "Bind project access grants as living or pinned"
```

---

### Task 7: Projektor Evidence Dispute Claims

**Files:**
- Create: `packages/trust.projektor/disputes.js`
- Create: `packages/trust.projektor/disputes.test.js`
- Modify: `packages/trust.projektor/index.js`
- Modify: `packages/trust.projektor/@OneObjectInterfaces.d.ts`
- Modify: `package.json` (the `test` script)

**Interfaces:**
- Produces:
  - `PROJEKTOR_EVIDENCE_DISPUTE_TYPE`, `ProjektorEvidenceDisputeLicense`, `ProjektorEvidenceDisputeRecipe`
  - `createProjektorEvidenceDisputeData({person, compromisedSince, claimedAt, reason}) -> object` — certData only
  - `markDisputedAssertions(claim, assertions) -> Array<{assertion, disputed}>`, each input assertion `{person, assertedAt}`

This is explicitly a Projektor-domain dispute signal, not a second issuer-key
lifecycle. It never changes trust.core effective heads or rewrites historical
issuer-key verification. trust.core proves authorship; `trust.projektor` may
mark its own assertions disputed only after a future dispute-authority policy
admits the issuer. This task defines the claim and pure presentation rule, not
that missing authority policy.

- [ ] **Step 1: Write the failing test**

Create `packages/trust.projektor/disputes.test.js`:

```js
import assert from "node:assert/strict";
import {
  PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
  ProjektorEvidenceDisputeReverseMap,
  createProjektorEvidenceDisputeData,
  markDisputedAssertions,
} from "./index.js";

const JAN = Date.UTC(2026, 0, 1);
const FEB = Date.UTC(2026, 1, 1);
const MAR = Date.UTC(2026, 2, 1);
const ANNA = "2".repeat(64);
const BEN = "4".repeat(64);

const claimData = createProjektorEvidenceDisputeData({
  person: ANNA,
  compromisedSince: FEB,
  claimedAt: MAR,
  reason: "Laptop stolen, reported in March",
});

assert.equal("$type$" in claimData, false);
assert.equal("license" in claimData, false);
assert.equal("signature" in claimData, false);
const claim = {$type$: PROJEKTOR_EVIDENCE_DISPUTE_TYPE, ...claimData};

assert.equal(claim.$type$, PROJEKTOR_EVIDENCE_DISPUTE_TYPE);
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
    createProjektorEvidenceDisputeData({
      person: ANNA,
      compromisedSince: MAR,
      claimedAt: FEB,
      reason: "impossible",
    }),
  /compromisedSince must not be after claimedAt/,
);

assert.equal(ProjektorEvidenceDisputeReverseMap[0], PROJEKTOR_EVIDENCE_DISPUTE_TYPE);
assert.deepEqual([...ProjektorEvidenceDisputeReverseMap[1]], ["person"]);

console.log("trust.projektor dispute tests passed");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ./packages/trust.projektor/disputes.test.js`
Expected: FAIL with `does not provide an export named 'createProjektorEvidenceDisputeData'`.

- [ ] **Step 3: Write the dispute module**

Create `packages/trust.projektor/disputes.js`:

```js
export const PROJEKTOR_EVIDENCE_DISPUTE_TYPE = "ProjektorEvidenceDispute";

export const ProjektorEvidenceDisputeLicense = {
  $type$: "License",
  name: "ProjektorEvidenceDispute",
  description:
    "The [signature.issuer] claims that the keys of [person] were compromised from [compromisedSince], stated at [claimedAt]. This disputes assertions made by [person] in that window. It does not invalidate them and does not alter any certificate.",
};

export const ProjektorEvidenceDisputeRecipe = {
  $type$: "Recipe",
  name: PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
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

export const ProjektorEvidenceDisputeReverseMap = [
  PROJEKTOR_EVIDENCE_DISPUTE_TYPE,
  new Set(["person"]),
];

/**
 * Records a Projektor-domain assertion that a person's keys were compromised
 * from an earlier time.
 *
 * This is how a retroactive trust change is expressed. It never rewrites a
 * certificate's validity window: assertions in the window become disputed so a
 * verifier can re-weigh them, rather than disappearing.
 */
export function createProjektorEvidenceDisputeData({
  person,
  compromisedSince,
  claimedAt,
  reason,
} = {}) {
  if (!Number.isFinite(compromisedSince)) {
    throw new Error("ProjektorEvidenceDispute: compromisedSince is required");
  }
  if (!Number.isFinite(claimedAt)) {
    throw new Error("ProjektorEvidenceDispute: claimedAt is required");
  }
  if (compromisedSince > claimedAt) {
    throw new Error("ProjektorEvidenceDispute: compromisedSince must not be after claimedAt");
  }
  if (!person) {
    throw new Error("ProjektorEvidenceDispute: person is required");
  }
  if (typeof reason !== "string" || reason.trim() === "") {
    throw new Error("ProjektorEvidenceDispute: reason is required");
  }
  return {
    person,
    compromisedSince,
    claimedAt,
    reason: reason.trim(),
  };
}

export function markDisputedAssertions(claim, assertions) {
  if (!claim || claim.$type$ !== PROJEKTOR_EVIDENCE_DISPUTE_TYPE) {
    throw new Error("markDisputedAssertions: claim must be a ProjektorEvidenceDispute");
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

In `packages/trust.projektor/index.js`, add `export * from "./disputes.js";`, add
`ProjektorEvidenceDisputeRecipe` to `ProjektorTrustRecipes`, and add
`ProjektorEvidenceDisputeReverseMap` to `ProjektorTrustReverseMaps`. Configure
the Task 4 trust.core facade with the exact type, recipe, reverse-map property
and `ProjektorEvidenceDisputeLicense`; do not add a wildcard lookup or local
trust manager.

- [ ] **Step 5: Run test to verify it passes**

Run: `node ./packages/trust.projektor/disputes.test.js`
Expected: PASS, prints `trust.projektor dispute tests passed`.

- [ ] **Step 6: Register the test in package.json**

In `package.json`, append to the `test` script:

```
 && node ./packages/trust.projektor/disputes.test.js
```

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/trust.projektor package.json
git commit -m "Express Projektor evidence disputes separately"
```

---

### Task 8: Document The Package And Amend The Spec

**Files:**
- Create: `packages/group.core/README.md`
- Create: `packages/trust.projektor/README.md`
- Modify: `README.md` (the `../one` Reuse Rule section)
- Modify: `docs/superpowers/specs/2026-08-31-group-sharing-design.md`

- [ ] **Step 1: Write both package READMEs**

Create `packages/group.core/README.md`:

````markdown
# group.core

Structural group semantics over ONE.core `Group` and `HashGroup`: roster history,
`rosterAsOf`, `isRosterMemberAt`, freshness and concurrent-version failure. This package
does not issue or verify trust evidence.

## Reused, not rebuilt

| Concern | Type | Where |
|---|---|---|
| Group identity | `Group` — versioned, id `{name, owner}` | one.core |
| The roster, and its pin | `HashGroup` — content-addressed member set | one.core |
| Roster history and ordering | the `Group` version DAG | `getVersionsNodes` |
| Access enforcement | `Access` / `IdAccess` roots | one.core |

`HashGroup`'s content hash *is* the roster pin. There is no snapshot type and no
member list carried alongside a hash that could disagree with it.

## Two questions, two functions

```js
rosterAsOf(groupIdHash, atTime);
isRosterMemberAt({ groupIdHash, subject, atTime, replicaAsOf, maxStalenessMs });
```

There is deliberately no `getMembers(group)` or structural `mayAct`.
`isRosterMemberAt` throws `StaleChainError`
when the replica is older than the freshness policy allows, so a stale chain is
never read as a deny. `rosterAsOf` throws `ConcurrentVersionsError` when the
version in force at a time is genuinely ambiguous, rather than picking one.

There is no `LeuteModel`, `TrustedKeysManager`, certificate lookup or key
verification dependency here.
````

Create `packages/trust.projektor/README.md`:

````markdown
# trust.projektor

Projektor's semantic trust package. It consumes `group.core` roster history and
the narrow `trust.core` facade.

| Concern | Owner |
|---|---|
| Storage, hashes, recipes, access | one.core |
| Identity/contact runtime and low-level signing machinery | one.models |
| Assembly occurrences and causal authorship | assembly.core |
| Typed authorship and issuer-key verification | trust.core |
| Group/roster history | group.core |
| Membership, disclosure, project-grant and dispute claim semantics | trust.projektor |

`trust.projektor` owns the immutable domain bundle, receiver-local status and
versioned effective projection. It retains exact claim, signature, `Keys`,
issuer-key bundle, root/status and domain-policy evidence. It never reduces
trust to a boolean or reconstructs provenance with a scan.

## Why a membership claim cannot go stale

It pins a `HashGroup`, so it proves "was in this roster", never "is in the group
now". The authoritative present-tense record is the `Group` version DAG. An old
membership claim is not a security hole; it is a true statement about the past.

## Revocation

A superseding certificate ends the window at `revokedAt` — never earlier, not
even at the time the issuer learned of the trust change, which is recorded as
`learnedAt` for accountability and has no effect on validity. Backdating would
destroy good-faith assertions made in the gap without discriminating between
honest and hostile signatures in it.

Revocation ends future authorization and sync. It does not retract delivered
bytes.
````

- [ ] **Step 2: Link the package from the root README**

In `README.md`, in the `../one` Reuse Rule section, add after the
`@refinio/trust.core` bullet:

```markdown
- `packages/group.core` for structural `Group`/`HashGroup` roster history and time-indexed membership queries
- `packages/trust.projektor` for Projektor-owned membership, disclosure, project-grant and dispute claims plus their immutable bundles, receiver-local statuses and effective projections over trust.core evidence
```

- [ ] **Step 3: Amend the spec to the implemented trust boundary**

Replace every direct `LeuteModel`/`TrustedKeysManager` dependency and every
untyped certificate scan in the spec with the Task 4 trust.core service. Record
the separation explicitly: trust.core owns typed lookup, authorship and
issuer-key verification; group.core owns roster history; trust.projektor owns
Projektor bundles/statuses/projections plus `Group.owner`, exact `HashGroup`,
lineage and `mayReshare` admission. Then confirm every type name, function
signature, reverse-map property and rule matches the code that was built.

- [ ] **Step 4: Verify the full suite**

Run: `npm test`
Expected: all tests pass, including group.core spike/roster tests and all
trust.projektor membership, issuance, end-to-end, project-access and dispute
tests.

- [ ] **Step 5: Commit**

```bash
git add packages/group.core/README.md packages/trust.projektor/README.md README.md docs/superpowers/specs
git commit -m "Document Projektor trust ownership and align the spec"
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
- **Public group descriptor publication.** The current `Group` recipe directly
  references its `HashGroup`; ordinary recursive object traversal can therefore
  reveal the roster when the Group is shared. `Access` wiring alone is not a
  demonstrated privacy boundary. Supporting a public descriptor with a private
  roster needs either a separate projection/type or a proven traversal filter,
  followed by an integration test that the descriptor is readable while the
  `HashGroup` and membership attestations are not.
- **CHUM propagation.** Runtime integration must prove the intended evidence
  graph is complete and that no private roster edge is pulled transitively. The
  presence of reverse maps is lookup support, not a synchronization policy.
- **Never-attested versus attested-but-expired issuers.** Belongs to the
  institutional role tier whose effective provider `trust.projektor` consumes.
- **Merge policy for concurrent Group versions.** `rosterAsOf` throws
  `ConcurrentVersionsError` rather than guessing. Deciding the merge rule needs
  the multi-writer story, which this prototype does not have yet.
