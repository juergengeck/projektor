# @projektor/browser

React browser app for the Amway workspace, modelled after `vger.browser` and
served same-origin by `scripts/amway-server.mjs` under `/browser/`.

## Reuse boundary (where sensible)

- **Amway domain**: same `packages/amway.app` modules as the plain-JS UI —
  `i18n.js` strings, `ui/styles.css` look, identical `/api/amway/*` ops.
- **vger pairing stack**: the real `invitation-url-parser` from
  `vger.browser/browser-ui` (same validation as `InvitationAcceptance`) plus
  the built `@refinio/connection.core` dist. No radix/tailwind chrome — the
  app keeps the Amway brand.
- **Module resolution**: `vite.config.ts` aliases workspace sources absolutely
  (same source-alias strategy as `browser-ui`), with `react`/`react-dom`
  forced to the local install for a single module identity. No cross-repo
  edits, no shared lockfile.

## Commands

- `npm install` — third-party deps only (`@refinio/*` resolve via aliases)
- `npm run build` — emits `dist/` (served at `/browser/`, `base: /browser/`)
- `npm run dev` — local Vite dev (API calls still go same-origin)

## Pairing flow

People → invite carries the pairing intent (`primed`, topic defaults to the
department scope) → joiner pastes the transport pairing URL → the app parses
it with the vger parser and lands `pairingComplete` (token, person, name,
topic, pairing URL evidence) on the Amway server, which binds contact + role
and journals the event.

Open: the socket-level handshake (`ConnectionPlan` over a browser one.core
runtime) still lives in the vger stack — the acceptance seam is ready for it,
but live peer pairing has not been driven from this app yet.

## Lab (`/browser/lab/`)

Four Web Workers, one ONE instance each (`packages/amway.lab`).

The lab is a dedicated build entry (`lab/index.html`, mirroring
flexibel.browser): `npm run build` emits `dist/lab/index.html` next to the
workspace `dist/index.html`, so the lab has its own URL instead of living
behind the workspace `#/lab` hash. It is served locally at
`/browser/lab/` by `scripts/amway-server.mjs` and deployed live at
`https://projektor.one/browser/lab/` by the root `deploy.sh`.

- **Host → worker:** refinio.api `IpcTransport` over the worker port (`handler:call`, `handler:list`).
- **Worker ↔ worker:** CHUM only. A worker dials `lab://<key>` through the one.models `lab:` dialer; the host transfers the MessagePort to the target, which accepts it as an external connection. The host never reads Amway data.
- **Data:** `AmwayDepartment`, `AmwayRoleAssignment`, `AmwayContact`, `AmwayOffer` and `AmwayOrder` are versioned ONE objects, disclosed by sender-side access grants.
- **UI:** a snapshot on boot/resume, then feed-forward rows from each worker's `onVersionedObjStored`.
