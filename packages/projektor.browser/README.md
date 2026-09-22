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

## Lab (`/amway/lab/`)

Four Web Workers, one ONE instance each (`packages/amway.lab`).

The lab is a dedicated build entry (`lab/index.html`, mirroring
flexibel.browser): `npm run build` emits `dist/lab/index.html` next to the
workspace `dist/index.html`, so the lab has its own URL instead of living
behind the workspace `#/lab` hash. It is served locally at `/amway/lab/`
by `scripts/amway-server.mjs` and deployed live at
`https://projektor.one/amway/lab/` by the root `deploy.sh`, which copies
the entry into the amway lane. The route is deliberately not linked from
any page.

## Device pairing (IoM)

Each app automatically creates an IoM invitation when its worker is ready.
The QR and copyable link appear below the fixed app frame, following Flexibel's
lane layout. Click the QR to enlarge it. Pairing completion consumes the displayed
QR; a new invitation can be requested in the same panel.

Discovery and device pairing use Glue's standard ONE commserver at
`wss://api.glue.one/comm` through a dedicated `ConnectionsModel`. There is no
Projektor rendezvous relay. Local integration tests can override the commserver
with `?commServer=ws://127.0.0.1:<port>`.
Opening the invitation on another device registers it with the exact same
email, which reproduces the same Person id. The token authorizes the new instance
keys and the native stack reports the link as Internet of Me. Person-scoped
access grants then replicate the department without re-granting. A different
person is refused before network traffic.

- **Host → worker:** refinio.api `IpcTransport` over the worker port (`handler:call`, `handler:list`).
- **Worker ↔ worker:** CHUM only. A worker dials `lab://<key>` through the one.models `lab:` dialer; the host transfers the MessagePort to the target, which accepts it as an external connection. The host never reads Amway data.
- **Data:** `AmwayDepartment`, `AmwayRoleAssignment`, `AmwayContact`, `AmwayOffer` and `AmwayOrder` are versioned ONE objects, disclosed by sender-side access grants.
- **UI:** a snapshot on boot, then feed-forward rows from each worker's semantic `onVersionedObj` event after its version head is readable.

## Amway and EK demo purchases

The customer’s **Buy** action publishes a typed purchase request. The appointed
seller worker confirms it automatically through the existing stock checks;
confirmed orders update the customer history and the admin/manager inventory.
There is no second seller button. Processing requests are shown as processing,
and an out-of-stock decision is shown as a failed purchase, without decrementing
stock or creating balances. The lower-level placement/admission operations
remain available for protocol tests in both lanes.

The seller decides against inventory currently replicated to that worker. An
out-of-stock decision is final for that request; after a later restock arrives,
the customer can submit a new purchase. A failed request never silently becomes
a charge after restocking.
