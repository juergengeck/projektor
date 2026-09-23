# PRD: Lab Lanes (Browser, Amway + EK)

## 1. Problem

Two forked lane shells (`src/lab`, `src/eklab`) each booted four full ONE
instances in Web Workers and duplicated the entire role UI in the host.
Every lane fix had to land twice, the EK fork drifted (German titles,
`offer-ek-*` ids), and the host owned product rendering that belongs in
the app.

## 2. Goals

- One brand-parameterized `lab.core` serving both lanes; the data plane
  (`lab://` switch, primed mesh pairing, IoM over the glue commserver)
  is unchanged.
- A Flexibel-style per-role lane app (`src/lane-app`, one iframe per
  column) so role actions run inside the app and the host only renders
  snapshot chrome.
- Invite-aligned seeding with the protocol's core identity assertion
  (owner is the exact invited Person), session-scoped fresh boots (D4).
- No worker engine, no EK fork: one shell, `?lane=` selects the brand.

## 3. Non-goals (this PRD)

- Persistence across page loads (D4: waits for a root cause for the
  reload wedge; see §10).
- Pairing reuse / foreign-identity refusal (dead code on fresh
  directories; port after persistence lands, if ever).
- Full German EK chrome (the lane keeps the fork's posture: English UI
  with German role titles and EK catalog).
- The shared lane-shell package (Phase 4 replaces the `shell/` ports).

## 4. Users and use cases

- Lane demos (Amway `Demo workspace`, EK `EK lab`): four federated
  solutions in one real-time view, appoint → stock → offer → share →
  buy, contact chat, second-device join via QR.
- Protocol developers: the seed exercises the real mesh invite path
  every boot; the reload guard proves fresh boots converge.

## 5. Functional requirements

### 5.1 Lab entry and hosting

- `lab/index.html` is the lane build entry, served at `/browser/lab/`;
  `?lane=amway|ek` selects the brand at runtime (title, favicon,
  theme-color, role titles, catalog). Unknown lanes fail loudly.
- `Lab.tsx` renders four columns (admin, manager, seller, customer)
  with: owner/instance short ids, active roles, app state, per-column
  Refresh and live/paused toggle, per-column seed line plus a lane seed
  log, and the visible live app iframe per column.
- Per-column IoM (self-device) invite QR below the frame, so a real
  phone can be enrolled as a second device of that instance's person.
- One appearance toggle cycling light → dark → system (OS scheme); the
  resolved light/dark value reaches the host document and each iframe
  document (same-origin write). The in-lane apps only understand
  light/dark.
- `#/lab` and `#/eklab` redirect to `/browser/lab/?lane=…`, preserving
  the query (notably `?commServer=`). `/amway/lab` and `/ek/lab`
  redirect to the shell with their lane, on the demo server and in the
  static deploy (redirect stubs).

### 5.2 Instance isolation

- One storage session per page load: `crypto.randomUUID` hex, 8 chars
  (`labSession` in every iframe URL).
- Each role boots into `<storagePrefix>-<role>-<session>` (resolves
  through `resolveStorageDirectory`, which throws on malformed params).
- The host prunes previous loads' directories (`staleSessionDirectories`
  + `indexedDB.deleteDatabase`, best-effort, never blocking) before any
  iframe boots. The join path never prunes.
- `?commServer=` on the lane page is forwarded into every iframe URL:
  each iframe boots its own instance, so without forwarding the mesh
  would pair over the default commserver instead of the hermetic one.
- Deterministic accounts (`<role>@<emailDomain>` / `lab-<role>`),
  never stored: the same email always reproduces the same Person, so
  IoM pairing finds its counterpart by email.

### 5.3 Protocol-aligned seeding (normative)

1. **Admin sign-in.** `ensureLabAccount` waits for
   `session.waitUntilReady` to exist (retrying only
   `Operation 'session' not found` — its "still booting" rejection
   proves the plan is up with a null model), then always runs
   `session.registerAndSetup` with the deterministic admin account
   and asserts owner, instance, and post-login plans.
2. **Department.** `seedDepartment` creates the brand department on the
   fresh admin (always unknown there). No known-check, no seed record.
3. **Role invites.** Per role (manager → seller → customer):
   `createRoleInvite` mints a primed `connection.createInvite` on the
   admin and wraps it with `encodeMeshInviteUrl` (redial at the
   admin's `lab://` listener through the host switch, never fetched).
4. **Registration through the invite.** `acceptRoleInvite` drives the
   role's own `ui` plan, no test-ID clicking:
   `loadPendingInvitation({url})` (asserts loaded) →
   `acceptPendingInvitation({secret, displayName, expectedEmail})` →
   `callWhenRegistered(onecore.getStatus)`; returns the post-handoff
   owner id, asserted non-empty.
5. **Owner assertion.** `seedRole` polls the admin's
   `connection.listConnections` until the accepted owner appears as a
   mesh `remotePersonId`, then asserts `ownerId === personId`: the
   pairing introduces exactly the invited Person. No seed records, no
   reuse branch, no foreign-identity check.
6. **Mesh.** `pairMesh` pairs the three remaining role↔role pairs
   (manager–seller, manager–customer, seller–customer), each exactly
   once per boot, over `lab://` with primed parts.
7. **Peers.** The host snapshots every column's owner id and pushes
   the map into each iframe with `ui.setLanePeers`: appoint/share
   subjects for the in-iframe UI. A URL renavigation cannot supply
   them — reloading the same session-scoped directory wedges CHUM
   (D4), and a new session reboots with new persons.
8. **Appointments stay manual**, through the in-iframe UI, exactly as
   the old host UI did.

### 5.4 Readiness without global gates

Plan registration finishes asynchronously after boot and after the
invite handoff, so the youngest instance answers
`Operation '<plan>' not found` for operations that are still
registering. The lane waits for exactly the operation it is about to
call (`callWhenRegistered` in `shell/readiness.ts`): only the
not-found error retries (60 s bound); any other failure settles
immediately, so side-effecting calls can never run twice. Never gate
lane flow on global readiness: a strained instance may never finish
registering every plan while the one needed arrived long ago.

### 5.5 Snapshot and liveness

- Per-column snapshot: `ui.getInviteState` + `lab.getDepartment`;
  each call degrades to `null` independently so partial readiness
  renders honestly.
- Event-driven refresh per column: a debounced observer on the app
  iframe re-reads the snapshot when the app visibly changes, so the
  column follows app state instead of a timer. Manual Refresh
  surfaces errors as column notices.
- "Paused" **is** a network partition here (unlike Flexibel, which has
  no host switch): the toggle is `setSwitch`, and the switch drops
  `lab://` dials for closed instances.

## 6. Architecture

```
browser/lab/?lane=amway|ek (lab/index.html)
└─ src/lab/main.tsx → Lab.tsx (4 columns + seed orchestration)
   └─ src/lab/transport.ts: bootLab / ensureLabAccount / seedDepartment /
      createRoleInvite / acceptRoleInvite / seedRole / pairMesh /
      snapshotColumn / bootJoinInstance
      ├─ control plane: lane-app __planRegistry (shell/plan-client.ts,
      │  ported from Flexibel runner-client.ts)
      ├─ retry/readiness: shell/readiness.ts (callWhenRegistered, poll)
      ├─ transitions/theme/urls: shell/ ports + labAppUrl
      └─ data plane (unchanged): lab:// switch (host-switch.ts, now
         switching iframeHostPort ends) + glue commserver for IoM
      └─ same-origin iframes: /browser/app/?lane=&labInstance=&labSession=
         └─ src/lane-app (RoleApp + screens + content per brand)
            └─ full lab.core instance per iframe (isolated IDB directory)
```

Deliberate deviations from Flexibel's PRD: the seed drives the role's
own `ui` plan (`loadPendingInvitation` → `acceptPendingInvitation` →
`onecore.getStatus`) instead of test-ID clicking — our lane app exposes
invites as operations, so planning through them is stabler than
scripting DOM hooks; lane peers travel over `ui.setLanePeers` instead
of the URL (D4, see §5.3.7); paused columns really partition (host
switch, §5.5).

## 7. Security and privacy

- Same-origin only; no new cross-origin surface.
- Lab accounts are synthetic and deterministic
  (`<role>@lab.local` / `lab-<role>`): anyone with the lane URL derives
  the same identities. Demo posture only — never point a lane at real
  data.
- No secrets leave the browser; the host never reads lane data (calls
  and snapshots only).
- Only `ws(s)` commserver overrides pass into iframe URLs.

## 8. Verification (observed)

- `packages/lab.core/shell/*.test.ts`: 24 tests (registry/plan client,
  readiness retries incl. the never-retry side-effect case, transition
  debounce, theme cycle, iframe URL building incl. commserver
  forwarding) — pass, both brands.
- `src/lab/transport.test.ts`: 7 tests (session URLs, deterministic
  accounts, owner-equals-invited-Person incl. the negative case,
  mesh invite shape, exactly three pairMesh pairings) — pass.
- Lane suites (`test:amway-lab`, `test:ek-lab`): all pass, incl. the
  invite-seeded integration suite and the persistence restart
  regression test (node workers, kept as the D4 starting point).
- `npm test` (full root chain incl. `test:ci-core`, server tests,
  app-book provenance) — pass; `typecheck:browser` — clean.
- Playwright (`npx playwright test`, preview build): 12/12 green —
  per-lane ceremony, reload-twice wedge guard, contact chat,
  second-device join from both entries, purchase flow with oversell
  refusal. Console/page-error watchdogs stay silent throughout.
- Boot-to-seeded (D5): worker engine at Task 6 vs iframe shell now —
  amway 1.4 s → 3.4 s, ek 1.4 s → 3.4 s (medians of 3 fresh-profile
  runs each, goto → "Mesh: 4/4 Nodes Online"). Ratio ≈ 2.4×:
  OVER the 2× gate — reported per D5, decision pending (see §10).

## 9. Files

- `packages/lab.core/shell/`: `plan-client.ts`, `readiness.ts`,
  `transitions.ts`, `theme.ts`, `urls.ts` (+ tests) — Flexibel ports,
  replace with the shared lane-shell package in Phase 4.
- `packages/lab.core/`: `brand.ts`, `storage.ts`, `invite-url.ts`
  (incl. `labUrl`), `session-plan.ts` (`setLanePeers`),
  `worker/host-switch.ts` (unchanged), `worker/lab-instance.ts`
  (peers threading).
- `packages/projektor.browser/src/lab/`: `Lab.tsx`, `transport.ts`
  (+ test), `main.tsx`.
- `packages/projektor.browser/src/lane-app/`: `RoleApp.tsx`,
  `screens/`, `content.ts` (`AMWAY_CONTENT`, `EK_CONTENT`),
  `main.tsx` (peers state, host QR base).
- `packages/ci.core/`: `lanes.mjs` (entries), `smoke/lane-ceremony.mjs`.
- Deleted: `src/eklab/`, `eklab/index.html`, `src/lab-engine/`.

## 10. Open follow-ups (out of scope for this PRD)

- D5 boot-time decision (pending): the iframe shell boots ≈ 2.4×
  slower than the worker engine (3.4 s vs 1.4 s medians). The delta is
  structural, not a regression to chase blindly: four sequential
  iframe boots (load-bearing — parallel full-app module graphs exhaust
  the shared renderer) plus three full invite handshakes per boot
  (create → load → accept → owner poll) where the worker engine ran
  six direct pairings. Absolute time (3.4 s for a four-instance mesh)
  is demo-fine; options are accept-and-record, or buy back time by
  trimming the 1.5 s admin readiness probe and the 500 ms retry
  granularities (margins, not architecture).

- Persistence needs a root cause for the reload wedge first: start
  from the node restart regression test and find why a browser reload
  behaves differently. Only then port Flexibel's reuse logic and
  remove `labSession`.
- Phase 4 replaces `lab.core/shell` with the shared lane-shell
  package (every ported file carries its source commit).
- Full German EK chrome is a product decision, not taken here.

## 11. Operator manual

- Open `/browser/lab/?lane=amway` (or `ek`); `#/lab` / `#/eklab`
  redirect there, as do `/amway/lab` and `/ek/lab`.
- `?commServer=ws://127.0.0.1:<port>` overrides IoM discovery and
  pairing (tests spawn a local commserver per spec file); the lane
  forwards it into every iframe.
- The Seed log under the grid narrates boot → department → three
  pairings → mesh → peers. Refresh re-reads a column; pausing
  partitions that instance for real.
- Join: open a column's device-invitation QR on a second browser
  (profile, device, or tab) and press Join — it registers the same
  Person and pairs over the commserver.
- Reloading reboots everything fresh by design; the third boot after
  two reloads is covered by automation.
