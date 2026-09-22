# lab.core Consolidation (Flexibel Lane Architecture) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two forked labs (`amway.lab` + `src/lab`, `ek.lab` + `src/eklab`) with one brand-parameterized `packages/lab.core` and one lane shell. Then move the lane onto Flexibel's lab architecture: one full app instance per role in a same-origin iframe, driven through a PlanRegistry bridge and seeded through real invites.

**Architecture:** Phase 1 folds both labs into `lab.core` behind a `LabBrand` config and keeps today's worker + host-switch engine, so behavior stays the same and both lanes go green on one code path. Phase 2 builds the in-page lane app instance that Flexibel's architecture needs: projektor's current single-instance app is server-backed (`/api/amway/*`), so no browser-local product exists yet for an iframe to load. Phase 3 replaces the worker host with a Flexibel-style shell: sequential iframes, registry bridge, invite seeding, snapshot columns. Phase 4 (separate plan) extracts the lane-shell functions that projektor and `one.flexibel` then share.

**Tech Stack:** TypeScript run directly by `node --test` (type stripping), React 19 + Vite (`projektor.browser`), ONE (`one.core`, `one.models`, `refinio.api` from `../one/packages`), Playwright (`projektor.browser/tests`).

**Reference implementation:** `../heiner/one.flexibel/packages/flexibel.browser/browser-ui/src/lab/` (`transport.ts`, `Lab.tsx`, `theme.ts`, `LabQr.tsx`) and its PRD `../heiner/one.flexibel/docs/flexibel-lab-prd.md`. Read the PRD before Phase 2.

## Global Constraints

- No fallbacks: an unknown brand, a missing env var or a foreign identity throws. No defaulting.
- No artificial delays. Polling is allowed only where Flexibel already bounds it (`callWhenRegistered`, `poll`), with the same 500 ms step and explicit deadlines.
- No dynamic `await import()`.
- Single instance: one ONE instance per realm (worker, iframe, or node worker thread). Never two in one realm.
- **Stored recipe names do not change.** Amway stays `AmwayDepartment…AmwayStockReceipt` and EK stays `EkDepartment…EkStockReceipt`. `shop.amway` and `amway.app` also use the `Amway*` names.
- Never run `git checkout`. Never `pkill -f Electron`.
- Commits: conventional prefix (`refactor(lab):`, `feat(lab):`, `fix(lab):`), no Claude attribution.
- Lane suites run serially: `node --test --test-concurrency=1`, via `packages/ci.core/run-lane-suite.mjs`.

## Before Task 1

The working tree has a large uncommitted change set: `chat-notifications.ts`, `LabDeviceInvite`, join/purchase specs, and the `lab-relay` removal. Phase 1 moves every file that change set touches. **Land or commit that work first**, and confirm `npm run test:amway-lab && npm run test:ek-lab` is green on the result. That green run is the baseline every Phase 1 task is measured against.

## Decisions (confirm before Phase 2)

| # | Decision | Recommendation | Consequence |
|---|---|---|---|
| D1 | Where the lane-shell functions shared with Flexibel live (`callPlan`, `waitForRegistry`, `callWhenRegistered`, `poll`, `observeAppTransitions`, theme cycle, `labAppUrl`, `resolveStorageDirectory`) | Phase 3 ports them into `lab.core/shell/` with a header naming the Flexibel source file. Phase 4 moves them to one package under `lama/packages` (per `src/CLAUDE.md`, shared code lives in lama), and both repos import it. | Temporary duplication across repos, bounded by Phase 4 |
| D2 | Data plane | Adopt Flexibel's: CHUM over a commserver (glue by default, local commserver in tests and dev). Remove the `lab://` host switch. | Lanes are no longer hermetic or offline-capable. The per-column network-partition toggle (`setSwitch`/`setOnline`) goes away, and "Paused" becomes UI-only, as in Flexibel. `lab-mesh.spec.ts`/`ek-mesh.spec.ts` partition assertions are deleted. |
| D3 | Pairing topology | Admin registers each role through an admin-issued invite (Flexibel pattern, `ownerId === invited personId`). The host then pairs the remaining three role↔role pairs with IoP invites. That keeps today's `pairAll` full mesh, so the existing replication assertions (offers, customer-contact scoping, 1:1 chat between any pair) hold unchanged. | Alternative: appointment-chain invites only. Rejected until someone proves offers and customer contacts replicate without a direct link. |
| D4 | Persistence across reloads | Adopt Flexibel's: persistent per-role storage, reuse the pairing when the signed-in owner matches the seed record, and fail loudly on a foreign identity. | Projektor currently boots fresh per load because persisted worker state wedged CHUM (`src/lab/worker.ts:39-46`). If the wedge reproduces on the commserver path, that is a bug to root-cause (systematic-debugging), not a reason to keep fresh directories. |
| D5 | Main-thread cost | Same-origin iframes share one renderer main thread, so four ONE instances do crypto on the UI thread. Boot sequentially (Flexibel found this load-bearing: parallel boot hit `ERR_INSUFFICIENT_RESOURCES`). | Measure boot-to-seeded time in Task 13. If it is more than 2× today's worker lane, raise it before Task 14. |

## Target File Structure

```
packages/lab.core/                     (new; replaces amway.lab + ek.lab)
  package.json
  brand.ts            LabBrand, AMWAY, EK, LAB_BRANDS, brandById          [P1]
  recipes.ts          createLabRecipes(brand), createLabObjects(brand)     [P1]
  projection.ts       createProjection(brand)                              [P1]
  lab-plan.ts         createLabPlan({ brand, … })                          [P1]
  chat-plan.ts        createChatPlan({ brand, … })                         [P1]
  chat-notifications.ts                                                   [P1, moved as-is]
  iom.ts              createIoMOps({ brand, … })                           [P1]
  worker/lab-instance.ts, worker/host-switch.ts                           [P1, deleted in P3]
  port-ipc.ts         IPC control plane (node test harness after P3)      [P1]
  instance.ts         startLaneInstance(): in-page instance, commserver   [P2]
  registry-bridge.ts  window.__planRegistry + #__api_bridge               [P2]
  session-plan.ts     session / ui plans the host drives                  [P2]
  shell/              ported Flexibel lane-shell functions (D1)           [P3]
  test/brand.ts       testBrand() from LAB_BRAND                          [P1]
  test/commserver.ts  startCommServer() extracted from iom.test.ts        [P1]
  test/node-worker.ts                                                     [P1]
  *.test.ts

packages/projektor.browser/src/
  lab-engine/worker.ts   one worker for both brands                       [P1, deleted in P3]
  lane-app/              in-iframe app: main.tsx, RoleApp.tsx, screens/   [P2]
    themes/amway.css, themes/ek.css   (from lab/theme.css, eklab/theme.css)
  lab/                   host shell: Lab.tsx, transport.ts, main.tsx      [P3 rewrite]
  eklab/                 deleted                                          [P3]
```

---

# Phase 1: One core, same engine

Exit criterion: `amway.lab/` and `ek.lab/` are deleted, both lane suites pass from `packages/lab.core`, and both browser lanes still boot with the worker engine.

### Task 1: Scaffold lab.core with the brand config

**Files:**
- Create: `packages/lab.core/package.json`
- Create: `packages/lab.core/brand.ts`
- Create: `packages/lab.core/test/brand.ts`
- Test: `packages/lab.core/brand.test.ts`

**Interfaces:**
- Produces: `LabBrand`, `AMWAY`, `EK`, `LAB_BRANDS`, `brandById(id: string): LabBrand`, `testBrand(): LabBrand`, `commServerPortFor(brand: LabBrand): number`

- [ ] **Step 1: Write the failing test**

```ts
// packages/lab.core/brand.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK, LAB_BRANDS, brandById } from "./brand.ts";

test("brands keep today's stored and wire identifiers", () => {
  assert.equal(AMWAY.typePrefix, "Amway");
  assert.equal(EK.typePrefix, "Ek");
  assert.deepEqual(AMWAY.stock, { lot: "demo-lot-a", facility: "demo-facility" });
  assert.deepEqual(EK.stock, { lot: "ek-lot-a", facility: "ek-facility" });
  assert.equal(AMWAY.emailDomain, "lab.local");
  assert.equal(EK.emailDomain, "ek.local");
});

test("storage prefixes are unique per brand on a shared origin", () => {
  // Both lanes are served from one origin; a shared IndexedDB prefix lets one
  // lane's session pruning delete the other lane's live databases.
  const prefixes = LAB_BRANDS.map(brand => brand.storagePrefix);
  assert.equal(new Set(prefixes).size, prefixes.length);
});

test("brandById rejects unknown brands", () => {
  assert.equal(brandById("ek"), EK);
  assert.throws(() => brandById("flexibel"), /unknown brand "flexibel"/);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node --test packages/lab.core/brand.test.ts`
Expected: FAIL, `Cannot find module '.../lab.core/brand.ts'`

- [ ] **Step 3: Implement**

```json
// packages/lab.core/package.json
{
  "name": "@projektor/lab.core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Lab lanes: brand-parameterized department model, plans and ONE instance",
  "scripts": {
    "test": "LAB_BRAND=amway node --test --test-concurrency=1 *.test.ts && LAB_BRAND=ek node --test --test-concurrency=1 *.test.ts"
  }
}
```

```ts
// packages/lab.core/brand.ts
/**
 * Everything that distinguishes one lab lane from another. Recipes,
 * projection, plans and the instance are brand-agnostic and receive a
 * LabBrand; nothing else may branch on the lane.
 */
export interface LabBrand {
  id: "amway" | "ek";
  /** Recipe name prefix; stored types are `${typePrefix}Department` etc. Never change it. */
  typePrefix: "Amway" | "Ek";
  /** Error message prefix. */
  label: string;
  orderKeyPrefix: string;
  stock: { lot: string; facility: string };
  emailDomain: string;
  department: { id: string; name: string };
  /** IndexedDB directory prefix; unique per brand because lanes share an origin. */
  storagePrefix: string;
  /** Lane query value the IoM invitation carries back (`?lane=`). */
  lane: string;
}

export const AMWAY: LabBrand = {
  id: "amway",
  typePrefix: "Amway",
  label: "Amway lab",
  orderKeyPrefix: "lab-order",
  stock: { lot: "demo-lot-a", facility: "demo-facility" },
  emailDomain: "lab.local",
  department: { id: "demo-de", name: "Demo DE" },
  storagePrefix: "amway-lab",
  lane: "amway",
};

export const EK: LabBrand = {
  id: "ek",
  typePrefix: "Ek",
  label: "Ek lab",
  orderKeyPrefix: "ek-order",
  stock: { lot: "ek-lot-a", facility: "ek-facility" },
  emailDomain: "ek.local",
  department: { id: "ek-de", name: "Elektro Klein" },
  storagePrefix: "ek-lab",
  lane: "ek",
};

export const LAB_BRANDS: readonly LabBrand[] = [AMWAY, EK];

export function brandById(id: string): LabBrand {
  const brand = LAB_BRANDS.find(entry => entry.id === id);
  if (!brand) throw new Error(`lab.core: unknown brand ${JSON.stringify(id)} (known: ${LAB_BRANDS.map(entry => entry.id).join(", ")}).`);
  return brand;
}
```

```ts
// packages/lab.core/test/brand.ts
import { brandById } from "../brand.ts";
import type { LabBrand } from "../brand.ts";

/** The brand a suite run verifies; ci.core sets LAB_BRAND per lane. */
export function testBrand(): LabBrand {
  const id = process.env.LAB_BRAND;
  if (!id) throw new Error("lab.core tests: LAB_BRAND is not set (run via ci.core/run-lane-suite.mjs or npm test).");
  return brandById(id);
}

/** Lanes may run side by side; each brand gets its own local commserver port. */
export function commServerPortFor(brand: LabBrand): number {
  return brand.id === "amway" ? 18331 : 18332;
}
```

Note: `EK.department.name` is `"Elektro Klein"`, which is what the EK browser transport seeds today (`src/eklab/transport.ts:78`). The EK node tests currently seed `"Demo DE"`. Tests move to `brand.department.name` in Task 5.

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node --test packages/lab.core/brand.test.ts`
Expected: PASS, 3 tests

- [ ] **Step 5: Commit**

```bash
git add packages/lab.core/package.json packages/lab.core/brand.ts packages/lab.core/brand.test.ts packages/lab.core/test/brand.ts
git commit -m "refactor(lab): scaffold lab.core with brand config"
```

### Task 2: Brand-parameterized recipes and object constructors

**Files:**
- Create: `packages/lab.core/recipes.ts` (from `packages/amway.lab/recipes.ts`)
- Test: `packages/lab.core/recipes.test.ts` (from `packages/amway.lab/recipes.test.ts`)

**Interfaces:**
- Consumes: `LabBrand` (Task 1)
- Produces:
  - `LAB_ROLES`, `LabRole`, `LAB_KINDS`, `LabKind`
  - `labTypes(brand): Record<LabKind, string>`
  - `createLabRecipes(brand): { types; recipes: LabRecipe[]; reverseMapsForIdObjects: [string, Set<string>][] }`
  - `createLabObjects(brand): { createDepartment, createRoleAssignment, createContact, createOffer, createStockReceipt, createOrder, createPurchaseRequest, createPurchaseDecision }`
  - Object interfaces `LabDepartment`, `LabRoleAssignment`, `LabContact`, `LabOffer`, `LabOrder`, `LabPurchaseRequest`, `LabPurchaseDecision`, `LabStockReceipt`, and `LabObject` (union). `$type$` is typed `string`, and the brand's `types` map is the runtime source of truth.

- [ ] **Step 1: Write the failing test**

```ts
// packages/lab.core/recipes.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK } from "./brand.ts";
import { createLabObjects, createLabRecipes } from "./recipes.ts";
import { testBrand } from "./test/brand.ts";

const HASH = "a".repeat(64);
const PERSON = "b".repeat(64);
const brand = testBrand();
const objects = createLabObjects(brand);
const { types } = createLabRecipes(brand);

test("stored recipe names are exactly today's names", () => {
  assert.deepEqual(createLabRecipes(AMWAY).recipes.map(recipe => recipe.name),
    ["AmwayDepartment", "AmwayRoleAssignment", "AmwayContact", "AmwayOffer", "AmwayOrder", "AmwayPurchaseRequest", "AmwayPurchaseDecision", "AmwayStockReceipt"]);
  assert.deepEqual(createLabRecipes(EK).recipes.map(recipe => recipe.name),
    ["EkDepartment", "EkRoleAssignment", "EkContact", "EkOffer", "EkOrder", "EkPurchaseRequest", "EkPurchaseDecision", "EkStockReceipt"]);
});

test("department references allow only the brand's department type", () => {
  const assignment = createLabRecipes(brand).recipes.find(recipe => recipe.name === types.RoleAssignment)!;
  const ref = assignment.rule[0].itemtype as { allowedTypes: Set<string> };
  assert.deepEqual([...ref.allowedTypes], [types.Department]);
});

test("purchase requests are reverse-mapped by department and seller", () => {
  const maps = new Map(createLabRecipes(brand).reverseMapsForIdObjects);
  assert.deepEqual([...maps.get(types.PurchaseRequest)!], ["department", "seller"]);
  assert.deepEqual([...maps.get(types.Offer)!], ["department"]);
  assert.equal(maps.has(types.Department), false);
});

test("constructors stamp the brand type and validate", () => {
  assert.deepEqual(objects.createDepartment({ department: brand.department.id, name: brand.department.name, admin: PERSON }),
    { $type$: types.Department, department: brand.department.id, name: brand.department.name, admin: PERSON });
  assert.equal(objects.createOffer({ department: HASH, offerId: "o1", item: "ITEM@1", priceList: "retail@2026-09", channel: "facility", unitAmount: 10000, currency: "EUR", publishedBy: PERSON }).unitAmount, 10000);
  assert.equal(objects.createOrder({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, offer: "o1", quantity: 2, lot: brand.stock.lot, facility: brand.stock.facility, currency: "EUR", unitAmount: 10000, admittedAt: 1 }).quantity, 2);
  assert.throws(() => objects.createRoleAssignment({ department: HASH, subject: PERSON, role: "owner", issuer: PERSON, validFrom: 0 }),
    new RegExp(`^Error: ${brand.label}: role must be one of admin, manager, seller, customer\\.$`));
});
```

Then append every remaining test from `packages/amway.lab/recipes.test.ts` that the four above don't already cover, with these substitutions: `createX(` → `objects.createX(`, the literal `"AmwayX"` → `types.X`, `"demo-de"` → `brand.department.id`, `"demo-lot-a"`/`"demo-facility"` → `brand.stock.lot`/`brand.stock.facility`.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `LAB_BRAND=amway node --test packages/lab.core/recipes.test.ts`
Expected: FAIL, `Cannot find module '.../lab.core/recipes.ts'`

- [ ] **Step 3: Implement**

```ts
// packages/lab.core/recipes.ts
/**
 * Lab object model. Every department-scoped object references its
 * department by id hash, so receivers enumerate a department through the
 * id-object reverse map instead of any host-maintained index. Type names
 * come from the brand and are the stored ONE type names; never rename them.
 */
import type { LabBrand } from "./brand.ts";

export const LAB_ROLES = ["admin", "manager", "seller", "customer"] as const;
export type LabRole = (typeof LAB_ROLES)[number];
export const LAB_KINDS = ["Department", "RoleAssignment", "Contact", "Offer", "Order", "PurchaseRequest", "PurchaseDecision", "StockReceipt"] as const;
export type LabKind = (typeof LAB_KINDS)[number];

interface RecipeRule {
  itemprop: string;
  isId?: boolean;
  itemtype: unknown;
}

export interface LabRecipe {
  $type$: "Recipe";
  name: string;
  rule: RecipeRule[];
}

export function labTypes(brand: LabBrand): Record<LabKind, string> {
  return Object.fromEntries(LAB_KINDS.map(kind => [kind, `${brand.typePrefix}${kind}`])) as Record<LabKind, string>;
}

const person = (itemprop: string, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } });
const text = (itemprop: string, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "string" } });
const integer = (itemprop: string) => ({ itemprop, itemtype: { type: "integer" } });

export function createLabRecipes(brand: LabBrand) {
  const types = labTypes(brand);
  const departmentRef = { itemprop: "department", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set([types.Department]) } };
  const recipes: LabRecipe[] = [
    { $type$: "Recipe", name: types.Department, rule: [text("department", true), text("name"), person("admin")] },
    { $type$: "Recipe", name: types.RoleAssignment, rule: [departmentRef, person("subject", true), text("role"), person("issuer"), integer("validFrom")] },
    { $type$: "Recipe", name: types.Contact, rule: [departmentRef, person("person", true), text("name"), text("role"), person("publishedBy"), integer("publishedAt")] },
    { $type$: "Recipe", name: types.Offer, rule: [departmentRef, text("offerId", true), text("item"), text("priceList"), text("channel"), integer("unitAmount"), text("currency"), person("publishedBy")] },
    { $type$: "Recipe", name: types.Order, rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller"), text("offer"), integer("quantity"), text("lot"), text("facility"), text("currency"), integer("unitAmount"), integer("admittedAt")] },
    { $type$: "Recipe", name: types.PurchaseRequest, rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller", true), integer("requestedAt")] },
    { $type$: "Recipe", name: types.PurchaseDecision, rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller"), text("outcome"), text("reason"), integer("decidedAt")] },
    { $type$: "Recipe", name: types.StockReceipt, rule: [departmentRef, text("receiptId", true), text("lot"), text("facility"), integer("quantity"), person("receivedBy"), integer("receivedAt")] },
  ];
  const reverseMapsForIdObjects: [string, Set<string>][] = LAB_KINDS
    .filter(kind => kind !== "Department")
    .map(kind => [types[kind], new Set(kind === "PurchaseRequest" ? ["department", "seller"] : ["department"])]);
  return { types, recipes, reverseMapsForIdObjects };
}

export interface LabDepartment { $type$: string; department: string; name: string; admin: string }
export interface LabRoleAssignment { $type$: string; department: string; subject: string; role: string; issuer: string; validFrom: number }
export interface LabContact { $type$: string; department: string; person: string; name: string; role: string; publishedBy: string; publishedAt: number }
export interface LabOffer { $type$: string; department: string; offerId: string; item: string; priceList: string; channel: string; unitAmount: number; currency: string; publishedBy: string }
export interface LabOrder {
  $type$: string; department: string; idempotencyKey: string; customer: string; seller: string; offer: string;
  quantity: number; lot: string; facility: string;
  /** Price agreed at placement, in minor units — admission settles exactly this, never the current offer price. */
  currency: string; unitAmount: number; admittedAt: number;
}
export interface LabStockReceipt { $type$: string; department: string; receiptId: string; lot: string; facility: string; quantity: number; receivedBy: string; receivedAt: number }
export interface LabPurchaseRequest { $type$: string; department: string; idempotencyKey: string; customer: string; seller: string; requestedAt: number }
export interface LabPurchaseDecision { $type$: string; department: string; idempotencyKey: string; customer: string; seller: string; outcome: "rejected"; reason: "out-of-stock"; decidedAt: number }
export type LabObject = LabDepartment | LabRoleAssignment | LabContact | LabOffer | LabOrder | LabPurchaseRequest | LabPurchaseDecision | LabStockReceipt;

const HASH = /^[0-9a-f]{64}$/;

export function createLabObjects(brand: LabBrand) {
  const types = labTypes(brand);
  const fail = (message: string): never => { throw new Error(`${brand.label}: ${message}`); };
  const hash = (value: unknown, field: string): string => {
    if (typeof value !== "string" || !HASH.test(value)) fail(`${field} must be a SHA-256 hash.`);
    return value as string;
  };
  const nonEmpty = (value: unknown, field: string): string => {
    if (typeof value !== "string" || value.trim() === "") fail(`${field} is required.`);
    return value as string;
  };
  const timestamp = (value: unknown, field: string): number => {
    if (!Number.isSafeInteger(value) || (value as number) < 0) fail(`${field} must be a non-negative integer.`);
    return value as number;
  };
  const role = (value: unknown): LabRole => {
    if (typeof value !== "string" || !(LAB_ROLES as readonly string[]).includes(value)) fail(`role must be one of ${LAB_ROLES.join(", ")}.`);
    return value as LabRole;
  };
  const positive = (value: unknown, message: string): number => {
    if (!Number.isSafeInteger(value) || (value as number) <= 0) fail(message);
    return value as number;
  };

  return {
    createDepartment({ department, name, admin }: { department?: unknown; name?: unknown; admin?: unknown } = {}): LabDepartment {
      return { $type$: types.Department, department: nonEmpty(department, "department"), name: nonEmpty(name, "name"), admin: hash(admin, "admin") };
    },
    createRoleAssignment({ department, subject, role: value, issuer, validFrom }: {
      department?: unknown; subject?: unknown; role?: unknown; issuer?: unknown; validFrom?: unknown;
    } = {}): LabRoleAssignment {
      const checked = role(value);
      return { $type$: types.RoleAssignment, department: hash(department, "department"), subject: hash(subject, "subject"), role: checked, issuer: hash(issuer, "issuer"), validFrom: timestamp(validFrom, "validFrom") };
    },
    createContact({ department, person: who, name, role: value, publishedBy, publishedAt }: {
      department?: unknown; person?: unknown; name?: unknown; role?: unknown; publishedBy?: unknown; publishedAt?: unknown;
    } = {}): LabContact {
      const checked = role(value);
      return { $type$: types.Contact, department: hash(department, "department"), person: hash(who, "person"), name: nonEmpty(name, "name"), role: checked, publishedBy: hash(publishedBy, "publishedBy"), publishedAt: timestamp(publishedAt, "publishedAt") };
    },
    createOffer({ department, offerId, item, priceList, channel, unitAmount, currency, publishedBy }: {
      department?: unknown; offerId?: unknown; item?: unknown; priceList?: unknown; channel?: unknown; unitAmount?: unknown; currency?: unknown; publishedBy?: unknown;
    } = {}): LabOffer {
      const amount = positive(unitAmount, "unitAmount must be a positive integer (minor units).");
      return { $type$: types.Offer, department: hash(department, "department"), offerId: nonEmpty(offerId, "offerId"), item: nonEmpty(item, "item"), priceList: nonEmpty(priceList, "priceList"), channel: nonEmpty(channel, "channel"), unitAmount: amount, currency: nonEmpty(currency, "currency"), publishedBy: hash(publishedBy, "publishedBy") };
    },
    createStockReceipt({ department, receiptId, lot, facility, quantity, receivedBy, receivedAt }: {
      department?: unknown; receiptId?: unknown; lot?: unknown; facility?: unknown; quantity?: unknown; receivedBy?: unknown; receivedAt?: unknown;
    } = {}): LabStockReceipt {
      const count = positive(quantity, "quantity must be a positive integer.");
      return { $type$: types.StockReceipt, department: hash(department, "department"), receiptId: nonEmpty(receiptId, "receiptId"), lot: nonEmpty(lot, "lot"), facility: nonEmpty(facility, "facility"), quantity: count, receivedBy: hash(receivedBy, "receivedBy"), receivedAt: timestamp(receivedAt, "receivedAt") };
    },
    createOrder({ department, idempotencyKey, customer, seller, offer, quantity, lot, facility, currency, unitAmount, admittedAt }: {
      department?: unknown; idempotencyKey?: unknown; customer?: unknown; seller?: unknown; offer?: unknown; quantity?: unknown; lot?: unknown; facility?: unknown; currency?: unknown; unitAmount?: unknown; admittedAt?: unknown;
    } = {}): LabOrder {
      const count = positive(quantity, "quantity must be a positive integer.");
      const amount = positive(unitAmount, "unitAmount must be a positive integer (minor units).");
      return { $type$: types.Order, department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"), customer: hash(customer, "customer"), seller: hash(seller, "seller"), offer: nonEmpty(offer, "offer"), quantity: count, lot: nonEmpty(lot, "lot"), facility: nonEmpty(facility, "facility"), currency: nonEmpty(currency, "currency"), unitAmount: amount, admittedAt: timestamp(admittedAt, "admittedAt") };
    },
    createPurchaseRequest({ department, idempotencyKey, customer, seller, requestedAt }: {
      department?: unknown; idempotencyKey?: unknown; customer?: unknown; seller?: unknown; requestedAt?: unknown;
    } = {}): LabPurchaseRequest {
      return { $type$: types.PurchaseRequest, department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"), customer: hash(customer, "customer"), seller: hash(seller, "seller"), requestedAt: timestamp(requestedAt, "requestedAt") };
    },
    createPurchaseDecision({ department, idempotencyKey, customer, seller, outcome, reason, decidedAt }: {
      department?: unknown; idempotencyKey?: unknown; customer?: unknown; seller?: unknown; outcome?: unknown; reason?: unknown; decidedAt?: unknown;
    } = {}): LabPurchaseDecision {
      if (outcome !== "rejected") fail("purchase outcome must be rejected.");
      if (reason !== "out-of-stock") fail("purchase reason must be out-of-stock.");
      return { $type$: types.PurchaseDecision, department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"), customer: hash(customer, "customer"), seller: hash(seller, "seller"), outcome: "rejected", reason: "out-of-stock", decidedAt: timestamp(decidedAt, "decidedAt") };
    },
  };
}
```

The validation order and messages match `amway.lab/recipes.ts` exactly. Role is checked before any hash field, as before. Keep it that way: the ported tests assert messages.

- [ ] **Step 4: Run both brands and confirm they pass**

Run: `LAB_BRAND=amway node --test packages/lab.core/recipes.test.ts && LAB_BRAND=ek node --test packages/lab.core/recipes.test.ts`
Expected: PASS for both

- [ ] **Step 5: Commit**

```bash
git add packages/lab.core/recipes.ts packages/lab.core/recipes.test.ts
git commit -m "refactor(lab): brand-parameterized recipes in lab.core"
```

### Task 3: Brand-parameterized projection

**Files:**
- Create: `packages/lab.core/projection.ts` (from `packages/amway.lab/projection.ts`)
- Test: `packages/lab.core/projection.test.ts` (from `packages/amway.lab/projection.test.ts`)

**Interfaces:**
- Consumes: `labTypes`, `Lab*` object types (Task 2)
- Produces: `createProjection(brand): { stock: { lot; facility }; rolesOf; canPublish; audience; projectDepartment }`. The signatures are identical to today's module exports. `PublishKind`, `AudienceKind`, `Rejection`, `DepartmentProjection`, `PurchaseFailure` and `Balance` stay module-level type exports.

- [ ] **Step 1: Port the test first**

Copy `packages/amway.lab/projection.test.ts` to `packages/lab.core/projection.test.ts`. Prepend:

```ts
import { createProjection } from "./projection.ts";
import { labTypes } from "./recipes.ts";
import type { LabDepartment, LabOrder, LabStockReceipt } from "./recipes.ts";
import { testBrand } from "./test/brand.ts";

const brand = testBrand();
const types = labTypes(brand);
const { projectDepartment, rolesOf, canPublish, audience } = createProjection(brand);
```

Then substitute throughout: `Amway<Kind>` type annotations → `Lab<Kind>`, `$type$: "Amway<Kind>"` → `$type$: types.<Kind>`, `"demo-de"` → `brand.department.id`, `"demo-lot-a"` → `brand.stock.lot`, `"demo-facility"` → `brand.stock.facility`, and `rejected` entries' `type: "AmwayOrder"` → `type: types.Order`.

Also reconcile one real divergence. EK's copy (`ek.lab/projection.test.ts:119,129`) passes `stock: []` where Amway passes the receipt list. Keep the **Amway** version: it is the stronger assertion, because it proves the customer view hides stock even when stock exists.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `LAB_BRAND=amway node --test packages/lab.core/projection.test.ts`
Expected: FAIL, `Cannot find module '.../lab.core/projection.ts'`

- [ ] **Step 3: Implement**

Copy `packages/amway.lab/projection.ts` to `packages/lab.core/projection.ts`, then:

1. Replace the imports of `Amway*` types from `./recipes.ts` with the `Lab*` equivalents, plus `import { labTypes } from "./recipes.ts"` and `import type { LabBrand } from "./brand.ts"`.
2. Delete `export const LAB_STOCK = …` (line 22).
3. Keep the type exports (`PublishKind`, `AudienceKind`, `Rejection`, `DepartmentProjection`, `PurchaseFailure`, `Balance`) at module level.
4. Wrap `rolesOf`, `canPublish`, `audience`, `projectDepartment` and their private helpers in:

```ts
export function createProjection(brand: LabBrand) {
  const types = labTypes(brand);
  const stock = brand.stock;
  // … the moved functions, unchanged in logic …
  return { stock, rolesOf, canPublish, audience, projectDepartment };
}
```

5. Inside the moved code: `"AmwayOrder"` → `types.Order`, `"AmwayPurchaseRequest"` → `types.PurchaseRequest`, `"AmwayPurchaseDecision"` → `types.PurchaseDecision`, `"AmwayContact"` → `types.Contact`, `"AmwayOffer"` → `types.Offer`, `LAB_STOCK` → `stock`, and `` `Amway lab: unknown publish kind ${kind}.` `` → `` `${brand.label}: unknown publish kind ${kind}.` ``

Verify nothing brand-specific is left:

Run: `grep -n "Amway\|LAB_STOCK\|demo-" packages/lab.core/projection.ts`
Expected: no output

- [ ] **Step 4: Run both brands and confirm they pass**

Run: `LAB_BRAND=amway node --test packages/lab.core/projection.test.ts && LAB_BRAND=ek node --test packages/lab.core/projection.test.ts`
Expected: PASS for both

- [ ] **Step 5: Commit**

```bash
git add packages/lab.core/projection.ts packages/lab.core/projection.test.ts
git commit -m "refactor(lab): brand-parameterized projection in lab.core"
```

### Task 4: Plans on one code path (lab, chat, chat notifications, IoM)

This task fixes the chat-notification drift: EK gains the dedupe that only Amway has today.

**Files:**
- Create: `packages/lab.core/chat-notifications.ts` (moved as-is from `packages/amway.lab/chat-notifications.ts`)
- Create: `packages/lab.core/chat-plan.ts` (from `packages/amway.lab/chat-plan.ts`)
- Create: `packages/lab.core/iom.ts` (from `packages/amway.lab/iom.ts`)
- Create: `packages/lab.core/lab-plan.ts` (from `packages/amway.lab/lab-plan.ts`)
- Create: `packages/lab.core/test/commserver.ts` (extracted from `packages/amway.lab/iom.test.ts:31-90`)
- Test: `packages/lab.core/chat-notifications.test.ts`, `packages/lab.core/iom.test.ts`

**Interfaces:**
- Consumes: `createLabRecipes`, `createLabObjects`, `createProjection`, `LabBrand`
- Produces:
  - `createChatNotifications({ self, readObject, notify })` (unchanged)
  - `createChatPlan({ brand, topicModel, channelManager, self, notify: (peer: string, message: ChatNotification) => void })`
  - `createIoMOps({ brand, connections, self, email, appBaseUrl })`, `DEFAULT_COMM_SERVER_URL`, `parseIoMInvite` (unchanged signatures apart from `brand`)
  - `createLabPlan({ brand, connections, iomConnections, now?, email, appBaseUrl })`, `LabPlan`, `FeedRowInput`
  - `startCommServer(port: number): Promise<{ url: string; stop(): Promise<void> }>`

- [ ] **Step 1: Port the tests**

Copy `packages/amway.lab/chat-notifications.test.ts` to `packages/lab.core/chat-notifications.test.ts` unchanged. It doesn't depend on the brand, and it is the regression test EK never had.

Create `packages/lab.core/test/commserver.ts` by moving `startCommServer` and the `commServerBundle` path out of `packages/amway.lab/iom.test.ts` (lines 31–90). Make `port` a parameter and return `{ url, stop }`.

Copy `packages/amway.lab/iom.test.ts` to `packages/lab.core/iom.test.ts` and substitute: `COMM_SERVER_PORT` → `commServerPortFor(brand)`, `startCommServer()` → `startCommServer(commServerPortFor(brand))`, `"amwayLab"` → `"lab"`, `"demo-de"` → `brand.department.id`, `"Demo DE"` → `brand.department.name`, `` "seller@lab.local" `` → `` `seller@${brand.emailDomain}` ``, `"/browser/lab/"` → `brand.id === "amway" ? "/browser/lab/" : "/browser/eklab/"` (bind it once as `const laneEntry`), and `"amway-lab-iom-"` → `` `${brand.storagePrefix}-iom-` ``.

Registry plan names become brand-neutral: `amwayLab`/`ekLab` → `lab` and `amwayChat`/`ekChat` → `chat`. Each registry lives in its own realm, so the names never collide. This removes a brand parameter from every call site.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `LAB_BRAND=ek node --test packages/lab.core/chat-notifications.test.ts packages/lab.core/iom.test.ts`
Expected: FAIL, missing modules

- [ ] **Step 3: Implement**

- `chat-notifications.ts`: move as-is. Also fix the import path `../../../one/packages/one.models/lib/models/ChannelManager.js`: `packages/lab.core` sits at the same depth as `packages/amway.lab`, so the path stays valid. The out-of-repo relative import is a known issue for Phase 4, so don't change it here.
- `chat-plan.ts`: copy the **Amway** version (it has the notification dedupe). Add `brand: LabBrand` to the options and replace both `"Amway lab: …"` messages with `` `${brand.label}: …` ``.
- `iom.ts`: copy, add `brand` to `createIoMOps` options, and replace `"Amway lab: …"` messages with `` `${brand.label}: …` ``. Doc comments that say `lab://` stay as they are (the scheme is unified in Task 5).
- `lab-plan.ts`: copy the **Amway** version (it has the explanatory comments EK lost), then:

```ts
// top of createLabPlan
export function createLabPlan({ brand, connections, iomConnections, now = () => Date.now(), email, appBaseUrl }: {
  brand: LabBrand;
  connections: ConnectionsModel;
  iomConnections: ConnectionsModel;
  now?: () => number;
  email: string;
  appBaseUrl: string;
}) {
  const { types } = createLabRecipes(brand);
  const objects = createLabObjects(brand);
  const { stock, audience, canPublish, projectDepartment, rolesOf } = createProjection(brand);
  const KIND_OF_TYPE: Record<string, string> = {
    [types.Department]: "department", [types.RoleAssignment]: "assignment", [types.Contact]: "contact",
    [types.Offer]: "offer", [types.Order]: "order", [types.PurchaseRequest]: "purchase-request",
    [types.PurchaseDecision]: "purchase-decision", [types.StockReceipt]: "stock",
  };
  const ID_FIELD: Record<string, string> = {
    [types.Department]: "department", [types.RoleAssignment]: "subject", [types.Contact]: "person",
    [types.Offer]: "offerId", [types.Order]: "idempotencyKey", [types.PurchaseRequest]: "idempotencyKey",
    [types.PurchaseDecision]: "idempotencyKey", [types.StockReceipt]: "receiptId",
  };
  const fail = (message: string): never => { throw new Error(`${brand.label}: ${message}`); };
  // … existing body …
}
```

  Move the module-level `KIND_OF_TYPE`/`ID_FIELD` (lines 50–51) inside as shown. In the body: every `"Amway<Kind>"` literal → `types.<Kind>`; `typeNameOf("Amway<Kind>")` → `typeNameOf(types.<Kind>)`; `LAB_STOCK` → `stock`; `` `lab-order-${now()}` `` → `` `${brand.orderKeyPrefix}-${now()}` ``; `throw new Error("Amway lab: …")` → `fail("…")`; `createX(` → `objects.createX(`; spread `...createIoMOps({ brand, connections: iomConnections, self, email, appBaseUrl })`.

Verify:

Run: `grep -n "Amway\|LAB_STOCK\|lab-order" packages/lab.core/lab-plan.ts packages/lab.core/chat-plan.ts packages/lab.core/iom.ts`
Expected: no output

- [ ] **Step 4: Run both brands and confirm they pass**

Run: `LAB_BRAND=amway node --test --test-concurrency=1 packages/lab.core/chat-notifications.test.ts packages/lab.core/iom.test.ts && LAB_BRAND=ek node --test --test-concurrency=1 packages/lab.core/chat-notifications.test.ts packages/lab.core/iom.test.ts`
Expected: PASS for both

- [ ] **Step 5: Commit**

```bash
git add packages/lab.core/chat-notifications.ts packages/lab.core/chat-notifications.test.ts packages/lab.core/chat-plan.ts packages/lab.core/iom.ts packages/lab.core/iom.test.ts packages/lab.core/lab-plan.ts packages/lab.core/test/commserver.ts
git commit -m "refactor(lab): one plan code path for both lanes; ek gains chat notification dedupe"
```

### Task 5: Worker engine, integration suite and CI lanes on lab.core

**Files:**
- Create: `packages/lab.core/worker/lab-instance.ts` (from `packages/amway.lab/lab-instance.ts`)
- Create: `packages/lab.core/worker/host-switch.ts` (from `packages/amway.lab/host-switch.ts`)
- Create: `packages/lab.core/port-ipc.ts` (from `packages/amway.lab/port-ipc.ts`, unchanged)
- Create: `packages/lab.core/test/node-worker.ts` (from `packages/amway.lab/test/node-worker.ts`)
- Test: `packages/lab.core/lab.integration.test.ts`, `packages/lab.core/host-switch.test.ts`, `packages/lab.core/port-ipc.test.ts`
- Modify: `packages/ci.core/lanes.mjs`, `packages/ci.core/run-lane-suite.mjs`

**Interfaces:**
- Consumes: everything from Tasks 1–4
- Produces: `startLabInstance({ brand, port, key, email, secret, directory, createMessageChannel, commServerUrl?, appBaseUrl? })`. The registry registers `lab`, `chat` and `connection`. Chat feed rows carry `type: \`${brand.typePrefix}Chat\``, `kind: "chat"`, `hash: message.id` and `obj: { incoming }`, the Amway shape, now for both lanes. The dialer scheme is `lab:` for both lanes (it is realm-local).

- [ ] **Step 1: Port the tests**

- `host-switch.test.ts`, `port-ipc.test.ts`: copy from `amway.lab` and fix the import paths (`./host-switch.ts` → `./worker/host-switch.ts`). They are identical between the labs today.
- `lab.integration.test.ts`: copy the **Amway** version and substitute `"amwayLab"` → `"lab"`, `"amwayChat"` → `"chat"`, `"demo-de"` → `brand.department.id`, `"Demo DE"` → `brand.department.name`, `"lab-stock-opening"` → `` `${brand.storagePrefix}-stock-opening` ``, `"amway-lab-"` → `` `${brand.storagePrefix}-` ``, and `"AmwayX"` literals → `types.X` (with `const types = labTypes(brand)`).
- `test/node-worker.ts`: accept `brand` in `workerData` and pass it on:

```ts
// in packages/lab.core/test/node-worker.ts, replacing the email/start lines
const brand = brandById(String(data.brand));
await startLabInstance({
  brand,
  port,
  key: data.key,
  email: `${data.key}@${brand.emailDomain}`,
  secret: `lab-${data.key}`,
  directory: data.directory,
  createMessageChannel: () => new MessageChannel(),
  commServerUrl: data.commServerUrl,
  appBaseUrl: data.appBaseUrl,
});
```

  Every test that spawns node workers passes `brand: brand.id` in `workerData`.

- [ ] **Step 2: Run and confirm failure**

Run: `LAB_BRAND=ek node --test --test-concurrency=1 packages/lab.core/lab.integration.test.ts`
Expected: FAIL, missing `worker/lab-instance.ts`

- [ ] **Step 3: Implement**

In `worker/lab-instance.ts` (copied from Amway), add `brand: LabBrand` to `LabInstanceOptions` and:

```ts
const { recipes: labRecipes, reverseMapsForIdObjects: labReverseMaps } = createLabRecipes(brand);
// MultiUser recipes:        ...(labRecipes as unknown as Recipe[])
// reverseMapsForIdObjects:  merge(ReverseMapsForIdObjectsStable, ReverseMapsForIdObjectsExperimental, labReverseMaps)
const plan = createLabPlan({ brand, connections, iomConnections, email, appBaseUrl: appBaseUrl ?? "http://localhost/" });
const chatPlan = createChatPlan({
  brand, topicModel, channelManager,
  self: () => {
    const owner = getInstanceOwnerIdHash();
    if (!owner) throw new Error(`${brand.label}: instance has no owner.`);
    return owner;
  },
  notify: (peer, message) => postFeed(port, {
    type: `${brand.typePrefix}Chat`, id: peer, hash: message.id, kind: "chat",
    obj: { incoming: message.incoming },
  }),
});
registry.register("lab", plan, {
  description: `${brand.label} department operations over ONE storage`,
  methods: ["whoAmI", "createDepartment", "assignRole", "publishContact", "publishOffer", "stockUp", "shareOffer", "shareOfferWithSeller", "placeOrder", "buy", "admitOrder", "getDepartment", "setOnline", "createIoMInvite", "awaitIoMInvite", "acceptIoMInvite"]
    .map(name => ({ name, description: `lab.${name}` })),
});
registry.register("chat", chatPlan, {
  description: `${brand.label} 1:1 chat over topic channels`,
  methods: ["openChat", "sendChat", "readChat"].map(name => ({ name, description: `chat.${name}` })),
});
```

Replace the two remaining `"Amway lab: …"` strings with `` `${brand.label}: …` ``. `host-switch.ts` is copied unchanged apart from its doc comment ("never reads lab data").

CI lanes point at one package and pass the brand:

```js
// packages/ci.core/lanes.mjs — both entries
packageDir: "packages/lab.core",
```

```js
// packages/ci.core/run-lane-suite.mjs — replace the spawn line
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", `./${lane.packageDir}/*.test.ts`], {
  stdio: "inherit",
  env: { ...process.env, LAB_BRAND: lane.id },
});
```

If `packages/ci.core/ci-core.test.mjs` asserts distinct `packageDir`s, update that assertion to expect the shared directory.

- [ ] **Step 4: Run both lane suites and confirm they pass**

Run: `npm run test:amway-lab && npm run test:ek-lab && npm run test:ci-core`
Expected: `ci.core: lane amway pass`, `ci.core: lane ek pass`, ci-core tests pass

- [ ] **Step 5: Commit**

```bash
git add packages/lab.core packages/ci.core/lanes.mjs packages/ci.core/run-lane-suite.mjs packages/ci.core/ci-core.test.mjs
git commit -m "refactor(lab): worker engine and lane suites run from lab.core"
```

### Task 6: Browser lanes on lab.core; delete the forks

This task fixes two bugs: the shared IndexedDB prefix (`src/lab/worker.ts:47`, `src/eklab/worker.ts:47`, both `amway-lab-`) and EK's unread counting (`src/eklab/Lab.tsx:341` counts every chat row, including your own messages and replays).

**Files:**
- Create: `packages/projektor.browser/src/lab-engine/worker.ts` (one worker for both brands)
- Create: `packages/projektor.browser/src/lab-engine/transport.ts` (from `src/lab/transport.ts`, brand-parameterized)
- Delete: `src/lab/worker.ts`, `src/lab/transport.ts`, `src/eklab/worker.ts`, `src/eklab/transport.ts`, `src/lab/worker-global.d.ts` (move it to `src/lab-engine/`)
- Modify: `src/lab/Lab.tsx`, `src/eklab/Lab.tsx`, `src/components/LabDeviceInvite.tsx`, `vite.config.ts:35-36`, `tsconfig.json:16-17`
- Modify: `tests/ek-chat.spec.ts:96-102`
- Delete: `packages/amway.lab/`, `packages/ek.lab/`

**Interfaces:**
- Consumes: `startLabInstance`, `startLabHost`, `PortApiClient`, `brandById`, `AMWAY`, `EK`
- Produces: `bootLab(brand: LabBrand, onStage?)`, `bootJoinInstance(brand, key, onStage?)`, with `LabHandle` and `LAB_KEYS` unchanged

- [ ] **Step 1: Tighten the EK unread spec so it fails today**

In `packages/projektor.browser/tests/ek-chat.spec.ts`, replace lines 96–102 with the exact-count assertions from `amway-chat.spec.ts:97-116`: badge text `"1"`, then a repeated send gives `"2"`, the sender shows no badge, opening the chat clears it, and one more send gives `"1"`. Copy that block and change only the `test(...)` name context.

Run: `cd packages/projektor.browser && npx playwright test tests/ek-chat.spec.ts`
Expected: FAIL. EK counts the customer's own replayed rows, so the badge text is not `"1"`/`"2"` as expected.

- [ ] **Step 2: Implement the shared worker and transport**

```ts
// packages/projektor.browser/src/lab-engine/worker.ts
/**
 * Browser Web Worker entry for one lab instance of either brand. The
 * platform import must run before anything touches one.core storage. Vite
 * emits this chunk only for the literal `new Worker(new URL(...))` in
 * transport.ts, so brand and role arrive as the first message.
 */
import "@refinio/one.core/system/load-browser.js";
import { brandById } from "@projektor/lab.core/brand.ts";
import { startLabInstance } from "@projektor/lab.core/worker/lab-instance.ts";
import type { LabPort } from "@projektor/lab.core/port-ipc.ts";
```

The rest of the body is `src/lab/worker.ts` lines 15–84 with these changes:
- The first message is `{ kind: "lab-key", brand, key, session, prune, commServer, appBase }`, followed by `const brand = brandById(message.brand)`.
- `` `amway-lab-${key}-${session}` `` → `` `${brand.storagePrefix}-${key}-${session}` ``
- Prune prefix `` `amway-lab-${key}-` `` → `` `${brand.storagePrefix}-${key}-` ``
- `` email: `${key}@lab.local` `` → `` email: `${key}@${brand.emailDomain}` ``
- `startLabInstance({ brand, … })`

`src/lab-engine/transport.ts` is `src/lab/transport.ts` with a `brand: LabBrand` first parameter on `bootLab`, `bootJoinInstance`, `spawnWorker` and `laneAppBase`, plus these changes: `url.searchParams.set("lane", brand.lane)`; the first message carries `brand: brand.id`; `"amwayLab"` → `"lab"`; `"demo-de"` → `brand.department.id`; `"Demo DE"` → `brand.department.name`. Keep `new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })` literal.

Wire the aliases:

```ts
// packages/projektor.browser/vite.config.ts — replace lines 35–36
{ find: /^@projektor\/lab\.core\/(.*)$/, replacement: path.resolve(HERE, "../lab.core/$1") },
```

Use `path.resolve(HERE, …)` rather than the hard-coded `/Users/gecko/...` path the old aliases used, so the build works on other checkouts. Confirm `HERE` is defined as the package directory in `vite.config.ts`.

```json
// packages/projektor.browser/tsconfig.json — replace lines 16–17
"@projektor/lab.core/*": ["../lab.core/*"],
```

Both `Lab.tsx` files:
- `import { bootLab, bootJoinInstance, LAB_KEYS } from "../lab-engine/transport"` and `import { AMWAY } from "@projektor/lab.core/brand.ts"` (EK imports `EK`). Call sites pass the brand: `bootLab(AMWAY, …)`.
- `"amwayLab"`/`"ekLab"` → `"lab"`, `"amwayChat"`/`"ekChat"` → `"chat"`
- `@projektor/amway.lab/port-ipc.ts`/`@projektor/ek.lab/port-ipc.ts` → `@projektor/lab.core/port-ipc.ts`
- **EK unread fix:** replace EK's reducer branch (`src/eklab/Lab.tsx:340-343`) with Amway's condition:

```ts
if (row.type === "EkChat" && row.obj?.incoming === true && row.id !== column.chatPeer) {
  chatUnread[row.id] = (chatUnread[row.id] ?? 0) + 1;
}
```

  Also drop EK's line 410 (`if (row.type === "EkChat" && row.id === peer) void read();`) **only if** Amway has no equivalent. Check with `grep -n 'AmwayChat' src/lab/Lab.tsx` and mirror whatever Amway does, so both shells behave the same.

`src/components/LabDeviceInvite.tsx:3`: `@projektor/amway.lab/port-ipc.ts` → `@projektor/lab.core/port-ipc.ts`

Delete the forks:

```bash
git rm -r packages/amway.lab packages/ek.lab packages/projektor.browser/src/lab/worker.ts packages/projektor.browser/src/lab/transport.ts packages/projektor.browser/src/eklab/worker.ts packages/projektor.browser/src/eklab/transport.ts
git mv packages/projektor.browser/src/lab/worker-global.d.ts packages/projektor.browser/src/lab-engine/worker-global.d.ts
```

Check for leftover references:

Run: `grep -rn "amway\.lab\|ek\.lab\|amwayLab\|ekLab\|amwayChat\|ekChat" packages scripts package.json --include=*.ts --include=*.tsx --include=*.mjs --include=*.js --include=*.json | grep -v node_modules | grep -v /dist/`
Expected: no output. `scripts/amway-server.mjs` and `packages/amway.app/app-book.js` showed up in the earlier grep only for "lab" in prose and routes; recheck that nothing imports the deleted packages.

- [ ] **Step 3: Verify**

Run: `npm run typecheck:browser`
Expected: exit 0

Run: `cd packages/projektor.browser && npx playwright test tests/ek-chat.spec.ts tests/amway-chat.spec.ts tests/lab-mesh.spec.ts tests/ek-mesh.spec.ts tests/amway-join.spec.ts tests/ek-join.spec.ts tests/amway-purchases.spec.ts tests/ek-purchases.spec.ts`
Expected: all pass. The strengthened `ek-chat.spec.ts` now passes.

Run: `npm test`
Expected: exit 0 (the full root suite, including both lane suites and the browser typecheck)

- [ ] **Step 4: Commit**

```bash
git add -A packages/projektor.browser packages/amway.lab packages/ek.lab
git commit -m "refactor(lab): both browser lanes on lab.core; fix shared IndexedDB prefix and ek unread counting"
```

**Phase 1 checkpoint:** stop and review with the user. Confirm D1–D5 before starting Phase 2.

---

# Phase 2: The in-page lane app (what Flexibel's iframes load)

Flexibel's lane loads `/app/?demoSession=lab-<role>&labInstance=<role>`, its real product app. Projektor has no browser-local product app, so this phase builds one from the pieces that already exist: the worker's ONE composition and the column UI inside `Lab.tsx`. Exit criterion: `/browser/app/?lane=amway&labInstance=seller` opens a standalone role app that exposes `window.__planRegistry` and can register, log in, create or accept invites, and run every `lab`/`chat` operation.

### Task 7: Registry bridge (the host↔app control plane)

**Files:**
- Create: `packages/lab.core/registry-bridge.ts`
- Test: `packages/lab.core/registry-bridge.test.ts`

**Interfaces:**
- Produces: `PlanRegistry` (`call(plan, method, params?) → Promise<{ success: boolean; data?: unknown; error?: { message?: string } }>`, the exact `DemoPlanRegistry` contract from Flexibel's `demo/runner-client.ts`) and `exposeRegistry(win, registry: { call(plan, method, params): Promise<unknown> }): () => void`

- [ ] **Step 1: Write the failing test**

```ts
// packages/lab.core/registry-bridge.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { exposeRegistry } from "./registry-bridge.ts";

function fakeWindow() {
  const appended: { id: string }[] = [];
  const win = {
    document: {
      createElement: () => ({ id: "", hidden: false }),
      body: { appendChild: (el: { id: string }) => appended.push(el) },
      getElementById: (id: string) => appended.find(el => el.id === id) ?? null,
    },
  } as unknown as Window & { __planRegistry?: { call: Function } };
  return { win, appended };
}

test("exposes the registry before the bridge marker, wrapping results", async () => {
  const { win } = fakeWindow();
  exposeRegistry(win, { call: async (plan: string, method: string) => ({ plan, method }) });
  assert.ok(win.document.getElementById("__api_bridge"));
  assert.deepEqual(await win.__planRegistry!.call("lab", "whoAmI"), { success: true, data: { plan: "lab", method: "whoAmI" } });
});

test("reports failures as { success: false } without throwing", async () => {
  const { win } = fakeWindow();
  exposeRegistry(win, { call: async () => { throw new Error("Operation 'lab' not found"); } });
  assert.deepEqual(await win.__planRegistry!.call("lab", "x"), { success: false, error: { message: "Operation 'lab' not found" } });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `LAB_BRAND=amway node --test packages/lab.core/registry-bridge.test.ts`
Expected: FAIL, missing module

- [ ] **Step 3: Implement**

```ts
// packages/lab.core/registry-bridge.ts
/**
 * Control plane between the lane host and one lane app instance, matching
 * Flexibel's DemoPlanRegistry contract (flexibel.browser/browser-ui/src/demo/
 * runner-client.ts): the host waits for `#__api_bridge`, then calls
 * `window.__planRegistry.call(plan, method, params)`. The registry is set
 * before the marker is appended, so the marker alone proves readiness.
 * Plans may not be registered yet; that failure comes back as the
 * `Operation '<plan>' not found` message the host's callWhenRegistered expects.
 */
export interface PlanRegistry {
  call(plan: string, method: string, params?: unknown): Promise<{ success: boolean; data?: unknown; error?: { message?: string } }>;
}

export function exposeRegistry(
  win: Window & { __planRegistry?: PlanRegistry },
  registry: { call(plan: string, method: string, params: unknown): Promise<unknown> },
): () => void {
  win.__planRegistry = {
    async call(plan, method, params) {
      try {
        return { success: true, data: await registry.call(plan, method, params ?? {}) };
      } catch (error) {
        return { success: false, error: { message: error instanceof Error ? error.message : String(error) } };
      }
    },
  };
  const marker = win.document.createElement("div");
  marker.id = "__api_bridge";
  marker.hidden = true;
  win.document.body.appendChild(marker);
  return () => {
    marker.remove?.();
    delete win.__planRegistry;
  };
}
```

`registry.call` is backed by refinio.api's `OperationRegistry`. Before wiring it in Task 9, check the method name `OperationRegistry` actually exposes for dispatch (`grep -n "async \|^  [a-z]*(" ../one/packages/refinio.api/dist/src/registry/index.d.ts`), and make its unknown-plan error text contain `Operation '<plan>' not found`. If the registry words it differently, map it in Task 9's adapter. Don't loosen the host's match.

- [ ] **Step 4: Run and confirm it passes**

Run: `LAB_BRAND=amway node --test packages/lab.core/registry-bridge.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/lab.core/registry-bridge.ts packages/lab.core/registry-bridge.test.ts
git commit -m "feat(lab): PlanRegistry bridge matching the flexibel lane contract"
```

### Task 8: session and ui plans

The host drives the app through the same plan vocabulary Flexibel uses, reduced to what the projektor lane needs.

**Files:**
- Create: `packages/lab.core/session-plan.ts`
- Test: `packages/lab.core/session-plan.test.ts`

**Interfaces:**
- Produces: `createSessionPlans({ boot, state })`, which returns `{ session, ui, onecore }` plan objects:
  - `session.registerAndSetup({ email, secret, instanceName })` → `{ readyState: LaneUiState }`
  - `session.loginAndInit({ email, secret, instanceName })` → `{ readyState }`
  - `session.waitUntilReady({ timeoutMs })` → `LaneUiState`. It rejects with `"still booting"` while no instance exists, as Flexibel's does.
  - `ui.getInviteState()` → `LaneUiState`
  - `ui.loadPendingInvitation({ url })` → `{ loaded: boolean; pendingInvitationPresent: boolean }`
  - `ui.acceptPendingInvitation({ secret, displayName, expectedEmail })` → `{ ownerId }`. This registers with the invited email and pairs through `connection.connectWithInvite`.
  - `onecore.getStatus()` → `{ ownerId, instanceId, instanceName }`
  - `LaneUiState = { ownerId: string | null; instanceId: string | null; authState: "logged_out" | "logging_in" | "logged_in"; postLoginPlansReady: boolean; pendingInvitation: boolean }`
- Consumes: `boot(credentials) => Promise<LaneInstance>` (Task 9)

Deliberate deviation from Flexibel: Flexibel's `ui` plan clicks test IDs in the rendered invite form (`submitInviteRegistration`, `clickTestId`). Projektor's lane app has no such form yet, so `acceptPendingInvitation` performs the same steps through plans. The owner-equals-invited-Person assertion (Flexibel PRD §5.3.3) is kept, in the host (Task 12). A UI-driven variant can follow once the lane app's join page exists; the Task 10 join page is its target.

- [ ] **Step 1: Write the failing test**

```ts
// packages/lab.core/session-plan.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { createSessionPlans } from "./session-plan.ts";

function fakeBoot() {
  const calls: string[] = [];
  return {
    calls,
    boot: async ({ email }: { email: string }) => {
      calls.push(email);
      return { ownerId: "o".repeat(64), instanceId: "i".repeat(64), instanceName: "n", connectWithInvite: async () => {} };
    },
  };
}

test("waitUntilReady rejects with 'still booting' before any instance", async () => {
  const { boot } = fakeBoot();
  const { session } = createSessionPlans({ boot });
  await assert.rejects(session.waitUntilReady({ timeoutMs: 10 }), /still booting/);
});

test("registerAndSetup boots once and reports logged_in", async () => {
  const { boot, calls } = fakeBoot();
  const { session, ui } = createSessionPlans({ boot });
  const { readyState } = await session.registerAndSetup({ email: "a@lab.local", secret: "s", instanceName: "n" });
  assert.equal(readyState.authState, "logged_in");
  assert.equal(readyState.postLoginPlansReady, true);
  assert.deepEqual(calls, ["a@lab.local"]);
  await assert.rejects(session.registerAndSetup({ email: "b@lab.local", secret: "s", instanceName: "n" }), /already signed in/);
  assert.equal((await ui.getInviteState()).ownerId, "o".repeat(64));
});

test("loadPendingInvitation rejects URLs that are not lane invitations", async () => {
  const { boot } = fakeBoot();
  const { ui } = createSessionPlans({ boot });
  await assert.rejects(ui.loadPendingInvitation({ url: "https://example.com/" }), /not a lane invitation/);
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `LAB_BRAND=amway node --test packages/lab.core/session-plan.test.ts`
Expected: FAIL, missing module

- [ ] **Step 3: Implement**

```ts
// packages/lab.core/session-plan.ts
/**
 * Session lifecycle and invite entry for one lane app instance, in the plan
 * vocabulary the Flexibel lane host speaks (session / ui / onecore). One
 * instance per realm: a second sign-in in the same document throws instead
 * of replacing the first.
 */
export interface LaneUiState {
  ownerId: string | null;
  instanceId: string | null;
  authState: "logged_out" | "logging_in" | "logged_in";
  postLoginPlansReady: boolean;
  pendingInvitation: boolean;
}

export interface BootedInstance {
  ownerId: string;
  instanceId: string;
  instanceName: string;
  connectWithInvite(url: string): Promise<void>;
}

interface Credentials { email: string; secret: string; instanceName: string }

export function createSessionPlans({ boot }: { boot: (credentials: Credentials) => Promise<BootedInstance> }) {
  let instance: BootedInstance | null = null;
  let booting: Promise<BootedInstance> | null = null;
  let pendingInvitation: string | null = null;

  const state = (): LaneUiState => ({
    ownerId: instance?.ownerId ?? null,
    instanceId: instance?.instanceId ?? null,
    authState: instance ? "logged_in" : booting ? "logging_in" : "logged_out",
    postLoginPlansReady: instance !== null,
    pendingInvitation: pendingInvitation !== null,
  });

  const start = async (credentials: Credentials): Promise<{ readyState: LaneUiState }> => {
    if (instance || booting) throw new Error("Lane app: already signed in in this document.");
    booting = boot(credentials);
    try {
      instance = await booting;
    } finally {
      booting = null;
    }
    return { readyState: state() };
  };

  const session = {
    registerAndSetup: start,
    loginAndInit: start,
    async waitUntilReady({ timeoutMs }: { timeoutMs: number }): Promise<LaneUiState> {
      if (!instance && !booting) throw new Error("Lane app: still booting (no instance yet).");
      if (instance) return state();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          booting,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Lane app: waitUntilReady timed out.")), timeoutMs); }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      return state();
    },
  };

  const ui = {
    async getInviteState(): Promise<LaneUiState> {
      return state();
    },
    async loadPendingInvitation({ url }: { url: string }) {
      const parsed = new URL(url);
      if (parsed.searchParams.get("invited") !== "true" || !parsed.hash) throw new Error("Lane app: not a lane invitation URL.");
      pendingInvitation = url;
      return { loaded: true, pendingInvitationPresent: true };
    },
    async acceptPendingInvitation({ secret, displayName, expectedEmail }: { secret: string; displayName: string; expectedEmail: string }) {
      if (!pendingInvitation) throw new Error("Lane app: no pending invitation.");
      const url = pendingInvitation;
      await start({ email: expectedEmail.toLowerCase(), secret, instanceName: displayName });
      await instance!.connectWithInvite(url);
      pendingInvitation = null;
      return { ownerId: instance!.ownerId };
    },
  };

  const onecore = {
    async getStatus() {
      if (!instance) throw new Error("Lane app: no instance.");
      return { ownerId: instance.ownerId, instanceId: instance.instanceId, instanceName: instance.instanceName };
    },
  };

  return { session, ui, onecore };
}
```

The `invited=true` + fragment shape matches `iom.ts`'s canonical invitation format. IoP invites from `connection.createInvite` must carry the same shape; confirm this in Task 9's integration test.

- [ ] **Step 4: Run and confirm it passes**

Run: `LAB_BRAND=amway node --test packages/lab.core/session-plan.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/lab.core/session-plan.ts packages/lab.core/session-plan.test.ts
git commit -m "feat(lab): session/ui/onecore plans for lane app instances"
```

### Task 9: startLaneInstance on the commserver data plane (D2), with the node integration suite

**Files:**
- Create: `packages/lab.core/instance.ts`
- Modify: `packages/lab.core/test/node-worker.ts` (boot `startLaneInstance`; control plane stays `port-ipc`)
- Modify: `packages/lab.core/lab.integration.test.ts` (commserver data plane, invite seeding per D3)
- Modify: `packages/lab.core/lab-plan.ts` (remove `setOnline`)

**Interfaces:**
- Consumes: `createLabRecipes`, `createLabPlan`, `createChatPlan`, `createSessionPlans`, `startCommServer`
- Produces: `startLaneInstance({ brand, email, secret, instanceName, directory, commServerUrl, appBaseUrl, onFeed })` → `BootedInstance & { registry: { call(plan, method, params): Promise<unknown> }; shutdown(): Promise<void> }`

Implementation notes. Build this from `worker/lab-instance.ts`:
- **One** `ConnectionsModel` on `commServerUrl` for mesh, IoP and IoM. This is the `iomConnections` configuration applied to everything. Remove the `lab:` dialer, `chum-accept` listener, `routing-ready`, the MessagePort plumbing and the second model.
- Keep the `pairingProtocolVersion` restoration shim, applied once to the single model.
- Keep `enableConnectionsToPerson` for persisted peers. This is the D4 reuse path, and it now runs on every reload.
- Feed rows go to `onFeed(row)` instead of `postFeed(port, row)`.
- `createLabPlan` loses `iomConnections` (pass the single model) and `setOnline`, per D2.
- `registry` wraps refinio.api's `OperationRegistry` dispatch (see Task 7's note) and registers `lab`, `chat`, `connection`, `session`, `ui` and `onecore`.

- [ ] **Step 1: Rewrite the integration seed first (failing)**

In `lab.integration.test.ts`, replace the `startLabHost` + `pairAll` boot with:
1. `const commserver = await startCommServer(commServerPortFor(brand))`
2. Spawn four node workers running `startLaneInstance` against `commserver.url` (control plane over `port-ipc` as today).
3. Admin: `session.registerAndSetup`.
4. For each of manager, seller and customer, in order: admin `connection.createInvite`, then role `ui.loadPendingInvitation({ url })`, then role `ui.acceptPendingInvitation({ secret, displayName, expectedEmail: \`${key}@${brand.emailDomain}\` })`. Assert `ownerId` equals the admin-side Person for that email.
5. D3 full mesh: for each of (manager, seller), (manager, customer), (seller, customer), A `connection.createInvite` and B `connection.connectWithInvite`.

Keep every assertion after the seed unchanged. Delete the partition/`setSwitch`/`setOnline` cases and list them in the commit message.

Run: `npm run test:amway-lab`
Expected: FAIL, `startLaneInstance` missing

- [ ] **Step 2: Implement `instance.ts`** as described above.

- [ ] **Step 3: Run both suites and confirm they pass**

Run: `npm run test:amway-lab && npm run test:ek-lab`
Expected: both `pass`

- [ ] **Step 4: Commit**

```bash
git add packages/lab.core
git commit -m "feat(lab): startLaneInstance on the commserver data plane; invite-seeded integration suite"
```

### Task 10: Lane app UI (`/browser/app/`)

**Files:**
- Create: `packages/projektor.browser/app/index.html` (Vite entry, `#lane-app-root`)
- Create: `packages/projektor.browser/src/lane-app/main.tsx`: reads `?lane=`, `?labInstance=` and `?demoSession=`; resolves the brand with `brandById`; directory `resolveStorageDirectory(brand, search)`; calls `exposeRegistry`; renders `<RoleApp>`
- Create: `packages/projektor.browser/src/lane-app/RoleApp.tsx` and `src/lane-app/screens/{Directory,Offers,Orders,Stock,Chat,FeedLog}.tsx`, extracted from the column body of `src/lab/Lab.tsx` (the directory with chat icon and unread badge, offers with share, orders/purchase history, staff-only meters, chat window, feed log)
- Create: `src/lane-app/feed.ts`: the unread/feed reducer, switching on `row.kind` instead of `row.type`, so it is brand-agnostic
- Move: `src/lab/theme.css` → `src/lane-app/themes/amway.css`, `src/eklab/theme.css` → `src/lane-app/themes/ek.css`; move `src/eklab/assets/` → `src/lane-app/assets/ek/`
- Create: `packages/lab.core/storage.ts` with `resolveStorageDirectory(brand, search)`
- Modify: `packages/projektor.browser/vite.config.ts` (add the `app` input)
- Test: `packages/lab.core/storage.test.ts`, `packages/projektor.browser/src/lane-app/feed.test.ts`

`resolveStorageDirectory` follows Flexibel's rule, but without its silent default. The lane app has no single-instance mode, so a missing or invalid `labInstance` throws:

```ts
// packages/lab.core/storage.ts
import type { LabBrand } from "./brand.ts";

/** One ONE storage directory per lane role (Flexibel: flexibel-lab-<role>). */
export function resolveStorageDirectory(brand: LabBrand, search: string): string {
  const labInstance = new URLSearchParams(search).get("labInstance");
  if (labInstance === null || !/^[a-z-]{1,40}$/.test(labInstance)) {
    throw new Error(`${brand.label}: labInstance must match [a-z-]{1,40}, got ${JSON.stringify(labInstance)}.`);
  }
  return `${brand.storagePrefix}-${labInstance}`;
}
```

```ts
// packages/lab.core/storage.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { AMWAY, EK } from "./brand.ts";
import { resolveStorageDirectory } from "./storage.ts";

test("per-brand, per-role directories", () => {
  assert.equal(resolveStorageDirectory(AMWAY, "?labInstance=seller"), "amway-lab-seller");
  assert.equal(resolveStorageDirectory(EK, "?lane=ek&labInstance=seller"), "ek-lab-seller");
});

test("rejects missing or unsafe instance names", () => {
  assert.throws(() => resolveStorageDirectory(AMWAY, ""), /labInstance must match/);
  assert.throws(() => resolveStorageDirectory(AMWAY, "?labInstance=../x"), /labInstance must match/);
});
```

`feed.test.ts` locks in the unread rule that both lanes now share: an incoming chat row for a closed peer increments, an own (`incoming: false`) row does not, the open peer does not, and the same `hash` twice counts once.

Steps: write `storage.test.ts` and `feed.test.ts` (fail) → implement `storage.ts` and `feed.ts` (pass) → extract the screens (no behavior change; the class names `lab-column-body`, `lab-chat-badge` and `lab-device-invite` stay so the specs keep their selectors) → `npm run typecheck:browser` → manual check: open `http://localhost:<dev>/browser/app/?lane=amway&labInstance=admin&commServer=ws://127.0.0.1:18331`, run `window.__planRegistry.call("session","registerAndSetup",{email:"admin@lab.local",secret:"x",instanceName:"admin"})` in the console, and confirm the app renders the admin view → commit `feat(lab): standalone lane app per role`.

---

# Phase 3: Flexibel-style host shell

Exit criterion: `/browser/lab/?lane=amway` and `?lane=ek` boot four lane-app iframes sequentially, seed through invites, and render snapshot columns. Workers, the host switch and `src/eklab/` are gone.

### Task 11: Port Flexibel's lane-shell functions (D1)

**Files:**
- Create: `packages/lab.core/shell/plan-client.ts`: `waitForRegistry`, `callPlan` (ported from `flexibel.browser/browser-ui/src/demo/runner-client.ts`: `waitForRunnerRegistry` and `callRunnerPlan`, with the German error strings translated to English)
- Create: `packages/lab.core/shell/readiness.ts`: `callWhenRegistered`, `poll` (ported from `flexibel …/lab/transport.ts:278-305` and `poll`)
- Create: `packages/lab.core/shell/transitions.ts`: `observeAppTransitions`, `APP_TRANSITION_DEBOUNCE_MS` (from `transport.ts:141-173`)
- Create: `packages/lab.core/shell/theme.ts`: from `flexibel …/lab/theme.ts`, verbatim
- Create: `packages/lab.core/shell/urls.ts`: `labAppUrl(href, brand, key)`, which returns `/browser/app/?lane=<brand.lane>&labInstance=<key>&demoSession=lab-<key>`
- Test: `packages/lab.core/shell/*.test.ts`, ported from `flexibel …/lab/transport.test.ts` (the cases for the functions above) and `theme.test.ts`

Every ported file starts with the header `// Ported from one.flexibel/packages/flexibel.browser/browser-ui/src/<path> (<commit sha>); replace with the shared lane-shell package in Phase 4.` Record the commit sha with `git -C ../heiner/one.flexibel rev-parse --short HEAD`.

`callWhenRegistered` is the only retrying call. Port its semantics exactly: retry only on `Operation '<plan>' not found`, with a 60 s bound, and settle immediately on every other outcome. Its test must cover a side-effecting call that fails with a different error and is never retried.

Steps: port the tests (fail) → port the code (pass) → commit `feat(lab): port flexibel lane-shell functions into lab.core/shell`.

### Task 12: Host transport: boot, seed, snapshot

**Files:**
- Rewrite: `packages/projektor.browser/src/lab/transport.ts`, following the structure of Flexibel's `transport.ts`:
  - `LAB_KEYS = ["admin", "manager", "seller", "customer"]`
  - `labAccount(brand, key, …)`: persisted in host `localStorage` under `` `${brand.storagePrefix}-account:${key}` ``
  - `ensureLabAccount` (admin only; the same readiness probe as Flexibel's `ensureLabAccount`: `session.waitUntilReady` with `"still booting"`)
  - `seedDepartment(admin)`: `lab.getDepartment`, then `lab.createDepartment(brand.department)` if unknown
  - `createRoleInvite(admin, key, email)` → `connection.createInvite`
  - `acceptRoleInvite(client, url, { secret, displayName, expectedEmail })` → `ui.loadPendingInvitation`, then `ui.acceptPendingInvitation`, then `callWhenRegistered(onecore.getStatus)`
  - `seedRole(…)`: Flexibel's reuse and foreign-identity refusal, verbatim in behavior (seed record under `` `${brand.storagePrefix}-seed:${key}` ``; emails `` `lab-${key}-${hex6}@${brand.emailDomain}` ``; throw with recovery instructions on a foreign owner)
  - `pairMesh(clients)`: the three remaining role↔role pairs (D3), skipped for pairs whose connection is already listed in `connection.listConnections`
  - `bootLab(brand, options)`: sequential iframes as in Flexibel's `bootLab` (the sequential boot is load-bearing), with `sizeLabFrame` at 720 px (matching the current fixed column height)
  - Snapshot per column: `ui.getInviteState` + `lab.getDepartment` for roles, each degrading to `null` independently, as in Flexibel PRD §5.5
- Test: `packages/projektor.browser/src/lab/transport.test.ts`: account persistence, URL building, the seed record and foreign-identity refusal, and pairMesh idempotence, all with a fake `PlanRegistry` (modelled on Flexibel's `transport.test.ts`)

Role appointments stay manual, as today (`src/lab/transport.ts:67-70`): the seed pairs the instances and creates the department, and the admin and manager appoint through the UI.

Steps: tests (fail) → implement (pass) → commit `feat(lab): flexibel-style host transport with invite seeding`.

### Task 13: Host shell UI; delete the worker engine and the EK fork

**Files:**
- Rewrite: `packages/projektor.browser/src/lab/Lab.tsx`: brand from `?lane=` (via `brandById`), four columns, each with title from `LANES[].roleLabels` + brand titles, owner/instance short IDs, roles, app state, Refresh, live/paused (UI-only, D2), seed log, the iframe, and the IoM invite. `LabDeviceInvite` now calls through the column's `PlanRegistry` client instead of `PortApiClient`. Add the light → dark → system theme toggle from `shell/theme.ts`, and propagate the resolved theme to the iframes via their theme key.
- Modify: `src/lab/main.tsx`, `lab/index.html` (one entry for both lanes; brand title, favicon and theme-color set from the brand at runtime)
- Delete: `src/eklab/`, `eklab/index.html`, `src/lab-engine/`, `packages/lab.core/worker/`
- Modify: `src/App.tsx`: `#/lab` and `#/eklab` redirect to `/browser/lab/?lane=amway|ek`, and the `EkLab` import goes away
- Modify: `vite.config.ts` (drop the `eklab` input)
- Modify: `scripts/amway-server.mjs:504-512`: `/amway/lab` serves `lab/index.html` with `?lane=amway`, and `/ek/lab` does the same with `?lane=ek`
- Modify: `packages/ci.core/lanes.mjs` (`entry: "/browser/lab/?lane=<id>"`; drop `hash` if nothing else reads it), `packages/ci.core/smoke/lane-ceremony.mjs` (drive the columns through `frameLocator`)
- Modify: `tests/*-chat.spec.ts`, `*-join.spec.ts`, `*-purchases.spec.ts`: column content moves inside `page.frameLocator("section.lab-column iframe").nth(i)`
- Delete: `tests/lab-mesh.spec.ts` and `tests/ek-mesh.spec.ts` partition assertions (D2). Keep their ceremony assertions, rewritten as one `tests/lane-ceremony.spec.ts` parameterized over `LANES`.
- Record: boot-to-seeded time for both lanes, before (worker engine, measured at Task 6's commit) and after. Per D5, stop and report if it is more than 2×.

Verify: `npm test` exit 0; `cd packages/projektor.browser && npx playwright test` all pass; `grep -rn "eklab\|lab-engine\|host-switch\|setSwitch\|setOnline" packages scripts --include=*.ts --include=*.tsx --include=*.mjs | grep -v node_modules | grep -v /dist/` gives no output.

Commit `feat(lab): flexibel lane architecture for amway and ek; remove worker engine`.

### Task 14: Docs

**Files:**
- Modify: `packages/projektor.browser/README.md` (lab section: the new architecture, `?lane=`, `?commServer=`, persistence and recovery)
- Create: `docs/lab-lane-prd.md`, mirroring the section layout of Flexibel's `flexibel-lab-prd.md` (entry, isolation, seeding, readiness, snapshot, architecture diagram, deliberate deviations: plan-driven invite acceptance instead of test-ID clicking, and the D3 full mesh)

Commit `docs(lab): lane PRD aligned with flexibel`.

---

# Phase 4: Shared with Flexibel (separate plan)

Once Phase 3 has landed, write a separate plan to:
1. Move `lab.core/shell/*` into one package under `lama/packages` (D1), with the tests moved alongside.
2. Replace the ported copies in projektor, and the originals in `one.flexibel/packages/flexibel.browser/browser-ui/src/{demo/runner-client.ts,lab/transport.ts,lab/theme.ts}`, with imports from it.
3. Fix `lab.core`'s relative imports into `../../../one/packages/...` so they go through workspace packages, and extend the same to `chat-notifications.ts`.
4. Optionally, add Flexibel's column snapshot shape (`LabSnapshot`) to the shared package so both hosts render the same column chrome.

---

## Self-review notes

- Coverage: the fork merge (Tasks 1–6), both drift bugs (EK chat dedupe in Task 4 and Task 6; shared IndexedDB prefix in Task 6), the Flexibel architecture (full instance: Tasks 7–10; iframe host: Tasks 11–13), the flexibel lab (reference throughout, sharing in Phase 4) and docs (Task 14).
- Phases 2–3 give full code for the new pure modules (bridge, session plans, storage). The ONE composition (Task 9) and the UI extraction (Tasks 10, 13) are specified as exact moves from named line ranges, because they rearrange existing code rather than add new logic.
- Names used consistently: `LabBrand`, `brandById`, `testBrand`, `commServerPortFor`, `labTypes`, `createLabRecipes`, `createLabObjects`, `createProjection`, `createLabPlan`, `createChatPlan`, `createIoMOps`, `startLabInstance` (P1, deleted in P3), `startLaneInstance` (P2+), `exposeRegistry`, `PlanRegistry`, `createSessionPlans`, `LaneUiState`, `BootedInstance`, `resolveStorageDirectory(brand, search)`, `labAppUrl(href, brand, key)`, plan names `lab`/`chat`/`connection`/`session`/`ui`/`onecore`.
