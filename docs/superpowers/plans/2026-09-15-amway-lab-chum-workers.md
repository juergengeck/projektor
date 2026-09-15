# Amway Lab: CHUM Workers Implementation Plan

> **Status: complete** (executed 2026-09-15 via workflow; all 11 tasks done, all boxes checked).
> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Execution record

- `one` repo: `3c13918` (Task 1 dialer registry), `5cddbfd` (Task 2 MessagePort plugin).
- `projektor`: `f03d84d` recipes → `086b4f8` projection → `1c37818` port IPC → `3d1782d` lab plan → `b2527dd` instance boot → `d9cadbc` 4-worker integration → `1039f9b` browser host → `ae35f71` feed-forward UI (Tasks 3–11).
- `npm run test:amway-lab`: 16/16 pass (recipes 4, projection 4, port-ipc 3, integration 5); full `npm test` chain green at execution time.
- Known gaps: no live-browser click-through of the four columns yet (build-only verification); `one` shows a modified `pnpm-lock.yaml` to review before push; pre-existing dirty files in `projektor` were left untouched.
- Follow-up: customer self-purchase allowed (a customer may admit orders for themselves only; buying for anyone else still denied). Task 4 spec, test, and implementation above updated accordingly.

**Goal:** Rebuild the `/browser/#/lab` demo so each of the four role columns (org admin, manager, seller, customer) is a Web Worker running its own ONE instance. The web host talks to workers only through refinio.api over IPC. Workers exchange information only via CHUM over host-switched MessagePorts. The UI updates by feed-forward from worker storage events instead of a host-built propagation timeline.

**Architecture:**
- **Worker:** each worker boots one.core, `LeuteModel` and `ConnectionsModel`. The `ConnectionsModel` has a single `external` incoming listener at `lab://<key>`, and the `OperationRegistry` is exposed through refinio.api's `IpcTransport` on the worker's port.
- **Host as connection switch:** the host only routes connection setup. When a worker dials `lab://<key>`, a one.models connection dialer creates a `MessageChannel` and gives one port to the host. The host transfers that port to the target worker, which accepts it with `ConnectionsModel.acceptExternalConnection`. After setup, CHUM bytes flow worker-to-worker.
- **Domain data:** Amway state lives in ONE versioned objects, with sender-side `createAccess` grants.
- **Feed-forward:** the UI patches rows pushed from `onVersionedObjStored`.

**Tech Stack:** one.core (browser + nodejs loaders), one.models (`ConnectionsModel`, `Connection.fromPlugin`, `MultiUser`), refinio.api (`OperationRegistry`, `IpcTransport`, `OneConnectionPlan`), React 18 + Vite 5 (`packages/projektor.browser`), `node:test` + `node:worker_threads` for multi-instance tests, mocha for one.models.

## Global Constraints

- **Instances:** one ONE instance per worker, and never more than one instance per JS realm. Node tests use `worker_threads`, one instance per thread.
- **Host role:** the host (main thread) never stores, reads or applies Amway data. It calls refinio.api operations and switches MessagePorts only.
- **Data exchange:** only CHUM. No envelopes, `applyEnvelope`, `deliverEnvelope`, `demoHashOf` or `propagate`.
- **Worker operations:** every host→worker call goes through refinio.api `IpcTransport` channels `handler:call` / `handler:list`.
- **Fail fast:**
  - No fallbacks and no `catch(() => null)`.
  - Unknown dial schemes throw.
  - Unanswered IPC calls reject on worker error.
- **No artificial delays:** no `setTimeout` waits in production code. Tests may use a bounded deadline only as a failure guard around an event promise.
- **Imports:**
  - No dynamic `import()`.
  - projektor plain-JS files import ONE code by relative path (`../../../one/packages/...`), like `packages/amway.app/publication.js`.
  - The browser resolves `@refinio/*` via `packages/projektor.browser/vite.config.ts` aliases.
- **Hash types:** use `getObjectByIdHash(idHash)` for latest versions and `getObject(hash)` for exact versions.
- **Git:**
  - Never run `git checkout`.
  - Commits carry no Claude attribution.
  - one.models changes are committed in `/Users/gecko/src/one`; projektor changes in `/Users/gecko/src/projektor`.
- **Keep:** the old `packages/amway.app/runtime.js` and `runtime.test.js` stay untouched until Task 10 removes the lab's dependency on them. `scripts/amway-server.mjs` still uses the amway modules.

## File Structure

**one.models (`/Users/gecko/src/one/packages/one.models`)**
- Create `src/misc/Connection/plugins/MessagePortPlugin.ts`: a terminal `ConnectionPlugin` over any MessagePort-like object (browser or `worker_threads`).
- Create `src/misc/ConnectionEstablishment/ConnectionDialers.ts`: a per-URL-scheme dialer registry; `ws:`/`wss:` map to WebSocket, and unknown schemes throw.
- Modify `src/misc/ConnectionEstablishment/protocols/EncryptedConnectionHandshake.ts:146`: replace `new Connection(createWebSocket(url))` with `createOutgoingConnection(url)`.
- Test `test/MessagePortPlugin-test.ts` and `test/ConnectionDialers-test.ts`.

**projektor: new package `packages/amway.lab/`** (environment-neutral worker core)
- `package.json`: package metadata and `test` script.
- `recipes.js`: Amway lab recipes and reverse maps, plus pure object constructors.
- `recipes.test.js`: pure constructor tests.
- `projection.js`: pure role and department projection over plain objects.
- `projection.test.js`: pure projection tests.
- `port-ipc.js`: an `ipcMain`-shaped adapter over a MessagePort for refinio.api `IpcTransport`, plus the host-side `PortApiClient`.
- `port-ipc.test.js`: IPC round-trip tests over `worker_threads` `MessageChannel`.
- `lab-plan.js`: the `amwayLab` refinio.api plan (publish, assign, read, online toggle, feed-forward rows).
- `lab-instance.js`: boots MultiUser, models, registry, dialer and feed for one worker, given a loaded platform.
- `test/node-worker.js`: `worker_threads` entry (loads the one.core nodejs platform and calls `startLabInstance`).
- `host-switch.js`: the environment-neutral web-host port switch plus pairing orchestration, shared by the Node integration test and the browser `LabHost`.
- `lab.integration.test.js`: 4 workers, full-mesh pairing via IPC, CHUM propagation, access denial and pause.

**projektor.browser**
- Rewrite `src/lab/worker.ts`: browser entry (loads the one.core browser platform and calls `startLabInstance`).
- Rewrite `src/lab/transport.ts`: `LabHost`, which spawns workers, switches ports and exposes a `PortApiClient` per column.
- Rewrite `src/lab/Lab.tsx`: columns driven by the snapshot plus feed-forward rows; no timeline, no switchboard.
- Modify `vite.config.ts`: alias `@refinio/api` dist and `worker.format: "es"`.

**Docs**
- Modify `packages/projektor.browser/README.md`: add a Lab section describing the architecture.

---

### Task 1: Connection dialer registry in one.models

**Files:**
- Create: `/Users/gecko/src/one/packages/one.models/src/misc/ConnectionEstablishment/ConnectionDialers.ts`
- Modify: `/Users/gecko/src/one/packages/one.models/src/misc/ConnectionEstablishment/protocols/EncryptedConnectionHandshake.ts:11,146`
- Test: `/Users/gecko/src/one/packages/one.models/test/ConnectionDialers-test.ts`

**Interfaces:**
- Produces:
  - `registerConnectionDialer(scheme: string, dialer: (url: string) => Connection): () => void`: throws if the scheme is already registered, or if the scheme is `ws:`/`wss:`. Returns an unregister function.
  - `createOutgoingConnection(url: string): Connection`: `ws:`/`wss:` → `new Connection(createWebSocket(url))`; a registered scheme → `dialer(url)`; anything else throws `Error('No connection dialer registered for scheme <scheme>')`.

- [x] **Step 1: Write the failing test**

```ts
// test/ConnectionDialers-test.ts
import {expect} from 'chai';
import {
    createOutgoingConnection,
    registerConnectionDialer
} from '../lib/misc/ConnectionEstablishment/ConnectionDialers.js';
import Connection from '../lib/misc/Connection/Connection.js';

describe('ConnectionDialers', () => {
    it('routes a registered scheme to its dialer', () => {
        const sentinel = {} as Connection;
        const seen: string[] = [];
        const unregister = registerConnectionDialer('lab:', url => {
            seen.push(url);
            return sentinel;
        });
        try {
            expect(createOutgoingConnection('lab://seller')).to.equal(sentinel);
            expect(seen).to.deep.equal(['lab://seller']);
        } finally {
            unregister();
        }
    });

    it('throws for an unregistered scheme', () => {
        expect(() => createOutgoingConnection('lab://seller')).to.throw(
            'No connection dialer registered for scheme lab:'
        );
    });

    it('rejects a duplicate registration', () => {
        const unregister = registerConnectionDialer('lab:', () => ({} as Connection));
        try {
            expect(() => registerConnectionDialer('lab:', () => ({} as Connection))).to.throw(
                'Connection dialer for lab: is already registered'
            );
        } finally {
            unregister();
        }
    });

    it('refuses to override websocket schemes', () => {
        expect(() => registerConnectionDialer('ws:', () => ({} as Connection))).to.throw(
            'ws: is dialed by WebSocket'
        );
    });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/gecko/src/one/packages/one.models && npm run build:test && npx --no-install mocha --exit test/ConnectionDialers-test.js`
Expected: FAIL. The TypeScript build errors with `Cannot find module '../lib/misc/ConnectionEstablishment/ConnectionDialers.js'`.

- [x] **Step 3: Write minimal implementation**

```ts
// src/misc/ConnectionEstablishment/ConnectionDialers.ts
import {createWebSocket} from '@refinio/one.core/lib/system/websocket.js';
import Connection from '../Connection/Connection.js';

/**
 * Outgoing transport selection by URL scheme.
 *
 * WebSocket URLs are dialed natively. Every other scheme (e.g. `lab:` for
 * host-switched MessagePorts between Web Workers) must be registered by the
 * platform that owns that transport; there is no implicit default.
 */
export type ConnectionDialer = (url: string) => Connection;

const WEBSOCKET_SCHEMES = new Set(['ws:', 'wss:']);
const dialers = new Map<string, ConnectionDialer>();

export function registerConnectionDialer(scheme: string, dialer: ConnectionDialer): () => void {
    if (WEBSOCKET_SCHEMES.has(scheme)) {
        throw new Error(`${scheme} is dialed by WebSocket`);
    }
    if (dialers.has(scheme)) {
        throw new Error(`Connection dialer for ${scheme} is already registered`);
    }
    dialers.set(scheme, dialer);
    return () => {
        if (dialers.get(scheme) === dialer) dialers.delete(scheme);
    };
}

export function createOutgoingConnection(url: string): Connection {
    const scheme = new URL(url).protocol;
    if (WEBSOCKET_SCHEMES.has(scheme)) {
        return new Connection(createWebSocket(url));
    }
    const dialer = dialers.get(scheme);
    if (dialer === undefined) {
        throw new Error(`No connection dialer registered for scheme ${scheme}`);
    }
    return dialer(url);
}
```

In `src/misc/ConnectionEstablishment/protocols/EncryptedConnectionHandshake.ts`:
- Remove line 11: `import {createWebSocket} from '@refinio/one.core/lib/system/websocket.js';`
- Add: `import {createOutgoingConnection} from '../ConnectionDialers.js';`
- Replace line 146 `const connection = new Connection(createWebSocket(url));` with:

```ts
    const connection = createOutgoingConnection(url);
```

Keep the `Connection` import only if it is still used elsewhere in the file (`grep -n "Connection\b" src/misc/ConnectionEstablishment/protocols/EncryptedConnectionHandshake.ts`). Otherwise remove it.

- [x] **Step 4: Run tests to verify they pass and nothing regressed**

Run: `cd /Users/gecko/src/one/packages/one.models && npm run build:test && npx --no-install mocha --exit test/ConnectionDialers-test.js test/Connections/WebSocketPlugin-test.js`
Expected: PASS (4 dialer tests + the existing WebSocketPlugin tests).

Run: `npm run build`
Expected: exits 0, and `lib/misc/ConnectionEstablishment/ConnectionDialers.js` exists.

- [x] **Step 5: Commit**

```bash
cd /Users/gecko/src/one/packages/one.models
git add src/misc/ConnectionEstablishment/ConnectionDialers.ts src/misc/ConnectionEstablishment/protocols/EncryptedConnectionHandshake.ts test/ConnectionDialers-test.ts
git commit -m "feat(connections): dial outgoing connections through a per-scheme registry"
```

---

### Task 2: MessagePort connection plugin in one.models

**Files:**
- Create: `/Users/gecko/src/one/packages/one.models/src/misc/Connection/plugins/MessagePortPlugin.ts`
- Test: `/Users/gecko/src/one/packages/one.models/test/MessagePortPlugin-test.ts`

**Interfaces:**
- Consumes: `Connection.fromPlugin(plugin: ConnectionPlugin): Connection` (existing, `src/misc/Connection/Connection.ts:118`).
- Produces:
  - `interface MessagePortLike { postMessage(message: unknown): void; addEventListener(type: 'message', listener: (event: {data: unknown}) => void): void; removeEventListener(type: 'message', listener: (event: {data: unknown}) => void): void; start?(): void; close(): void }`
  - `class MessagePortPlugin extends ConnectionPlugin`, with `constructor(port: MessagePortLike)` and name `'messageport'`.
  - Wire frames: `{t: 'msg', d: Uint8Array | string}` and `{t: 'close', reason: string}`.

A MessagePort has no portable close event, so closing is signalled with an explicit `close` frame. The host uses the same frame to refuse a dial.

- [x] **Step 1: Write the failing test**

```ts
// test/MessagePortPlugin-test.ts
import {expect} from 'chai';
import {MessageChannel} from 'node:worker_threads';
import Connection from '../lib/misc/Connection/Connection.js';
import MessagePortPlugin from '../lib/misc/Connection/plugins/MessagePortPlugin.js';

function nextMessage(conn: Connection): Promise<Uint8Array | string> {
    return new Promise(resolve => {
        const off = conn.onMessage(message => {
            off();
            resolve(message);
        });
    });
}

describe('MessagePortPlugin', () => {
    it('opens immediately and carries binary and string frames both ways', async () => {
        const {port1, port2} = new MessageChannel();
        const a = Connection.fromPlugin(new MessagePortPlugin(port1));
        const b = Connection.fromPlugin(new MessagePortPlugin(port2));
        await a.waitForOpen();
        await b.waitForOpen();

        const inB = nextMessage(b);
        a.send(new Uint8Array([1, 2, 3]));
        expect(Array.from((await inB) as Uint8Array)).to.deep.equal([1, 2, 3]);

        const inA = nextMessage(a);
        b.send('hello');
        expect(await inA).to.equal('hello');

        a.close('done');
        b.close('done');
    });

    it('propagates a local close to the remote side', async () => {
        const {port1, port2} = new MessageChannel();
        const a = Connection.fromPlugin(new MessagePortPlugin(port1));
        const b = Connection.fromPlugin(new MessagePortPlugin(port2));
        await a.waitForOpen();
        await b.waitForOpen();

        const closed = new Promise<void>(resolve => {
            b.state.onEnterState(state => {
                if (state === 'closed') resolve();
            });
        });
        a.close('bye');
        await closed;
        expect(b.state.currentState).to.equal('closed');
    });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/gecko/src/one/packages/one.models && npm run build:test && npx --no-install mocha --exit test/MessagePortPlugin-test.js`
Expected: FAIL, `Cannot find module '../lib/misc/Connection/plugins/MessagePortPlugin.js'`.

`StateMachine.onEnterState` is a callable `OEvent` (`src/misc/StateMachine.ts:96`), so the test's `b.state.onEnterState(cb)` subscribes directly.

- [x] **Step 3: Write minimal implementation**

```ts
// src/misc/Connection/plugins/MessagePortPlugin.ts
import type {
    ConnectionClosedEvent,
    ConnectionIncomingEvent,
    ConnectionOutgoingEvent,
    EventCreationFunctions
} from '../ConnectionPlugin.js';
import ConnectionPlugin from '../ConnectionPlugin.js';

export interface MessagePortLike {
    postMessage(message: unknown): void;
    addEventListener(type: 'message', listener: (event: {data: unknown}) => void): void;
    removeEventListener(type: 'message', listener: (event: {data: unknown}) => void): void;
    start?(): void;
    close(): void;
}

type Frame = {t: 'msg'; d: Uint8Array | string} | {t: 'close'; reason: string};

/**
 * Terminal transport plugin over a structured-clone MessagePort (browser
 * Web Workers or node:worker_threads). Message boundaries are preserved by
 * the port, so no length framing is needed. Closing is an explicit frame
 * because MessagePort has no portable close event.
 */
export default class MessagePortPlugin extends ConnectionPlugin {
    private readonly port: MessagePortLike;
    private closedReason: ConnectionClosedEvent | null = null;
    private closeEventSent = false;
    private readonly listener = (event: {data: unknown}): void => this.handleFrame(event.data as Frame);

    constructor(port: MessagePortLike) {
        super('messageport');
        this.port = port;
    }

    public attachedToConnection(eventCreationFunctions: EventCreationFunctions, id: number): void {
        super.attachedToConnection(eventCreationFunctions, id);
        this.port.addEventListener('message', this.listener);
        this.port.start?.();
        this.eventCreationFunctions.createIncomingEvent({type: 'opened'});
    }

    public transformIncomingEvent(_event: ConnectionIncomingEvent): ConnectionIncomingEvent | null {
        return null;
    }

    public transformOutgoingEvent(event: ConnectionOutgoingEvent): ConnectionOutgoingEvent | null {
        if (event.type === 'message') {
            if (this.closeEventSent) {
                throw new Error(`MessagePortPlugin ${this.id}: send after close`);
            }
            this.port.postMessage({t: 'msg', d: event.data} satisfies Frame);
        }
        if (event.type === 'close') {
            const reason = 'Close called' + (event.reason === undefined ? '.' : `: ${event.reason}`);
            if (!this.closeEventSent) {
                this.port.postMessage({t: 'close', reason} satisfies Frame);
            }
            this.finish(reason, 'local');
        }
        return null;
    }

    private handleFrame(frame: Frame): void {
        if (frame.t === 'msg') {
            this.eventCreationFunctions.createIncomingEvent({type: 'message', data: frame.d});
            return;
        }
        if (frame.t === 'close') {
            this.finish(frame.reason, 'remote');
            return;
        }
        throw new Error(`MessagePortPlugin ${this.id}: unknown frame ${JSON.stringify(frame)}`);
    }

    private finish(reason: string, origin: 'local' | 'remote'): void {
        if (this.closeEventSent) return;
        this.closedReason = {type: 'closed', reason, origin};
        this.port.removeEventListener('message', this.listener);
        this.port.close();
        this.closeEventSent = true;
        this.eventCreationFunctions.createIncomingEvent(this.closedReason);
    }
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd /Users/gecko/src/one/packages/one.models && npm run build:test && npx --no-install mocha --exit test/MessagePortPlugin-test.js test/ConnectionDialers-test.js && npm run build`
Expected: PASS (2 + 4 tests), build exits 0.

- [x] **Step 5: Commit**

```bash
cd /Users/gecko/src/one/packages/one.models
git add src/misc/Connection/plugins/MessagePortPlugin.ts test/MessagePortPlugin-test.ts
git commit -m "feat(connections): add MessagePort transport plugin"
```

---

### Task 3: Amway lab recipes and pure constructors

**Files:**
- Create: `packages/amway.lab/package.json`
- Create: `packages/amway.lab/recipes.js`
- Test: `packages/amway.lab/recipes.test.js`

**Interfaces:**
- Produces (all exported from `recipes.js`):
  - `AMWAY_LAB_TYPES = ["AmwayDepartment", "AmwayRoleAssignment", "AmwayContact", "AmwayOffer", "AmwayOrder"]`
  - `AmwayLabRecipes: Recipe[]`
  - `AmwayLabReverseMapsForIdObjects: [string, Set<string>][]`: each non-department type keyed with `new Set(["department"])`
  - `LAB_ROLES = ["admin", "manager", "seller", "customer"]`
  - `createDepartment({ department, name, admin })` → `{ $type$: "AmwayDepartment", department, name, admin }`
  - `createRoleAssignment({ department, subject, role, issuer, validFrom })` → `{ $type$: "AmwayRoleAssignment", ... }`, where `department` is an `SHA256IdHash<AmwayDepartment>` and `subject`/`issuer` are `SHA256IdHash<Person>`
  - `createContact({ department, person, name, role, publishedBy, publishedAt })`
  - `createOffer({ department, offerId, item, priceList, channel, unitAmount, currency, publishedBy })`
  - `createOrder({ department, idempotencyKey, customer, seller, offer, quantity, lot, facility, admittedAt })`
  - Every constructor throws `Error("Amway lab: <field> ...")` on invalid input.

- [x] **Step 1: Write the failing test**

```js
// packages/amway.lab/recipes.test.js
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AMWAY_LAB_TYPES, AmwayLabRecipes, AmwayLabReverseMapsForIdObjects,
  createContact, createDepartment, createOffer, createOrder, createRoleAssignment,
} from "./recipes.js";

const HASH = "a".repeat(64);
const PERSON = "b".repeat(64);

test("every lab type has exactly one recipe", () => {
  assert.deepEqual(AmwayLabRecipes.map(recipe => recipe.name).sort(), [...AMWAY_LAB_TYPES].sort());
});

test("every department-scoped type is reverse-mapped on department", () => {
  const mapped = new Map(AmwayLabReverseMapsForIdObjects);
  for (const type of AMWAY_LAB_TYPES.filter(name => name !== "AmwayDepartment")) {
    assert.deepEqual([...mapped.get(type)], ["department"]);
  }
});

test("constructors produce typed objects", () => {
  assert.deepEqual(createDepartment({ department: "demo-de", name: "Demo DE", admin: PERSON }),
    { $type$: "AmwayDepartment", department: "demo-de", name: "Demo DE", admin: PERSON });
  assert.equal(createRoleAssignment({ department: HASH, subject: PERSON, role: "seller", issuer: PERSON, validFrom: 1 }).role, "seller");
  assert.equal(createContact({ department: HASH, person: PERSON, name: "Eva", role: "seller", publishedBy: PERSON, publishedAt: 1 }).name, "Eva");
  assert.equal(createOffer({ department: HASH, offerId: "o1", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", channel: "facility", unitAmount: 10000, currency: "EUR", publishedBy: PERSON }).unitAmount, 10000);
  assert.equal(createOrder({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, offer: "o1", quantity: 2, lot: "demo-lot-a", facility: "demo-facility", admittedAt: 1 }).quantity, 2);
});

test("constructors fail fast on invalid input", () => {
  assert.throws(() => createRoleAssignment({ department: HASH, subject: PERSON, role: "boss", issuer: PERSON, validFrom: 1 }), /role/);
  assert.throws(() => createOrder({ department: HASH, idempotencyKey: "k1", customer: PERSON, seller: PERSON, offer: "o1", quantity: 0, lot: "l", facility: "f", admittedAt: 1 }), /quantity/);
  assert.throws(() => createContact({ department: "not-a-hash", person: PERSON, name: "Eva", role: "seller", publishedBy: PERSON, publishedAt: 1 }), /department/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/gecko/src/projektor && node --test packages/amway.lab/recipes.test.js`
Expected: FAIL, `Cannot find module '.../packages/amway.lab/recipes.js'`.

- [x] **Step 3: Write minimal implementation**

```json
// packages/amway.lab/package.json
{
  "name": "@projektor/amway.lab",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Amway lab: one ONE instance per worker, CHUM between workers, refinio.api over IPC",
  "scripts": { "test": "node --test *.test.js" }
}
```

```js
// packages/amway.lab/recipes.js
/**
 * Amway lab object model. Every department-scoped object references its
 * AmwayDepartment by id hash, so receivers enumerate a department through
 * the id-object reverse map instead of any host-maintained index.
 */

export const LAB_ROLES = ["admin", "manager", "seller", "customer"];
export const AMWAY_LAB_TYPES = ["AmwayDepartment", "AmwayRoleAssignment", "AmwayContact", "AmwayOffer", "AmwayOrder"];

const departmentRef = { itemprop: "department", isId: true, itemtype: { type: "referenceToId", allowedTypes: new Set(["AmwayDepartment"]) } };
const person = (itemprop, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "referenceToId", allowedTypes: new Set(["Person"]) } });
const text = (itemprop, isId = false) => ({ itemprop, ...(isId ? { isId: true } : {}), itemtype: { type: "string" } });
const integer = itemprop => ({ itemprop, itemtype: { type: "integer" } });

export const AmwayLabRecipes = [
  { $type$: "Recipe", name: "AmwayDepartment", rule: [text("department", true), text("name"), person("admin")] },
  { $type$: "Recipe", name: "AmwayRoleAssignment", rule: [departmentRef, person("subject", true), text("role"), person("issuer"), integer("validFrom")] },
  { $type$: "Recipe", name: "AmwayContact", rule: [departmentRef, person("person", true), text("name"), text("role"), person("publishedBy"), integer("publishedAt")] },
  { $type$: "Recipe", name: "AmwayOffer", rule: [departmentRef, text("offerId", true), text("item"), text("priceList"), text("channel"), integer("unitAmount"), text("currency"), person("publishedBy")] },
  { $type$: "Recipe", name: "AmwayOrder", rule: [departmentRef, text("idempotencyKey", true), person("customer"), person("seller"), text("offer"), integer("quantity"), text("lot"), text("facility"), integer("admittedAt")] },
];

export const AmwayLabReverseMapsForIdObjects = AMWAY_LAB_TYPES
  .filter(type => type !== "AmwayDepartment")
  .map(type => [type, new Set(["department"])]);

const HASH = /^[0-9a-f]{64}$/;

function fail(message) {
  throw new Error(`Amway lab: ${message}`);
}
function hash(value, field) {
  if (typeof value !== "string" || !HASH.test(value)) fail(`${field} must be a SHA-256 hash.`);
  return value;
}
function nonEmpty(value, field) {
  if (typeof value !== "string" || value.trim() === "") fail(`${field} is required.`);
  return value;
}
function timestamp(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) fail(`${field} must be a non-negative integer.`);
  return value;
}

export function createDepartment({ department, name, admin } = {}) {
  return { $type$: "AmwayDepartment", department: nonEmpty(department, "department"), name: nonEmpty(name, "name"), admin: hash(admin, "admin") };
}

export function createRoleAssignment({ department, subject, role, issuer, validFrom } = {}) {
  if (!LAB_ROLES.includes(role)) fail(`role must be one of ${LAB_ROLES.join(", ")}.`);
  return {
    $type$: "AmwayRoleAssignment", department: hash(department, "department"), subject: hash(subject, "subject"),
    role, issuer: hash(issuer, "issuer"), validFrom: timestamp(validFrom, "validFrom"),
  };
}

export function createContact({ department, person: who, name, role, publishedBy, publishedAt } = {}) {
  if (!LAB_ROLES.includes(role)) fail(`role must be one of ${LAB_ROLES.join(", ")}.`);
  return {
    $type$: "AmwayContact", department: hash(department, "department"), person: hash(who, "person"),
    name: nonEmpty(name, "name"), role, publishedBy: hash(publishedBy, "publishedBy"), publishedAt: timestamp(publishedAt, "publishedAt"),
  };
}

export function createOffer({ department, offerId, item, priceList, channel, unitAmount, currency, publishedBy } = {}) {
  if (!Number.isSafeInteger(unitAmount) || unitAmount <= 0) fail("unitAmount must be a positive integer (minor units).");
  return {
    $type$: "AmwayOffer", department: hash(department, "department"), offerId: nonEmpty(offerId, "offerId"),
    item: nonEmpty(item, "item"), priceList: nonEmpty(priceList, "priceList"), channel: nonEmpty(channel, "channel"),
    unitAmount, currency: nonEmpty(currency, "currency"), publishedBy: hash(publishedBy, "publishedBy"),
  };
}

export function createOrder({ department, idempotencyKey, customer, seller, offer, quantity, lot, facility, admittedAt } = {}) {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) fail("quantity must be a positive integer.");
  return {
    $type$: "AmwayOrder", department: hash(department, "department"), idempotencyKey: nonEmpty(idempotencyKey, "idempotencyKey"),
    customer: hash(customer, "customer"), seller: hash(seller, "seller"), offer: nonEmpty(offer, "offer"), quantity,
    lot: nonEmpty(lot, "lot"), facility: nonEmpty(facility, "facility"), admittedAt: timestamp(admittedAt, "admittedAt"),
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd /Users/gecko/src/projektor && node --test packages/amway.lab/recipes.test.js`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
cd /Users/gecko/src/projektor
git add packages/amway.lab/package.json packages/amway.lab/recipes.js packages/amway.lab/recipes.test.js
git commit -m "feat(amway.lab): add ONE recipes for the CHUM lab"
```

---

### Task 4: Pure role and department projection

**Files:**
- Create: `packages/amway.lab/projection.js`
- Test: `packages/amway.lab/projection.test.js`

**Interfaces:**
- Consumes: object shapes from Task 3.
- Produces:
  - `LAB_STOCK = { lot: "demo-lot-a", facility: "demo-facility", gross: 10 }`
  - `rolesOf({ department, assignments, subject, atTime })` → `Set<string>`. The department's `admin` person always has `"admin"`. Otherwise, roles come from `assignments` whose `subject === subject`, whose `validFrom <= atTime`, and whose `issuer` is the department admin or holds `manager`. Only the admin may issue `manager`.
  - `canPublish(kind, { department, assignments, author, subject, atTime })` → `boolean`:
    - `"contact"`: `author === subject`, or the author is manager/admin
    - `"offer"`: manager/admin
    - `"order"`: seller/manager/admin, or a customer buying for themselves (`author === subject`)
    - `"assignment"`: admin, or manager for non-manager roles
  - `audience(kind, { department, assignments, row })` → `SHA256IdHash<Person>[]` (sorted, unique):
    - `"department" | "assignment" | "contact" | "offer"`: admin + all assignment subjects
    - `"order"`: admin + subjects with manager or seller + `row.customer`
  - `projectDepartment({ department, assignments, contacts, offers, orders, viewer, atTime })` → `{ department, roles: string[], assignments, contacts, offers, orders, availability: {lot, facility, gross, available}, rejected: {type, id, reason}[] }`:
    - Rows whose author may not publish them go to `rejected` with reason `"publisher-not-authorized"`.
    - A viewer whose only role is customer sees only orders where `customer === viewer`.
    - `available = gross − sum(quantity of all admitted orders)`.

- [x] **Step 1: Write the failing test**

```js
// packages/amway.lab/projection.test.js
import assert from "node:assert/strict";
import { test } from "node:test";
import { audience, canPublish, projectDepartment, rolesOf } from "./projection.js";

const P = ch => ch.repeat(64);
const ADMIN = P("a"), MANAGER = P("b"), SELLER = P("c"), CUSTOMER = P("d"), DEPT = P("e");
const department = { $type$: "AmwayDepartment", department: "demo-de", name: "Demo DE", admin: ADMIN };
const assign = (subject, role, issuer) => ({ $type$: "AmwayRoleAssignment", department: DEPT, subject, role, issuer, validFrom: 1 });
const assignments = [assign(MANAGER, "manager", ADMIN), assign(SELLER, "seller", MANAGER), assign(CUSTOMER, "customer", MANAGER)];

test("roles derive from the department admin chain", () => {
  assert.deepEqual([...rolesOf({ department, assignments, subject: ADMIN, atTime: 5 })], ["admin"]);
  assert.deepEqual([...rolesOf({ department, assignments, subject: SELLER, atTime: 5 })], ["seller"]);
  assert.equal(rolesOf({ department, assignments, subject: SELLER, atTime: 0 }).size, 0);
  const forged = [...assignments, assign(CUSTOMER, "manager", SELLER)];
  assert.deepEqual([...rolesOf({ department, assignments: forged, subject: CUSTOMER, atTime: 5 })], ["customer"]);
});

test("publish authority per kind", () => {
  const ctx = { department, assignments, atTime: 5 };
  assert.equal(canPublish("offer", { ...ctx, author: MANAGER }), true);
  assert.equal(canPublish("offer", { ...ctx, author: SELLER }), false);
  assert.equal(canPublish("order", { ...ctx, author: SELLER }), true);
  assert.equal(canPublish("order", { ...ctx, author: CUSTOMER }), false);
  assert.equal(canPublish("order", { ...ctx, author: CUSTOMER, subject: CUSTOMER }), true);
  assert.equal(canPublish("order", { ...ctx, author: CUSTOMER, subject: P("f") }), false);
  assert.equal(canPublish("contact", { ...ctx, author: CUSTOMER, subject: CUSTOMER }), true);
  assert.equal(canPublish("contact", { ...ctx, author: SELLER, subject: CUSTOMER }), false);
});

test("orders reach staff and their customer only", () => {
  const row = { customer: CUSTOMER };
  assert.deepEqual(audience("order", { department, assignments, row }), [ADMIN, MANAGER, SELLER, CUSTOMER].sort());
  const other = P("f");
  assert.deepEqual(audience("order", { department, assignments: [...assignments, assign(other, "customer", MANAGER)], row }),
    [ADMIN, MANAGER, SELLER, CUSTOMER].sort());
});

test("projection rejects unauthorized rows and scopes customer reads", () => {
  const order = { $type$: "AmwayOrder", department: DEPT, idempotencyKey: "k1", customer: CUSTOMER, seller: SELLER, offer: "o1", quantity: 3, lot: "demo-lot-a", facility: "demo-facility", admittedAt: 2 };
  const forgedOffer = { $type$: "AmwayOffer", department: DEPT, offerId: "bad", item: "x", priceList: "p", channel: "facility", unitAmount: 1, currency: "EUR", publishedBy: SELLER };
  const view = projectDepartment({ department, assignments, contacts: [], offers: [forgedOffer], orders: [order], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(view.offers, []);
  assert.deepEqual(view.rejected, [{ type: "AmwayOffer", id: "bad", reason: "publisher-not-authorized" }]);
  assert.equal(view.orders.length, 1);
  assert.equal(view.availability.available, 7);
  const stranger = projectDepartment({ department, assignments, contacts: [], offers: [], orders: [{ ...order, customer: P("f") }], viewer: CUSTOMER, atTime: 5 });
  assert.deepEqual(stranger.orders, []);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/gecko/src/projektor && node --test packages/amway.lab/projection.test.js`
Expected: FAIL, `Cannot find module '.../projection.js'`.

- [x] **Step 3: Write minimal implementation**

```js
// packages/amway.lab/projection.js
/**
 * Pure department projection. Authority is re-derived from the replicated
 * assignment chain on every read, so a row CHUM delivered from a peer that
 * lacked authority is visible as `rejected`, never silently merged.
 */

export const LAB_STOCK = { lot: "demo-lot-a", facility: "demo-facility", gross: 10 };

export function rolesOf({ department, assignments, subject, atTime }) {
  const roles = new Set();
  if (subject === department.admin) roles.add("admin");
  const managers = new Set(assignments
    .filter(entry => entry.role === "manager" && entry.issuer === department.admin && entry.validFrom <= atTime)
    .map(entry => entry.subject));
  for (const entry of assignments) {
    if (entry.subject !== subject || entry.validFrom > atTime) continue;
    const issuerIsAdmin = entry.issuer === department.admin;
    if (entry.role === "manager" ? issuerIsAdmin : issuerIsAdmin || managers.has(entry.issuer)) {
      roles.add(entry.role);
    }
  }
  return roles;
}

export function canPublish(kind, { department, assignments, author, subject, atTime }) {
  const roles = rolesOf({ department, assignments, subject: author, atTime });
  const staff = roles.has("admin") || roles.has("manager");
  if (kind === "contact") return author === subject || staff;
  if (kind === "offer") return staff;
  if (kind === "order") {
    if (staff || roles.has("seller")) return true;
    // Preferred-customer self-service: a customer may buy for themselves only.
    return roles.has("customer") && author === subject;
  }
  if (kind === "assignment") return roles.has("admin") || roles.has("manager");
  throw new Error(`Amway lab: unknown publish kind ${kind}.`);
}

export function audience(kind, { department, assignments, row }) {
  const people = new Set([department.admin]);
  if (kind === "order") {
    for (const entry of assignments) {
      if (entry.role === "manager" || entry.role === "seller") people.add(entry.subject);
    }
    people.add(row.customer);
  } else if (["department", "assignment", "contact", "offer"].includes(kind)) {
    for (const entry of assignments) people.add(entry.subject);
  } else {
    throw new Error(`Amway lab: unknown audience kind ${kind}.`);
  }
  return [...people].sort();
}

export function projectDepartment({ department, assignments, contacts, offers, orders, viewer, atTime }) {
  const rejected = [];
  const admit = (kind, type, id, author, subject) => {
    if (canPublish(kind, { department, assignments, author, subject, atTime })) return true;
    rejected.push({ type, id, reason: "publisher-not-authorized" });
    return false;
  };
  const validAssignments = assignments.filter(entry =>
    rolesOf({ department, assignments, subject: entry.subject, atTime }).has(entry.role));
  const viewerRoles = rolesOf({ department, assignments, subject: viewer, atTime });
  const customerOnly = viewerRoles.size === 1 && viewerRoles.has("customer");
  const admittedOrders = orders.filter(entry => admit("order", "AmwayOrder", entry.idempotencyKey, entry.seller, entry.customer));
  return {
    department: department.department,
    roles: [...viewerRoles].sort(),
    assignments: validAssignments,
    contacts: contacts.filter(entry => admit("contact", "AmwayContact", entry.person, entry.publishedBy, entry.person)),
    offers: offers.filter(entry => admit("offer", "AmwayOffer", entry.offerId, entry.publishedBy)),
    orders: customerOnly ? admittedOrders.filter(entry => entry.customer === viewer) : admittedOrders,
    availability: {
      ...LAB_STOCK,
      available: LAB_STOCK.gross - admittedOrders.reduce((sum, entry) => sum + entry.quantity, 0),
    },
    rejected,
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd /Users/gecko/src/projektor && node --test packages/amway.lab/projection.test.js`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
cd /Users/gecko/src/projektor
git add packages/amway.lab/projection.js packages/amway.lab/projection.test.js
git commit -m "feat(amway.lab): project departments from replicated authority"
```

---

### Task 5: refinio.api IPC over a MessagePort

**Files:**
- Create: `packages/amway.lab/port-ipc.js`
- Test: `packages/amway.lab/port-ipc.test.js`

**Interfaces:**
- Consumes:
  - refinio.api `IpcTransport` (`/Users/gecko/src/one/packages/refinio.api/dist/src/transports/IpcTransport.js`): `new IpcTransport(registry).register(ipcMain)` registers `handler:call`, `handler:list` and `handler:metadata`.
  - `OperationRegistry` (`.../refinio.api/dist/src/registry/index.js`): `register(name, plan, { description, methods })`.
- Produces:
  - `createPortIpcMain(port)` → `{ handle(channel, fn) }`. It listens for `{kind: "ipc-invoke", id, channel, args}` and replies `{kind: "ipc-result", id, ok, value | error}`.
  - `postFeed(port, row)` posts `{kind: "feed", row}`.
  - `class PortApiClient`:
    - `constructor(port)`
    - `call(handler, method, params)` → `Promise<data>`. It rejects with `Error(error)` when the IpcResponse has `success: false`.
    - `list()` → `Promise<OperationMetadata[]>`
    - `onFeed(callback)` → `unsubscribe`
    - `onControl(callback)` → `unsubscribe`, for `{kind: "ready" | "boot-failed" | "chum-dial"}` messages
    - `fail(error)` rejects all pending calls, used on worker `error`

- [x] **Step 1: Write the failing test**

```js
// packages/amway.lab/port-ipc.test.js
import assert from "node:assert/strict";
import { test } from "node:test";
import { MessageChannel } from "node:worker_threads";
import { IpcTransport } from "../../../one/packages/refinio.api/dist/src/transports/IpcTransport.js";
import { OperationRegistry } from "../../../one/packages/refinio.api/dist/src/registry/index.js";
import { createPortIpcMain, PortApiClient, postFeed } from "./port-ipc.js";

function pair() {
  const { port1, port2 } = new MessageChannel();
  const registry = new OperationRegistry();
  registry.register("echo", {
    say: params => ({ said: params.text }),
    boom: () => { throw new Error("kaboom"); },
  }, { description: "echo", methods: [{ name: "say", description: "say" }, { name: "boom", description: "boom" }] });
  new IpcTransport(registry).register(createPortIpcMain(port1));
  const client = new PortApiClient(port2);
  return { port1, port2, client };
}

test("calls reach the registry through IpcTransport", async () => {
  const { port1, port2, client } = pair();
  try {
    assert.deepEqual(await client.call("echo", "say", { text: "hi" }), { said: "hi" });
    assert.ok((await client.list()).some(entry => entry.name === "echo"));
  } finally { port1.close(); port2.close(); }
});

test("plan errors reject the call", async () => {
  const { port1, port2, client } = pair();
  try {
    await assert.rejects(client.call("echo", "boom", {}), /kaboom/);
    await assert.rejects(client.call("nope", "say", {}), /not found/);
  } finally { port1.close(); port2.close(); }
});

test("feed rows and worker failure", async () => {
  const { port1, port2, client } = pair();
  try {
    const row = new Promise(resolve => client.onFeed(resolve));
    postFeed(port1, { type: "AmwayOffer", id: "o1" });
    assert.deepEqual(await row, { type: "AmwayOffer", id: "o1" });
    const pending = client.call("echo", "say", { text: "late" });
    client.fail(new Error("worker crashed"));
    await assert.rejects(pending, /worker crashed/);
  } finally { port1.close(); port2.close(); }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd /Users/gecko/src/projektor && node --test packages/amway.lab/port-ipc.test.js`
Expected: FAIL, `Cannot find module '.../port-ipc.js'`.

If it instead fails on the refinio.api import, run `cd /Users/gecko/src/one/packages/refinio.api && ls dist/src/transports/IpcTransport.js dist/src/registry/index.js`. If they are missing, build refinio.api (`pnpm --dir /Users/gecko/src/one --filter @refinio/api build`) before continuing.

- [x] **Step 3: Write minimal implementation**

```js
// packages/amway.lab/port-ipc.js
/**
 * refinio.api over a MessagePort. The worker side is an `ipcMain`-shaped
 * object for the existing IpcTransport; the host side is a thin client for
 * its `handler:*` channels. Feed-forward rows and control messages share the
 * port but never the request/response path.
 */

export function createPortIpcMain(port) {
  const handlers = new Map();
  port.addEventListener("message", async event => {
    const message = event.data;
    if (message?.kind !== "ipc-invoke") return;
    const handler = handlers.get(message.channel);
    if (!handler) {
      port.postMessage({ kind: "ipc-result", id: message.id, ok: false, error: `No IPC handler for ${message.channel}` });
      return;
    }
    try {
      const value = await handler({ sender: "lab-host" }, ...message.args);
      port.postMessage({ kind: "ipc-result", id: message.id, ok: true, value });
    } catch (error) {
      port.postMessage({ kind: "ipc-result", id: message.id, ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  });
  port.start?.();
  return {
    handle(channel, fn) {
      if (handlers.has(channel)) throw new Error(`IPC handler ${channel} is already registered.`);
      handlers.set(channel, fn);
    },
  };
}

export function postFeed(port, row) {
  port.postMessage({ kind: "feed", row });
}

export class PortApiClient {
  #port;
  #seq = 0;
  #pending = new Map();
  #feed = new Set();
  #control = new Set();

  constructor(port) {
    this.#port = port;
    port.addEventListener("message", event => this.#route(event.data));
    port.start?.();
  }

  #route(message) {
    if (message?.kind === "ipc-result") {
      const task = this.#pending.get(message.id);
      if (!task) throw new Error(`Lab IPC: result for unknown call ${message.id}.`);
      this.#pending.delete(message.id);
      if (message.ok) task.resolve(message.value);
      else task.reject(new Error(message.error));
      return;
    }
    if (message?.kind === "feed") {
      for (const callback of this.#feed) callback(message.row);
      return;
    }
    for (const callback of this.#control) callback(message);
  }

  #invoke(channel, ...args) {
    const id = (this.#seq += 1);
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#port.postMessage({ kind: "ipc-invoke", id, channel, args });
    });
  }

  async call(handler, method, params = {}) {
    const response = await this.#invoke("handler:call", { handler, method, params });
    if (!response.success) throw new Error(`${handler}.${method}: ${response.error}`);
    return response.data;
  }

  list() {
    return this.#invoke("handler:list");
  }

  onFeed(callback) {
    this.#feed.add(callback);
    return () => this.#feed.delete(callback);
  }

  onControl(callback) {
    this.#control.add(callback);
    return () => this.#control.delete(callback);
  }

  fail(error) {
    for (const task of this.#pending.values()) task.reject(error);
    this.#pending.clear();
  }
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cd /Users/gecko/src/projektor && node --test packages/amway.lab/port-ipc.test.js`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
cd /Users/gecko/src/projektor
git add packages/amway.lab/port-ipc.js packages/amway.lab/port-ipc.test.js
git commit -m "feat(amway.lab): expose refinio.api registries over MessagePort IPC"
```

---

### Task 6: `amwayLab` plan over ONE storage

**Files:**
- Create: `packages/amway.lab/lab-plan.js`
- Test: covered by `packages/amway.lab/lab.integration.test.js` (Task 8). This plan needs a live ONE instance, and one Node realm holds only one instance, so its behaviour is verified across workers.

**Interfaces:**
- Consumes:
  - Task 3 constructors
  - Task 4 `rolesOf`, `canPublish`, `audience`, `projectDepartment`
  - one.core `storeVersionedObject(obj)` → `{ obj, hash, idHash }`
  - `getObjectByIdHash(idHash)` → `{ obj, hash, idHash }`
  - `calculateIdHashOfObj(obj)`
  - `getAllIdObjectEntries(targetIdHash, type)` → `idHash[]`
  - `createAccess([{ id, person, hashGroup: [], mode: SET_ACCESS_MODE.ADD }])`
  - `getInstanceOwnerIdHash()`
- Produces: `createLabPlan({ connections, now })` → a plan object with these methods (all params plain objects, all return JSON-safe data):
  - `whoAmI()` → `{ person }`
  - `createDepartment({ department, name })` → `{ departmentIdHash }` (caller becomes admin)
  - `assignRole({ department, subject, role })` → `{ idHash }`. It re-grants every existing department object to the full audience.
  - `publishContact({ department, name, role })` → `{ idHash }` (person = self)
  - `publishOffer({ department, offerId, item, priceList, unitAmount, currency })` → `{ idHash }`
  - `admitOrder({ department, customer, offer, quantity, idempotencyKey })` → `{ idHash }`
  - `getDepartment({ department })` → `projectDepartment(...)` result for the caller, or `{ department, known: false }` when not replicated yet
  - `feedRow(result)` → `{ type, department, id, obj, hash }` or `null` for non-lab types (used by Task 7's feed)
  - `setOnline({ online })` → `{ online }`. It calls `connections.enableAllConnections()` / `connections.disableAllConnections()`.

- [x] **Step 1: Write the implementation** (TDD happens at integration level in Task 8; write Task 8's test first if you execute out of order)

```js
// packages/amway.lab/lab-plan.js
/**
 * The lab's domain plan. Writes are ONE versioned objects whose disclosure is
 * a sender-side access grant to the projected audience; CHUM carries them.
 * Reads enumerate a department through its id-object reverse map and
 * re-project authority locally. Nothing here knows about other workers.
 */
import { storeVersionedObject, getObjectByIdHash, hasVersionHead } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { calculateIdHashOfObj } from "../../../one/packages/one.core/lib/util/object.js";
import { getAllIdObjectEntries } from "../../../one/packages/one.core/lib/reverse-map-query.js";
import { createAccess } from "../../../one/packages/one.core/lib/access.js";
import { SET_ACCESS_MODE } from "../../../one/packages/one.core/lib/storage-base-common.js";
import { getInstanceOwnerIdHash } from "../../../one/packages/one.core/lib/instance.js";
import { AMWAY_LAB_TYPES, createContact, createDepartment, createOffer, createOrder, createRoleAssignment } from "./recipes.js";
import { LAB_STOCK, audience, canPublish, projectDepartment } from "./projection.js";

const KIND_OF_TYPE = { AmwayDepartment: "department", AmwayRoleAssignment: "assignment", AmwayContact: "contact", AmwayOffer: "offer", AmwayOrder: "order" };
const ID_FIELD = { AmwayDepartment: "department", AmwayRoleAssignment: "subject", AmwayContact: "person", AmwayOffer: "offerId", AmwayOrder: "idempotencyKey" };

export function createLabPlan({ connections, now = () => Date.now() }) {
  const self = () => {
    const owner = getInstanceOwnerIdHash();
    if (!owner) throw new Error("Amway lab: instance has no owner.");
    return owner;
  };

  const departmentIdHash = department =>
    calculateIdHashOfObj({ $type$: "AmwayDepartment", department, name: "", admin: "0".repeat(64) });

  async function latest(idHashes) {
    return Promise.all(idHashes.map(async idHash => (await getObjectByIdHash(idHash)).obj));
  }

  async function load(department) {
    const deptIdHash = await departmentIdHash(department);
    const [assignments, contacts, offers, orders] = await Promise.all(
      ["AmwayRoleAssignment", "AmwayContact", "AmwayOffer", "AmwayOrder"].map(async type =>
        latest(await getAllIdObjectEntries(deptIdHash, type))),
    );
    // Not yet replicated is a normal state, asked explicitly — no error swallowing.
    if (!(await hasVersionHead(deptIdHash))) {
      return { deptIdHash, department: null, assignments, contacts, offers, orders };
    }
    const departmentObj = (await getObjectByIdHash(deptIdHash)).obj;
    return { deptIdHash, department: departmentObj, assignments, contacts, offers, orders };
  }

  async function grant(idHash, people) {
    await createAccess([{ id: idHash, person: people, hashGroup: [], mode: SET_ACCESS_MODE.ADD }]);
  }

  async function requireDepartment(department) {
    const state = await load(department);
    if (!state.department) throw new Error(`Amway lab: department ${department} has not reached this instance.`);
    return state;
  }

  async function publish(kind, state, obj, subject) {
    const author = self();
    if (!canPublish(kind, { department: state.department, assignments: state.assignments, author, subject, atTime: now() })) {
      throw new Error(`Amway lab: ${author} may not publish ${kind} in ${state.department.department}.`);
    }
    const stored = await storeVersionedObject(obj);
    await grant(stored.idHash, audience(kind, { department: state.department, assignments: state.assignments, row: obj }));
    return { idHash: stored.idHash };
  }

  return {
    whoAmI() {
      return { person: self() };
    },

    async createDepartment({ department, name }) {
      const stored = await storeVersionedObject(createDepartment({ department, name, admin: self() }));
      await grant(stored.idHash, [self()]);
      return { departmentIdHash: stored.idHash };
    },

    async assignRole({ department, subject, role }) {
      const state = await requireDepartment(department);
      const obj = createRoleAssignment({ department: state.deptIdHash, subject, role, issuer: self(), validFrom: now() });
      if (role === "manager" && self() !== state.department.admin) {
        throw new Error("Amway lab: only the department admin may appoint managers.");
      }
      const result = await publish("assignment", state, obj, subject);
      const next = await requireDepartment(department);
      const everyone = audience("assignment", { department: next.department, assignments: next.assignments, row: obj });
      await grant(next.deptIdHash, everyone);
      for (const type of ["AmwayRoleAssignment", "AmwayContact", "AmwayOffer"]) {
        for (const idHash of await getAllIdObjectEntries(next.deptIdHash, type)) await grant(idHash, everyone);
      }
      for (const idHash of await getAllIdObjectEntries(next.deptIdHash, "AmwayOrder")) {
        const order = (await getObjectByIdHash(idHash)).obj;
        await grant(idHash, audience("order", { department: next.department, assignments: next.assignments, row: order }));
      }
      return result;
    },

    async publishContact({ department, name, role }) {
      const state = await requireDepartment(department);
      const obj = createContact({ department: state.deptIdHash, person: self(), name, role, publishedBy: self(), publishedAt: now() });
      return publish("contact", state, obj, self());
    },

    async publishOffer({ department, offerId, item, priceList, unitAmount, currency }) {
      const state = await requireDepartment(department);
      const obj = createOffer({ department: state.deptIdHash, offerId, item, priceList, channel: "facility", unitAmount, currency, publishedBy: self() });
      return publish("offer", state, obj);
    },

    async admitOrder({ department, customer, offer, quantity, idempotencyKey }) {
      const state = await requireDepartment(department);
      if (!state.offers.some(entry => entry.offerId === offer)) {
        throw new Error(`Amway lab: offer ${offer} is not known in ${department}.`);
      }
      const obj = createOrder({
        department: state.deptIdHash, idempotencyKey: idempotencyKey ?? `lab-order-${now()}`,
        customer, seller: self(), offer, quantity, lot: LAB_STOCK.lot, facility: LAB_STOCK.facility, admittedAt: now(),
      });
      return publish("order", state, obj, customer);
    },

    async getDepartment({ department }) {
      const state = await load(department);
      if (!state.department) return { department, known: false };
      return { known: true, ...projectDepartment({ ...state, department: state.department, viewer: self(), atTime: now() }) };
    },

    feedRow(result) {
      const type = result.obj.$type$;
      if (!AMWAY_LAB_TYPES.includes(type)) return null;
      return { type, kind: KIND_OF_TYPE[type], id: result.obj[ID_FIELD[type]], department: result.obj.department, idHash: result.idHash, hash: result.hash, obj: result.obj };
    },

    async setOnline({ online }) {
      if (online) await connections.enableAllConnections();
      else await connections.disableAllConnections();
      return { online };
    },
  };
}
```

`hasVersionHead(idHash)` (`one.core/src/storage-versioned-objects.ts:1738`) is one.core's explicit existence check for a version head. `getObjectByIdHash` offers no "missing" result: it throws `FileNotFoundError` from `getCurrentVersionNode`.

`departmentIdHash` hashes id properties only. `department` is the only `isId` field of `AmwayDepartment` (Task 3), so the placeholder `name`/`admin` values don't affect the hash.

- [x] **Step 2: Syntax check**

Run: `cd /Users/gecko/src/projektor && node --check packages/amway.lab/lab-plan.js`
Expected: exits 0.

- [x] **Step 3: Commit**

```bash
cd /Users/gecko/src/projektor
git add packages/amway.lab/lab-plan.js
git commit -m "feat(amway.lab): add amwayLab plan over ONE storage with sender-side grants"
```

---

### Task 7: Lab instance boot (models, registry, dialer, feed)

**Files:**
- Create: `packages/amway.lab/lab-instance.js`
- Create: `packages/amway.lab/test/node-worker.js`

**Interfaces:**
- Consumes:
  - Task 1 `registerConnectionDialer` (`one.models/lib/misc/ConnectionEstablishment/ConnectionDialers.js`)
  - Task 2 `MessagePortPlugin`
  - Task 5 `createPortIpcMain`, `postFeed`
  - Task 6 `createLabPlan`
  - refinio.api `OneConnectionPlan(leuteModel, connectionsModel, channelManager)` from `refinio.api/dist/src/plans/OneConnectionPlan.js`
  - one.core `onVersionedObjStored`
- Produces:
  - `startLabInstance({ port, key, email, secret, directory, createMessageChannel })` → `Promise<{ shutdown(): Promise<void> }>`
  - **Control protocol, worker → host:**
    - `{kind: "ready", key, person}`
    - `{kind: "boot-failed", key, error}`
    - `{kind: "chum-dial", from: key, url, port}` (port transferred)
  - **Host → worker:** `{kind: "chum-accept", url, port}` (port transferred), which the worker passes to `connectionsModel.acceptExternalConnection(Connection.fromPlugin(new MessagePortPlugin(port)), url)`.
  - **Registry plans:** `amwayLab` (Task 6) and `connection` (`OneConnectionPlan`: `createInvite`, `connectWithInvite`, `listConnections`, `getStatus`).
  - **Feed:** every `onVersionedObjStored` result of a lab type → `postFeed(port, plan.feedRow(result))`.
  - `test/node-worker.js`: `worker_threads` entry. It reads `workerData = { key, directory }`, loads `one.core/lib/system/load-nodejs.js`, and calls `startLabInstance` with `parentPort`.

- [x] **Step 1: Write `lab-instance.js`**

```js
// packages/amway.lab/lab-instance.js
/**
 * One ONE instance per worker realm. The caller loads the one.core platform
 * (browser or nodejs) before importing this module's dependencies' side
 * effects run; this module only composes models, the refinio.api registry,
 * the `lab:` dialer and the feed-forward stream on the given port.
 */
import MultiUser from "../../../one/packages/one.models/lib/models/Authenticator/MultiUser.js";
import LeuteModel from "../../../one/packages/one.models/lib/models/Leute/LeuteModel.js";
import ChannelManager from "../../../one/packages/one.models/lib/models/ChannelManager.js";
import ConnectionsModel from "../../../one/packages/one.models/lib/models/ConnectionsModel.js";
import Connection from "../../../one/packages/one.models/lib/misc/Connection/Connection.js";
import MessagePortPlugin from "../../../one/packages/one.models/lib/misc/Connection/plugins/MessagePortPlugin.js";
import { registerConnectionDialer } from "../../../one/packages/one.models/lib/misc/ConnectionEstablishment/ConnectionDialers.js";
import { objectEvents } from "../../../one/packages/one.models/lib/misc/ObjectEventDispatcher.js";
import RecipesStable from "../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import { ReverseMapsStable, ReverseMapsForIdObjectsStable } from "../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } from "../../../one/packages/one.models/lib/recipes/reversemaps-experimental.js";
import { onVersionedObjStored } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { getInstanceOwnerIdHash } from "../../../one/packages/one.core/lib/instance.js";
import { OperationRegistry } from "../../../one/packages/refinio.api/dist/src/registry/index.js";
import { IpcTransport } from "../../../one/packages/refinio.api/dist/src/transports/IpcTransport.js";
import { OneConnectionPlan } from "../../../one/packages/refinio.api/dist/src/plans/OneConnectionPlan.js";
import { AmwayLabRecipes, AmwayLabReverseMapsForIdObjects } from "./recipes.js";
import { createLabPlan } from "./lab-plan.js";
import { createPortIpcMain, postFeed } from "./port-ipc.js";

export const labUrl = key => `lab://${key}`;

function merge(...sources) {
  const merged = new Map();
  for (const source of sources) {
    for (const [type, props] of source) merged.set(type, new Set([...(merged.get(type) ?? []), ...props]));
  }
  return merged;
}

export async function startLabInstance({ port, key, email, secret, directory, createMessageChannel }) {
  const url = labUrl(key);
  const multiUser = new MultiUser({
    directory,
    recipes: [...RecipesStable, ...RecipesExperimental, ...AmwayLabRecipes],
    reverseMaps: merge(ReverseMapsStable, ReverseMapsExperimental),
    reverseMapsForIdObjects: merge(ReverseMapsForIdObjectsStable, ReverseMapsForIdObjectsExperimental, AmwayLabReverseMapsForIdObjects),
  });
  await multiUser.loginOrRegister(email, secret, key);
  await objectEvents.init();

  // The instance endpoint published in our profile is the lab URL: peers'
  // outgoing routes dial it through the `lab:` dialer below.
  const leuteModel = new LeuteModel(url, true);
  const channelManager = new ChannelManager(leuteModel);
  const connections = new ConnectionsModel(leuteModel, {
    commServerUrl: url,
    publicCommServerUrl: url,
    incomingConnectionConfigurations: [{ type: "external", url }],
    acceptIncomingConnections: true,
    acceptUnknownInstances: false,
    acceptUnknownPersons: false,
    allowPairing: true,
    allowDebugRequests: false,
    pairingTokenExpirationDuration: 600_000,
    establishOutgoingConnections: true,
    noImport: false,
    noExport: false,
  });
  await leuteModel.init();
  await channelManager.init();
  await connections.init();
  await connections.waitForIncomingConnectionReady();

  const unregisterDialer = registerConnectionDialer("lab:", target => {
    const { port1, port2 } = createMessageChannel();
    port.postMessage({ kind: "chum-dial", from: key, url: target, port: port2 }, [port2]);
    return Connection.fromPlugin(new MessagePortPlugin(port1));
  });

  const plan = createLabPlan({ connections });
  const registry = new OperationRegistry();
  registry.register("amwayLab", plan, {
    description: "Amway lab department operations over ONE storage",
    methods: ["whoAmI", "createDepartment", "assignRole", "publishContact", "publishOffer", "admitOrder", "getDepartment", "setOnline"]
      .map(name => ({ name, description: `amwayLab.${name}` })),
  });
  registry.register("connection", new OneConnectionPlan(leuteModel, connections, channelManager), {
    description: "Pairing and connection status",
    methods: ["createInvite", "connectWithInvite", "listConnections", "getStatus"].map(name => ({ name, description: `connection.${name}` })),
  });
  new IpcTransport(registry).register(createPortIpcMain(port));

  const stopFeed = onVersionedObjStored.addListener(result => {
    const row = plan.feedRow(result);
    if (row) postFeed(port, row);
  });

  port.addEventListener("message", event => {
    const message = event.data;
    if (message?.kind !== "chum-accept") return;
    if (message.url !== url) throw new Error(`Lab ${key}: accept for foreign url ${message.url}.`);
    connections.acceptExternalConnection(Connection.fromPlugin(new MessagePortPlugin(message.port)), url)
      .catch(error => port.postMessage({ kind: "chum-accept-failed", key, error: error.message }));
  });

  port.postMessage({ kind: "ready", key, person: getInstanceOwnerIdHash() });

  return {
    async shutdown() {
      stopFeed();
      unregisterDialer();
      await connections.shutdown();
      await channelManager.shutdown();
      await leuteModel.shutdown();
      await multiUser.logout();
    },
  };
}
```

These APIs are confirmed against the sources:
- `onVersionedObjStored` is a `OneEventSourceConsumer`: `addListener(cb)` returns its remover (`one.core/src/util/one-event-source.ts:103`).
- `ConnectionsModel.shutdown`, `ChannelManager.shutdown`, `LeuteModel.shutdown` and `Authenticator.logout` exist.
- `recipes-experimental` has a default export.
- `OneConnectionPlan` methods take one request object (`connectWithInvite({ url, publicKey, token, timeoutMs? })`, `connectDirect({ websocketUrl, remotePublicKey, connectionGroupName? })`), so `registry.call` params reach them unchanged. This was fixed in refinio.api on 2026-09-15; see its `OneConnectionPlan.test.ts` registry tests.

- [x] **Step 2: Write `test/node-worker.js`**

```js
// packages/amway.lab/test/node-worker.js
import "../../../../one/packages/one.core/lib/system/load-nodejs.js";
import { MessageChannel, parentPort, workerData } from "node:worker_threads";
import { startLabInstance } from "../lab-instance.js";

try {
  await startLabInstance({
    port: parentPort,
    key: workerData.key,
    email: `${workerData.key}@lab.local`,
    secret: `lab-${workerData.key}`,
    directory: workerData.directory,
    createMessageChannel: () => new MessageChannel(),
  });
} catch (error) {
  parentPort.postMessage({ kind: "boot-failed", key: workerData.key, error: error instanceof Error ? error.stack : String(error) });
}
```

`parentPort` in `worker_threads` is a `MessagePort` and supports `addEventListener("message")` with `event.data`. It also supports `postMessage(message, transferList)`. The browser `DedicatedWorkerGlobalScope` has the same shape.

- [x] **Step 3: Syntax check**

Run: `cd /Users/gecko/src/projektor && node --check packages/amway.lab/lab-instance.js && node --check packages/amway.lab/test/node-worker.js`
Expected: exits 0.

- [x] **Step 4: Commit**

```bash
cd /Users/gecko/src/projektor
git add packages/amway.lab/lab-instance.js packages/amway.lab/test/node-worker.js
git commit -m "feat(amway.lab): boot one ONE instance per worker with lab: dialer and feed"
```

---

### Task 8: Four-worker CHUM integration test with host switch

**Files:**
- Create: `packages/amway.lab/host-switch.js`
- Test: `packages/amway.lab/lab.integration.test.js`
- Modify: `package.json` (root), adding the `test:amway-lab` script

**Interfaces:**
- Consumes: Task 5 `PortApiClient`; the Task 7 control protocol.
- Produces: `startLabHost({ keys, spawn })` → `Promise<{ clients: Record<key, PortApiClient>, persons: Record<key, personIdHash>, setSwitch(key, open: boolean), pairAll(): Promise<void>, stop(): Promise<void> }>`. `spawn(key)` returns `{ port, terminate(), onError(cb) }`.
  - **Switch rule:** on `chum-dial {url, port}`, if the target key is known and open, post `{kind: "chum-accept", url, port}` to the target with transfer `[port]`. Otherwise post `{t: "close", reason: "lab host: <key> unreachable"}` on the port and close it.
  - `pairAll()`: for each unordered pair (a, b) of keys in order, call `a.connection.createInvite`, then `b.connection.connectWithInvite({url, publicKey, token})`.

This file is environment-neutral JS, so the browser `LabHost` in Task 9 imports it too.

`OneConnectionPlan` is registered as-is (Task 7): its methods take the registry's params object directly.

- [x] **Step 1: Write the failing integration test**

```js
// packages/amway.lab/lab.integration.test.js
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { Worker } from "node:worker_threads";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { startLabHost } from "./host-switch.js";

const KEYS = ["admin", "manager", "seller", "customer"];
let root;
let host;

function feedUntil(client, predicate, label) {
  return new Promise((resolve, reject) => {
    const guard = setTimeout(() => { off(); reject(new Error(`feed never delivered: ${label}`)); }, 30_000);
    const off = client.onFeed(row => {
      if (!predicate(row)) return;
      clearTimeout(guard);
      off();
      resolve(row);
    });
  });
}

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "amway-lab-"));
  host = await startLabHost({
    keys: KEYS,
    spawn: key => {
      const worker = new Worker(new URL("./test/node-worker.js", import.meta.url), { workerData: { key, directory: path.join(root, key) } });
      // node:worker_threads Worker is an EventEmitter without addEventListener
      // (verified on Node 23); present the browser Worker's port shape.
      const port = {
        postMessage: (message, transfer) => worker.postMessage(message, transfer),
        addEventListener: (_type, listener) => worker.on("message", data => listener({ data })),
        removeEventListener: () => { throw new Error("lab host never removes worker listeners"); },
        start() {},
        close() {},
      };
      return { port, terminate: () => worker.terminate(), onError: cb => worker.on("error", cb) };
    },
  });
  await host.pairAll();
  const { admin, manager } = host.clients;
  // Disclosure follows authority: the manager receives the department with
  // its own assignment; seller and customer only once the manager assigns them.
  const managerAppointed = feedUntil(manager, row => row.type === "AmwayRoleAssignment" && row.id === host.persons.manager, "manager receives appointment");
  await admin.call("amwayLab", "createDepartment", { department: "demo-de", name: "Demo DE" });
  await admin.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.manager, role: "manager" });
  await managerAppointed;
  const membersReached = ["seller", "customer"].map(key =>
    feedUntil(host.clients[key], row => row.type === "AmwayDepartment", `${key} receives department`));
  await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.seller, role: "seller" });
  await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.customer, role: "customer" });
  await Promise.all(membersReached);
}, { timeout: 120_000 });

after(async () => {
  await host?.stop();
  if (root) await rm(root, { recursive: true, force: true });
});

test("every worker is paired directly with every other", async () => {
  for (const key of KEYS) {
    const status = await host.clients[key].call("connection", "getStatus", {});
    assert.equal(status.totalConnections, KEYS.length - 1, `${key} connections`);
  }
});

test("an offer published by the manager arrives by CHUM at every member", async () => {
  const arrivals = ["admin", "seller", "customer"].map(key =>
    feedUntil(host.clients[key], row => row.type === "AmwayOffer" && row.id === "lab-offer-1", `${key} offer`));
  await host.clients.manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-1", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const rows = await Promise.all(arrivals);
  assert.equal(new Set(rows.map(row => row.hash)).size, 1, "every worker holds the exact same version");
  const seen = await host.clients.seller.call("amwayLab", "getDepartment", { department: "demo-de" });
  assert.ok(seen.offers.some(entry => entry.offerId === "lab-offer-1"));
});

test("a seller cannot publish offers", async () => {
  await assert.rejects(
    host.clients.seller.call("amwayLab", "publishOffer", {
      department: "demo-de", offerId: "nope", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 1, currency: "EUR",
    }),
    /may not publish offer/,
  );
});

test("orders reach the customer they are for", async () => {
  // Runs after the offer test (node:test runs top-level tests in order), so
  // lab-offer-1 is already materialized on the seller.
  const toCustomer = feedUntil(host.clients.customer, row => row.type === "AmwayOrder" && row.id === "lab-order-t1", "customer order");
  await host.clients.seller.call("amwayLab", "admitOrder", {
    department: "demo-de", customer: host.persons.customer, offer: "lab-offer-1", quantity: 2, idempotencyKey: "lab-order-t1",
  });
  await toCustomer;
  const view = await host.clients.customer.call("amwayLab", "getDepartment", { department: "demo-de" });
  assert.deepEqual(view.orders.map(entry => entry.idempotencyKey), ["lab-order-t1"]);
  assert.equal(view.availability.available, 8);
});

test("a paused worker catches up after resume", async () => {
  await host.clients.customer.call("amwayLab", "setOnline", { online: false });
  host.setSwitch("customer", false);
  await host.clients.manager.call("amwayLab", "publishOffer", {
    department: "demo-de", offerId: "lab-offer-2", item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR",
  });
  const before = await host.clients.customer.call("amwayLab", "getDepartment", { department: "demo-de" });
  assert.equal(before.offers.some(entry => entry.offerId === "lab-offer-2"), false);
  const caughtUp = feedUntil(host.clients.customer, row => row.type === "AmwayOffer" && row.id === "lab-offer-2", "customer catch-up");
  host.setSwitch("customer", true);
  await host.clients.customer.call("amwayLab", "setOnline", { online: true });
  await caughtUp;
});
```

- [x] **Step 2: Write `host-switch.js`**

```js
// packages/amway.lab/host-switch.js
/**
 * The web host's only job between workers: switch `lab:` dials to the
 * target worker's port. Shared by the node integration test and the browser
 * LabHost; it never reads Amway data.
 */
import { PortApiClient } from "./port-ipc.js";

export async function startLabHost({ keys, spawn }) {
  const workers = new Map();
  const open = new Map(keys.map(key => [key, true]));
  const clients = {};
  const persons = {};

  const ready = keys.map(key => new Promise((resolve, reject) => {
    const handle = spawn(key);
    const client = new PortApiClient(handle.port);
    workers.set(key, handle);
    clients[key] = client;
    handle.onError(error => {
      client.fail(error);
      reject(error);
    });
    client.onControl(message => {
      if (message?.kind === "ready") {
        persons[key] = message.person;
        resolve();
      } else if (message?.kind === "boot-failed") {
        reject(new Error(`Lab ${key} failed to boot: ${message.error}`));
      } else if (message?.kind === "chum-accept-failed") {
        throw new Error(`Lab ${key} rejected an incoming connection: ${message.error}`);
      } else if (message?.kind === "chum-dial") {
        switchDial(message);
      }
    });
  }));

  function switchDial({ from, url, port }) {
    const target = new URL(url).host;
    const handle = workers.get(target);
    if (!handle || !open.get(target) || !open.get(from)) {
      port.postMessage({ t: "close", reason: `lab host: ${target} unreachable from ${from}` });
      port.close();
      return;
    }
    handle.port.postMessage({ kind: "chum-accept", url, port }, [port]);
  }

  await Promise.all(ready);

  return {
    clients,
    persons,
    setSwitch(key, value) {
      if (!open.has(key)) throw new Error(`Lab host: unknown worker ${key}.`);
      open.set(key, value);
    },
    async pairAll() {
      for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
          const invite = await clients[keys[i]].call("connection", "createInvite", {});
          await clients[keys[j]].call("connection", "connectWithInvite", {
            url: invite.url, publicKey: invite.publicKey, token: invite.token,
          });
        }
      }
    },
    async stop() {
      await Promise.all([...workers.values()].map(handle => handle.terminate()));
    },
  };
}
```

Inside the thread, `parentPort` is a real `MessagePort` with `addEventListener` (verified on Node 23). The `Worker` object on the host side is not, which is why `spawn` in the test wraps it.

- [x] **Step 3: Add the script and run the test to verify it fails, then passes**

In the root `package.json` `scripts`, add:

```json
    "test:amway-lab": "node --test ./packages/amway.lab/*.test.js",
```

Also append ` && npm run test:amway-lab` to the end of the existing `"test"` script.

Run: `cd /Users/gecko/src/projektor && node --test --test-timeout=180000 packages/amway.lab/lab.integration.test.js`
Expected before Tasks 6–7 are complete: FAIL on boot or pairing. Expected after: PASS (5 tests).

If pairing fails, debug with `ONE_DEBUG` logs from one.core's `startLogger()` (add `import { startLogger } from "../../../../one/packages/one.core/lib/logger.js"; startLogger();` to `test/node-worker.js` temporarily). Do not add retries or sleeps. The likely failure points, in order:
1. The external listener is not registered before `acceptExternalConnection`. Check that `waitForIncomingConnectionReady` passed.
2. The invitation URL is not `lab://<key>`. Log `invite.url`.
3. Access rights on the accepting side: the pairing acceptor must grant profile access (see `grantAccessRightsAfterPairing` in `refinio.api/src/helpers/AccessRightsHelper.ts`). If only the initiator grants, call the same helper from `connections.pairing.onPairingSuccess` inside `lab-instance.js`.

- [x] **Step 4: Run the full amway.lab suite**

Run: `cd /Users/gecko/src/projektor && npm run test:amway-lab`
Expected: PASS (recipes 4, projection 4, port-ipc 3, integration 5).

- [x] **Step 5: Commit**

```bash
cd /Users/gecko/src/projektor
git add package.json packages/amway.lab/host-switch.js packages/amway.lab/lab.integration.test.js
git commit -m "test(amway.lab): four workers pair and sync by CHUM through a host switch"
```

---

### Task 9: Browser worker entry and LabHost

**Files:**
- Rewrite: `packages/projektor.browser/src/lab/worker.ts`
- Rewrite: `packages/projektor.browser/src/lab/transport.ts`
- Modify: `packages/projektor.browser/vite.config.ts`

**Interfaces:**
- Consumes: Task 7 `startLabInstance`; Task 8 `startLabHost`; Task 5 `PortApiClient`.
- Produces:
  - `transport.ts` exports `LAB_KEYS = ["admin", "manager", "seller", "customer"] as const`, `type LabKey`, and `bootLab(): Promise<LabHandle>`.
  - `LabHandle = { clients: Record<LabKey, PortApiClient>; persons: Record<LabKey, string>; setSwitch(key: LabKey, open: boolean): void; stop(): Promise<void> }`.
  - `bootLab` pairs the full mesh and seeds the department: admin creates `demo-de`, appoints the manager, and the manager assigns seller and customer. It resolves only after every worker has fed back the `AmwayDepartment` row.

- [x] **Step 1: Rewrite `worker.ts`**

```ts
// packages/projektor.browser/src/lab/worker.ts
/**
 * Browser Web Worker entry for one lab instance. The platform import must run
 * before anything touches one.core storage.
 */
import "@refinio/one.core/lib/system/load-browser.js";
import { startLabInstance } from "@projektor/amway.lab/lab-instance.js";

const scope = self as unknown as DedicatedWorkerGlobalScope;
const params = new URL(scope.location.href).searchParams;
const key = params.get("key");
if (!key) throw new Error("Lab worker started without ?key=");

startLabInstance({
  port: scope,
  key,
  email: `${key}@lab.local`,
  secret: `lab-${key}`,
  directory: `amway-lab-${key}`,
  createMessageChannel: () => new MessageChannel(),
}).catch(error => {
  scope.postMessage({ kind: "boot-failed", key, error: error instanceof Error ? error.stack : String(error) });
});
```

- [x] **Step 2: Rewrite `transport.ts`**

```ts
// packages/projektor.browser/src/lab/transport.ts
/**
 * Web host side of the lab: spawns one Worker per role, switches `lab:` dials
 * between them, and hands the UI a refinio.api client per worker. Amway data
 * never passes through here; only CHUM ports and IPC calls do.
 */
import { startLabHost } from "@projektor/amway.lab/host-switch.js";
import type { PortApiClient } from "@projektor/amway.lab/port-ipc.js";

export const LAB_KEYS = ["admin", "manager", "seller", "customer"] as const;
export type LabKey = (typeof LAB_KEYS)[number];

export interface LabHandle {
  clients: Record<LabKey, PortApiClient>;
  persons: Record<LabKey, string>;
  setSwitch(key: LabKey, open: boolean): void;
  stop(): Promise<void>;
}

function waitForRow(client: PortApiClient, match: (row: { type: string; id: string }) => boolean): Promise<void> {
  return new Promise(resolve => {
    const off = client.onFeed((row: { type: string; id: string }) => {
      if (!match(row)) return;
      off();
      resolve();
    });
  });
}

export async function bootLab(): Promise<LabHandle> {
  const host = await startLabHost({
    keys: [...LAB_KEYS],
    spawn: (key: LabKey) => {
      const url = new URL("./worker.ts", import.meta.url);
      url.searchParams.set("key", key);
      const worker = new Worker(url, { type: "module", name: `lab-${key}` });
      return {
        port: worker,
        terminate: async () => worker.terminate(),
        onError: (cb: (error: Error) => void) => worker.addEventListener("error", event => cb(new Error(event.message))),
      };
    },
  });
  const { admin, manager } = host.clients;
  // Pairings and the department persist in each worker's IndexedDB; seed once.
  const status = await admin.call("amwayLab", "getDepartment", { department: "demo-de" });
  if (!status.known) {
    await host.pairAll();
    const appointed = waitForRow(manager, row => row.type === "AmwayRoleAssignment" && row.id === host.persons.manager);
    await admin.call("amwayLab", "createDepartment", { department: "demo-de", name: "Demo DE" });
    await admin.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.manager, role: "manager" });
    await appointed;
    const members = [host.clients.seller, host.clients.customer].map(client => waitForRow(client, row => row.type === "AmwayDepartment"));
    await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.seller, role: "seller" });
    await manager.call("amwayLab", "assignRole", { department: "demo-de", subject: host.persons.customer, role: "customer" });
    await Promise.all(members);
  }
  return host as LabHandle;
}
```

- [x] **Step 3: Update `vite.config.ts` aliases**

Add these entries before the `"@"` alias:

```ts
      { find: /^@projektor\/amway\.lab\/(.*)$/, replacement: "/Users/gecko/src/projektor/packages/amway.lab/$1" },
      { find: /^@refinio\/api\/(.*)$/, replacement: `${ONE}/refinio.api/dist/src/$1` },
```

Add a top-level `worker: { format: "es" }` to `defineConfig`.

The amway.lab modules import one.core, one.models and refinio.api by relative path (`../../../one/packages/...`). They must resolve to the same files as the `@refinio/one.core` alias used by `worker.ts`, otherwise two copies of one.core would load in one worker. Verify in Step 4.

- [x] **Step 4: Build and check for a single one.core copy**

Run: `cd /Users/gecko/src/projektor/packages/projektor.browser && npm run build 2>&1 | tail -20`
Expected: build exits 0 and emits a `dist/assets/worker-*.js` chunk.

Run: `grep -c "function initInstance" dist/assets/worker-*.js`
Expected: `1`. A count greater than 1 means one.core is bundled twice. Fix it by changing the amway.lab imports to the `@refinio/one.core/lib/...` / `@refinio/one.models/lib/...` / `@refinio/api/...` specifiers, and give Node the same resolution via `packages/amway.lab/package.json` `"imports"` mappings:

```json
  "imports": {
    "#one.core/*": "../../../one/packages/one.core/lib/*",
    "#one.models/*": "../../../one/packages/one.models/lib/*",
    "#refinio.api/*": "../../../one/packages/refinio.api/dist/src/*"
  }
```

Then add matching Vite aliases `/^#one\.core\/(.*)$/` etc. If you apply this, rerun `npm run test:amway-lab` so the Node side still passes.

- [x] **Step 5: Commit**

```bash
cd /Users/gecko/src/projektor
git add packages/projektor.browser/src/lab/worker.ts packages/projektor.browser/src/lab/transport.ts packages/projektor.browser/vite.config.ts packages/amway.lab
git commit -m "feat(lab): browser workers host ONE instances behind a port-switching web host"
```

---

### Task 10: Feed-forward Lab UI

**Files:**
- Rewrite: `packages/projektor.browser/src/lab/Lab.tsx`
- Modify: `packages/projektor.browser/README.md`

**Interfaces:**
- Consumes: Task 9 `bootLab`, `LAB_KEYS`, `LabKey`, `LabHandle`; `PortApiClient.call/onFeed`; the `amwayLab` methods and the `getDepartment` result shape from Tasks 4/6; feed rows `{ type, kind, id, department, idHash, hash, obj }`.
- Produces: the React `Lab` default export. There is no propagation timeline strip and no `propagate()`.
  - **Initial state:** one `getDepartment` snapshot per column after boot, and again after resume.
  - **Updates:** each feed row is patched into that column's state by `(type, id)`. Rows flash for the length of a CSS animation (`@keyframes lab-arrive`), with no JS timer.
  - **Re-query:** a feed row of type `AmwayRoleAssignment` or `AmwayDepartment` triggers one `getDepartment` re-query for that column. Authority changes can re-project other rows.

- [x] **Step 1: Rewrite `Lab.tsx`**

```tsx
// packages/projektor.browser/src/lab/Lab.tsx
import { useEffect, useReducer, useRef, useState } from "react";
import { bootLab, LAB_KEYS, type LabHandle, type LabKey } from "./transport";

const TITLES: Record<LabKey, string> = { admin: "Org admin", manager: "Manager", seller: "Seller", customer: "Customer" };
const DEPARTMENT = "demo-de";

interface Offer { offerId: string; item: string; unitAmount: number; currency: string; publishedBy: string }
interface Contact { person: string; name: string; role: string; publishedBy: string }
interface Order { idempotencyKey: string; customer: string; seller: string; offer: string; quantity: number }
interface View {
  known: boolean; roles: string[]; contacts: Contact[]; offers: Offer[]; orders: Order[];
  availability: { lot: string; facility: string; gross: number; available: number } | null;
  rejected: { type: string; id: string; reason: string }[];
}
interface FeedRow { type: string; kind: string; id: string; hash: string; obj: Record<string, unknown> }

interface Column { online: boolean; view: View; fresh: Record<string, string>; notice: string }
type State = Record<LabKey, Column>;
type Action =
  | { kind: "snapshot"; key: LabKey; view: View }
  | { kind: "feed"; key: LabKey; row: FeedRow }
  | { kind: "online"; key: LabKey; online: boolean }
  | { kind: "notice"; key: LabKey; notice: string };

const EMPTY: View = { known: false, roles: [], contacts: [], offers: [], orders: [], availability: null, rejected: [] };

function upsert<T>(list: T[], item: T, same: (entry: T) => boolean): T[] {
  const index = list.findIndex(same);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function reduce(state: State, action: Action): State {
  const column = state[action.key];
  if (action.kind === "snapshot") return { ...state, [action.key]: { ...column, view: action.view, notice: "" } };
  if (action.kind === "online") return { ...state, [action.key]: { ...column, online: action.online } };
  if (action.kind === "notice") return { ...state, [action.key]: { ...column, notice: action.notice } };
  const { row } = action;
  const view = column.view;
  const fresh = { ...column.fresh, [`${row.type}:${row.id}`]: row.hash };
  if (row.type === "AmwayOffer") {
    const offer = row.obj as unknown as Offer;
    return { ...state, [action.key]: { ...column, fresh, view: { ...view, offers: upsert(view.offers, offer, entry => entry.offerId === offer.offerId) } } };
  }
  if (row.type === "AmwayContact") {
    const contact = row.obj as unknown as Contact;
    return { ...state, [action.key]: { ...column, fresh, view: { ...view, contacts: upsert(view.contacts, contact, entry => entry.person === contact.person) } } };
  }
  if (row.type === "AmwayOrder") {
    const order = row.obj as unknown as Order;
    const orders = upsert(view.orders, order, entry => entry.idempotencyKey === order.idempotencyKey);
    const availability = view.availability
      ? { ...view.availability, available: view.availability.gross - orders.reduce((sum, entry) => sum + entry.quantity, 0) }
      : null;
    return { ...state, [action.key]: { ...column, fresh, view: { ...view, orders, availability } } };
  }
  return { ...state, [action.key]: { ...column, fresh } };
}

function initial(): State {
  return Object.fromEntries(LAB_KEYS.map(key => [key, { online: true, view: EMPTY, fresh: {}, notice: "" }])) as State;
}

export default function Lab() {
  const [state, dispatch] = useReducer(reduce, undefined, initial);
  const [boot, setBoot] = useState<"booting" | "live" | string>("booting");
  const lab = useRef<LabHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    const offs: (() => void)[] = [];
    bootLab().then(async handle => {
      if (cancelled) { await handle.stop(); return; }
      lab.current = handle;
      for (const key of LAB_KEYS) {
        const client = handle.clients[key];
        const snapshot = async () => dispatch({ kind: "snapshot", key, view: await client.call("amwayLab", "getDepartment", { department: DEPARTMENT }) });
        offs.push(client.onFeed((row: FeedRow) => {
          dispatch({ kind: "feed", key, row });
          if (row.type === "AmwayRoleAssignment" || row.type === "AmwayDepartment") {
            snapshot().catch(error => dispatch({ kind: "notice", key, notice: error.message }));
          }
        }));
        await snapshot();
      }
      setBoot("live");
    }).catch(error => setBoot(error instanceof Error ? error.message : String(error)));
    return () => {
      cancelled = true;
      offs.forEach(off => off());
      void lab.current?.stop();
      lab.current = null;
    };
  }, []);

  async function run(key: LabKey, method: string, params: Record<string, unknown>) {
    const handle = lab.current;
    if (!handle) return;
    try {
      await handle.clients[key].call("amwayLab", method, { department: DEPARTMENT, ...params });
    } catch (error) {
      dispatch({ kind: "notice", key, notice: error instanceof Error ? error.message : String(error) });
    }
  }

  async function toggle(key: LabKey) {
    const handle = lab.current;
    if (!handle) return;
    const online = !state[key].online;
    handle.setSwitch(key, online);
    await handle.clients[key].call("amwayLab", "setOnline", { online });
    dispatch({ kind: "online", key, online });
    if (online) dispatch({ kind: "snapshot", key, view: await handle.clients[key].call("amwayLab", "getDepartment", { department: DEPARTMENT }) });
  }

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <style>{"@keyframes lab-arrive { from { background: #fff3bf } to { background: transparent } } .lab-fresh { animation: lab-arrive 2.4s ease-out }"}</style>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "12px 0" }}>
        <h1 style={{ margin: 0 }}>Amway Lab</h1>
        <span style={{ opacity: 0.75 }}>four workers · one ONE instance each · CHUM between workers · host switches ports only</span>
        <a href="#/overview" style={{ marginLeft: "auto" }}>← single-instance UI</a>
      </div>
      {boot !== "live" ? <p className={boot === "booting" ? undefined : "state-denied"}>{boot === "booting" ? "Booting workers and pairing…" : boot}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {LAB_KEYS.map(key => {
          const column = state[key];
          const { view } = column;
          const staff = view.roles.includes("admin") || view.roles.includes("manager");
          const seller = staff || view.roles.includes("seller");
          return (
            <section key={key} aria-label={TITLES[key]} style={{ border: "1px solid #ccc", borderRadius: 8, overflow: "hidden" }}>
              <header style={{ background: "#f4f4f4", padding: "8px 10px", borderBottom: "1px solid #ccc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{TITLES[key]}</strong>
                  <button type="button" className="secondary sm" onClick={() => void toggle(key)} disabled={boot !== "live"}>
                    {column.online ? "● online · pause" : "❚❚ paused · resume"}
                  </button>
                </div>
                <div className="code-cell" style={{ fontSize: 11, wordBreak: "break-all" }}>{lab.current?.persons[key] ?? "—"}</div>
                <div style={{ fontSize: 12 }}>roles: {view.roles.join(", ") || "—"}</div>
              </header>
              <div style={{ padding: "8px 10px" }}>
                {column.notice ? <p className="state-denied">{column.notice}</p> : null}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <button type="button" disabled={!view.known} onClick={() => void run(key, "publishContact", { name: `${TITLES[key]} Kontakt`, role: view.roles[0] ?? "customer" })}>Publish contact</button>
                  <button type="button" disabled={!staff} onClick={() => void run(key, "publishOffer", { offerId: `lab-offer-${key}-${view.offers.length + 1}`, item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR" })}>Publish offer</button>
                  <button type="button" disabled={!seller || view.offers.length === 0} onClick={() => void run(key, "admitOrder", { customer: lab.current?.persons.customer, offer: view.offers[0]?.offerId, quantity: 2 })}>Admit order ×2</button>
                </div>
                <h4 style={{ margin: "8px 0 4px" }}>Contacts ({view.contacts.length})</h4>
                {view.contacts.map(entry => (
                  <div key={`${entry.person}:${column.fresh[`AmwayContact:${entry.person}`] ?? ""}`} className={column.fresh[`AmwayContact:${entry.person}`] ? "lab-fresh" : undefined} style={{ fontSize: 13 }}>
                    <strong>{entry.name}</strong> · {entry.role}
                  </div>
                ))}
                <h4 style={{ margin: "8px 0 4px" }}>Offers ({view.offers.length})</h4>
                {view.offers.map(entry => (
                  <div key={`${entry.offerId}:${column.fresh[`AmwayOffer:${entry.offerId}`] ?? ""}`} className={column.fresh[`AmwayOffer:${entry.offerId}`] ? "lab-fresh" : undefined} style={{ fontSize: 13 }}>
                    <strong>{entry.offerId}</strong> · {(entry.unitAmount / 100).toFixed(2)} {entry.currency}
                  </div>
                ))}
                <h4 style={{ margin: "8px 0 4px" }}>Orders ({view.orders.length})</h4>
                {view.orders.map(entry => (
                  <div key={`${entry.idempotencyKey}:${column.fresh[`AmwayOrder:${entry.idempotencyKey}`] ?? ""}`} className={column.fresh[`AmwayOrder:${entry.idempotencyKey}`] ? "lab-fresh" : undefined} style={{ fontSize: 13 }}>
                    <strong>{entry.idempotencyKey}</strong> · {entry.offer} ×{entry.quantity}
                  </div>
                ))}
                {view.availability ? <p style={{ fontSize: 13 }}>{view.availability.available} of {view.availability.gross} available · {view.availability.lot}</p> : null}
                {view.rejected.length > 0 ? (
                  <details><summary>{view.rejected.length} rejected</summary>
                    {view.rejected.map(entry => <div key={`${entry.type}:${entry.id}`} className="code-cell" style={{ fontSize: 11 }}>{entry.type} {entry.id}: {entry.reason}</div>)}
                  </details>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
```

Keys embed the row hash, so a newly arrived version remounts its element and the CSS animation replays. No `setTimeout` is involved.

- [x] **Step 2: Typecheck and build**

Run: `cd /Users/gecko/src/projektor/packages/projektor.browser && npx tsc --noEmit -p tsconfig.json && npm run build`
Expected: both exit 0.

- [x] **Step 3: Smoke-test in the browser**

Run `npm run dev` in `packages/projektor.browser`, open `http://localhost:5173/browser/#/lab`, and check:
1. All four columns show roles (`admin`, `manager`, `seller`, `customer`) after "Booting workers and pairing…".
2. Manager → "Publish offer": the new offer appears in the admin, seller and customer columns, with the arrival flash.
3. Seller → "Admit order ×2": it appears in manager, admin and customer. Availability drops by 2 everywhere.
4. Customer → pause, manager publishes another offer: the customer column doesn't change. Resume: the offer arrives.
5. DevTools console shows no errors. The Network tab shows no fetches for Amway data (IPC only).

Use the Browser pane tools for this check (`preview_start` with a `.claude/launch.json` entry `{ "name": "projektor-browser", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "--prefix", "packages/projektor.browser"], "port": 5173 }`).

- [x] **Step 4: Update README**

Replace the Lab paragraph in `packages/projektor.browser/README.md` (append a section if none exists) with:

```markdown
## Lab (`#/lab`)

Four Web Workers, one ONE instance each (`packages/amway.lab`).

- **Host → worker:** refinio.api `IpcTransport` over the worker port (`handler:call`, `handler:list`).
- **Worker ↔ worker:** CHUM only. A worker dials `lab://<key>` through the one.models `lab:` dialer; the host transfers the MessagePort to the target, which accepts it as an external connection. The host never reads Amway data.
- **Data:** `AmwayDepartment`, `AmwayRoleAssignment`, `AmwayContact`, `AmwayOffer` and `AmwayOrder` are versioned ONE objects, disclosed by sender-side access grants.
- **UI:** a snapshot on boot/resume, then feed-forward rows from each worker's `onVersionedObjStored`.
```

- [x] **Step 5: Commit**

```bash
cd /Users/gecko/src/projektor
git add packages/projektor.browser/src/lab/Lab.tsx packages/projektor.browser/README.md
git commit -m "feat(lab): feed-forward columns over CHUM workers, drop switchboard timeline"
```

---

### Task 11: Remove the envelope switchboard

**Files:**
- Modify: `packages/amway.app/runtime.js`: delete `CONTACT_ENVELOPE_KIND`, `OFFER_ENVELOPE_KIND`, `ORDER_ENVELOPE_KIND`, `demoHashOf`, `sortKeys`, `contactEnvelope`, `offerEnvelope`, `orderEnvelope`, `apply*Envelope` and `plan.applyEnvelope`, plus the `envelope` fields returned by `publishContact` / `publishOffer` / `admitOrder`.
- Modify: `packages/amway.app/runtime.test.js`: delete the envelope tests.

- [x] **Step 1: Find remaining users**

Run: `cd /Users/gecko/src/projektor && grep -rn "createAmwayRuntime\|demoHashOf\|applyEnvelope\|ENVELOPE_KIND" --include=*.js --include=*.mjs --include=*.ts --include=*.tsx . | grep -v node_modules | grep -v "/dist/"`
Expected: matches only in `packages/amway.app/runtime.js` and `packages/amway.app/runtime.test.js`.

If anything else matches, stop and report it. If only `runtime.test.js` uses `createAmwayRuntime`, delete both `runtime.js` and `runtime.test.js` instead of trimming them: the lab was their only consumer, and `scripts/amway-server.mjs` composes the modules directly.

- [x] **Step 2: Delete and run tests**

```bash
cd /Users/gecko/src/projektor
git rm packages/amway.app/runtime.js packages/amway.app/runtime.test.js
npm run test:amway && npm run test:amway-lab
```

Expected: both PASS.

- [x] **Step 3: Commit**

```bash
git commit -m "refactor(amway): remove envelope switchboard runtime superseded by CHUM lab"
```

---

## Self-Review Notes

- **Coverage of requirements:**

  | Requirement | Tasks |
  |---|---|
  | Web Workers carry instances | 7, 9 |
  | refinio.api abstraction over IPC | 5, 7 |
  | Information exchange via CHUM | 1, 2, 6, 7, 8 |
  | Host switching | 8 (`host-switch.js`), 9 |
  | Feed-forward instead of timelines | 7 (feed), 10 (UI) |
  | Review defects fixed: hanging IPC | 5 (`fail`, `boot-failed`) |
  | Review defects fixed: storage fallbacks | 11 (runtime removed) |
  | Review defects fixed: fake pause | 6 (`setOnline`), 8 (`setSwitch`) |
  | Review defects fixed: admin without authority | 6 (admin creates the department) |
  | Review defects fixed: mislabelled button | 10 (buttons reflect the actor) |

- **Resolved against source on 2026-09-15:**
  - `onEnterState` is a callable `OEvent`.
  - Missing department → `hasVersionHead`.
  - `onVersionedObjStored.addListener` returns its remover; the shutdown/logout names exist.
  - refinio.api `OneConnectionPlan` now takes request objects (registry-compatible, with tests).
  - A Node `Worker` lacks `addEventListener` (the test wraps it), while `parentPort` and `MessageChannel` ports have it.
- **Remaining execution-time gate:** a single one.core copy in the Vite worker bundle (Task 9, Step 4). It can only be checked once the bundle exists.
