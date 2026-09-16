# Amway App Book

Status: product foundation; the first operational slices are implemented and
tested (see below). Journeys whose evidence scope is still `app-book-contract`
remain specified, not implemented.

## Implementation status

Implemented against real in-memory domain state (ONE-backed durability is the
next slice; the route server reports `durable: false` until then):

- Brand shell: official logo asset, observed palette, system-font stack
  (`packages/amway.app/brand.js`, `config.js`, `assets/`). Run
  `node --test packages/amway.app/brand.test.js`.
- Branded `/amway/` shell with department scope banner, hash routing, and
  distinct empty/unavailable states (`packages/amway.app/ui/`). Served
  loopback-only by `scripts/amway-server.mjs`; run
  `node --test scripts/amway-server.test.mjs`. Start with
  `npm run amway:start` (`AMWAY_PORT` overrides the default 4176).
- Departments, scoped roles, and phonebook contracts (`packages/amway.app/departments.js`):
  stable department scope, fail-closed action-time authorization, customer
  directory isolation, revocation ending future sharing while preserving
  history. Run `node --test packages/amway.app/departments.test.js`.
- `packages/shop.amway` slices 1–4: typed transaction/policy contracts,
  versioned catalog/offers/prices, idempotent admission, reservations with
  last-unit protection, linked fulfilment/recognition/settlement with event-log
  recovery. Run `node --test packages/shop.amway/shop.test.js` and
  `lifecycle.test.js`.
- Slice 5–6 foundations: subscriptions with idempotent occurrences, return
  cases with linked corrections, statement reconciliation that keeps points
  out of money, producer journal with completeness cuts, and contracted chat
  admission. Run `node --test packages/shop.amway/commercial.test.js`.
- Flexibel-aligned roles and phonebook (`packages/amway.app/roles.js`,
  `phonebook.js`, still on `../one` — no ONE switch): department namespaces
  (`amway.department.v1:<id>`), issuance edges (bootstrap enrolls admins;
  admins manage; managers bring sellers and customers), effective/selected
  role projection, and contact-owned phonebooks with certified contacts
  whose currency follows the cert-root assignment. Run
  `node --test packages/amway.app/roles.test.js` and `phonebook.test.js`.
- Authority chain: the country organisation manager (bootstrap) enrolls each
  department's mandatory manager at creation; only managers sign members
  (seller/customer roles and contact certifications record the issuer's
  signing roles); the manager owns the department phonebook, with ownership
  following succession (`setDepartmentManager`, `transferPhoneBook`).
- Anmelden and languages (`scripts/amway-server.mjs`, `packages/amway.app/ui/`,
  `i18n.js`): the server is one ONE instance (`POST /session` unlocks it,
  the instance owner is the runtime identity, operations run on its
  `OperationRegistry`); sign-in gate on department scope,
  German/English/French shell with parity-tested dictionaries. Every screen
  reads live domain data (directory, contracts, catalog, orders, inventory,
  earnings, returns, journal with exactly-once ingestion); settings sit
  behind the lower-right cog. Run
  `node --test scripts/amway-server.test.mjs`
  and `packages/amway.app/i18n.test.js`.
- Settings on settings.core (`packages/amway.app/settings.js`): the `amway`
  section (language, theme) is registered on settings.core's
  `SettingsRegistry`; the shell's Einstellungen screen renders account
  (Angemeldet als, Abmelden), language, Hell/Dunkel/System theme, data
  (export/import/demo), and trust (chain, trusted signers) from the server
  schema, rendered as a page header with collapsible cards. Run
  `node --test packages/amway.app/settings.test.js`.
- Invitations (`packages/amway.app/invites.js`): ecosystem-shaped invitation
  URLs with finalized metadata; acceptance pairs identity to a published
  contact and issues the manager-signed role. Invites carry the
  connection.core pairing intent (topic plus `primed` connection mode), and
  completed transport pairings land through `pairingComplete` listeners that
  run the same member binding. Managed from People & Phonebook. Run
  `node --test packages/amway.app/invites.test.js`.
- Browser app (`packages/projektor.browser/`): React port of the workspace
  modelled after `vger.browser`, reusing its invitation URL parser and the
  built connection.core dist via source aliases (no cross-repo edits);
  served same-origin at `/browser/`. Run `npm run build` in the package.
- Four-instance browser lab (`/browser/#/lab`, `packages/amway.lab/`): country-
  organisation admin, manager, seller and customer run as four independent ONE
  instances in dedicated Web Workers. Catalog offers and admitted orders use
  scoped ONE access plus CHUM exchange, and each column projects only its own
  locally materialized state. The integration suite proves exact-version offer
  propagation, role-gated publication, customer/staff order feedback, offline
  catch-up, and automatic restoration of the persisted peer mesh after restart.
  Run `node --test packages/amway.lab/*.test.js`.
- Department data portability (`packages/amway.app/export.js`, `demo.js`):
  self-contained JSON envelopes modeled on the vger memories export format
  (exporter identity, trust block, unsigned → unverified import, explicit
  elevation, replay-safe, conflicting re-imports rejected); demo department
  `demo-de` via `loadDemo` with a 34-item amway.de-inspired assortment
  (Nutrilite, bodykey, Artistry, Amway Home, iCook, eSpring, Atmosphere
  Sky, Glister, Satinique, XS, G&H; items carry display name, category,
  and PV/BV), two sellers, two customer households with subscriptions,
  one settled sale plus one accepted multi-line order, and a second
  department `demo-de-west` with its own manager, seller, household, and
  order. Run `node --test packages/amway.app/export.test.js`.

Durable roots (`packages/amway.app/publication.js`, `publishDepartment` op):
versioned `AmwayDepartmentRoot` objects (stable id per department, opaque
canonical snapshots) stored in ONE storage with the id root granted to the
custodial instance owner; manager-only publish from Settings → Daten.
Run `node --test packages/amway.app/publication.test.js`.

Still open before production use: full attestation-backed issuance via
`trust.projektor`, cross-identity access grants on published roots (members
are logical `person:*` strings, not ONE persons yet), the `21`/`akte` source
adapters, verified compensation/tax/recognition policy inputs, and the
Flexibel stable-id versus exact-version grant resolution.

The authoritative authored catalog lives in
[`packages/amway.app/app-book.js`](../packages/amway.app/app-book.js).
The package is `@projektor/amway.app`, and its canonical native `Book.name` is
`amway`, following VGER's app-name convention. The authenticated native
materializer supplies the Book author and identity; this package does not create
a separate Book recipe or registry.

## Product contract

The dedicated destination is **https://projektor.one/amway**, with Amway's
logo and colors, using the user-confirmed [Amway Germany](https://www.amway.de/) reference.
The department template is Flexibel's StudyCenter in `../heiner`, adapted to
commercial work. Each department has a shared phonebook, scoped relationships
and explicitly authorized chat. `../21` and `../akte` are requested integration
sources, but source inspection found no stock or revenue ledger in either.
Their inventory adapters remain a requirement. The existing goods model is
`../one/packages/supply.core`, consumed by Projektor's `inventory.app` and the
concrete supply-chain implementation in **`../aggregat/src/shop.core`**.

| Role | Intended authority, subject to explicit scope |
| --- | --- |
| admin | Configure departments, role grants, phonebook policy and branding |
| manager | Manage assigned departments/facilities; may own goods held at a facility |
| seller | Offer, reserve and sell explicitly authorized goods; communicate with customers |
| customer | Access their shared offers, orders, delivery/payment evidence and conversations |

A role does not confer title. Facility operator, location, custodian and goods
owner remain separate. Administrative authority does not automatically disclose
private chat or every customer's records. Customer phonebooks expose only the
relationships shared with that customer.

Inventory and revenue follow the same durable transaction evidence. Reservations,
physical movement, title/custody acceptance, invoices, revenue recognition,
settlement and returns have separate meanings. Projections declare their evidence
cut and show missing counterparts as pending. Repeated imports or receipts must
not double count stock or money; concurrent sellers must not oversell.

The journal lists every authorized trust-assignment lifecycle event and every
inbound/outbound Assembly share, including recipient, exact object version,
authorizing contract and receipt status. It preserves revocations and corrections,
shows completeness, and never treats journal visibility as payload access.
Chat starts from effective phonebook contracts and uses native chat tries,
`ChatTrieShareManifest` and CHUM, with separate attachment authority checks.

## Journeys and delivery

The structure now includes thirteen chapters, informed by the
[German-market research](./amway-business-research.md):

1. Dedicated workspace and brand experience.
2. Departments and shared phonebooks.
3. Customer/business-partner relationships, separate from app roles.
4. Products, variants, packs and sets.
5. Purchase channels, subscriptions and returns.
6. Retail margin, commissions, incentives and payout.
7. App roles and manager ownership.
8. Coupled inventory and sales evidence.
9. Trust assignments and shared Assemblies in the journal.
10. Contract-based chat.
11. Planned shop.amway module and operation boundary.
12. Delivery stages and evidence boundaries.
13. Four-instance browser lab and propagation evidence.

The eleven journeys cover catalog-to-order, recurring orders, returns/replacements,
earnings reconciliation, workspace entry, department phonebooks, manager-held
inventory, facility sales, journal inspection and contract chat. The original
facility-sale journey remains; the additional lab journey observes one action
across four independent identities. Direct Amway orders use their own
fulfilment provenance and never decrement fictitious department stock.

Each journey declares inputs, steps, output contracts, acceptance checks and
source provenance. Bindings use **`app-book-contract`** scope. Their active status
means the specification validation can run; it does not mean these business
journeys are implemented. Runtime validation must later cover department
isolation, revocation during active sessions, multi-party sharing, concurrent
reservations, returns, duplicate delivery and restart recovery.

## Four-instance browser lab

Current implementation status: the catalog slice and the first admitted-order
feedback path are operational in `packages/amway.lab` and rendered at
`/browser/#/lab`. Manager/admin offer publication is role-gated, replicated
objects retain their exact ONE version and provenance, and unauthorized local
publication is denied honestly. A customer self-purchase is admitted locally,
then reaches the staff projections through CHUM; a seller-admitted order reaches
the named customer. Availability is recomputed independently from the admitted
orders materialized in each worker. Persisted contacts alone are not treated as
a live mesh: startup restores the lab's explicit always-connected demand from
the saved peer endpoints before declaring the workers ready, so reload/restart
does not strand later purchases in their origin column.

The remaining Order & Reservation work is to separate order intent from the
manager-owned stock-reservation decision, add the last-unit concurrency guard at
that authoritative boundary, and narrow the admin/out-of-scope transaction
projection. Until that admission protocol is implemented, the present
`admitOrder` operation is the lab's accepted-order fixture rather than the final
multi-step purchase workflow.

The dedicated demonstration route is `/amway/lab`. It presents four columns in
one browser window: country-organisation admin, department manager, seller and
customer. Each column is backed by a separate `amway.core` runtime in a
dedicated module Web Worker. ONE.core supports one instance per JavaScript
runtime, so each worker owns its identity, recipes, keychain, operation
registry, IndexedDB-backed storage and projections.

The current Node server composes one ONE instance while much of the Amway
business state remains in process-local maps. The lab therefore requires an
environment-neutral `amway.core` composition with `initialize`, `invoke`,
`subscribe` and `shutdown` lifecycle operations. It has no HTTP, DOM or Node
process dependency. The Node server and browser workers consume the same
`refinio.api` operations. React receives an instance-scoped transport per
column; it does not call the current hard-coded `/api/amway` endpoint directly.
The worker transport follows `ui.core`'s `TransportAdapter` contract and
supports correlated requests, structured errors and event subscriptions.

The outer browser shell acts only as a deterministic virtual network and
observation surface. It can route, pause, disconnect or delay protocol traffic,
but it does not copy domain objects, mutate another worker or grant access.
Cross-instance effects travel through the real connection, access and CHUM
paths. `BroadcastChannel`, shared React state or direct mutation-payload fan-out
must not substitute for replication because those paths bypass the identity,
trust and disclosure behavior being demonstrated.

Each column keeps independent navigation, department selection and session
state. The existing unqualified browser `localStorage` keys for email,
department, language and theme cannot hold per-instance state. A sticky header
shows actor, effective role, connection state and current projection or root
version. Projection changes are driven by worker events, never identical-status
polling. A shared timeline distinguishes local commit, publication/share, peer
receipt, admission or denial, projection change and business acceptance. It
shows origin, recipient, exact object/version reference, authorizing contract,
outcome and elapsed time. An unaffected column reports `not shared` or `denied`
where applicable instead of silently appearing stale.

The first proving scenario is:

1. The manager publishes an authorized offer.
2. The seller receives it and creates a facility order for the customer.
3. The manager observes the reservation and inventory effect.
4. The customer observes only their authorized order projection.
5. The country-organisation admin observes only journal evidence allowed by
   policy, not the private payload.
6. One instance is disconnected, remains explicitly stale, reconnects and
   catches up through the real exchange path.

Demo controls may pause an instance, disconnect a link, add bounded latency,
inspect exact references, replay a named scenario, and reset/reseed all four
instances. Reset produces four clean, distinct identities and reproducible
starting projections while leaving the normal single-instance `/amway`
workspace available.

The lab remains `app-book-contract` evidence until runtime tests prove four
concurrently active workers, isolated storage and sessions, real authorized
exchange, event-driven updates, offline catch-up, explicit denial or
non-disclosure, and deterministic reset. Business state still held only in
process-local maps must move behind durable per-instance ONE roots before its
cross-instance propagation is certified.

## Read and materialize

The package declares `appBook` and exports `./app-book` for VGER workspace
discovery. The Projektor HTTP operation registry exposes
`POST /api/amwayAppBook/getDefinition` with `{}`; the catalog is returned in
`response.product` and is also discoverable through the existing MCP catalog.

In an authenticated VGER runtime, pass `{catalog: response.product}` to the
existing `appBook.materialize` operation. The native materializer owns persisted
Books, chapters, FlowDefinitions, FlowBindings, provenance and Library membership.
This change does not materialize a Book into a user Library or deploy `/amway`.

Run the native contract, provenance and HTTP/MCP discovery checks from Projektor:

```sh
node --test packages/amway.app/app-book.test.js
```

These checks require the existing sibling `../one` build outputs, as does the
Projektor HTTP service. They certify the app-book integration only.

Next implementation inputs are deployable brand asset/font packaging, initial department
and facility roster, source inventory mappings, role/contract issuers and the
revenue recognition, currency, tax and returns policies.

## Planned shop.amway module

`packages/shop.amway` will own Amway's commercial operations. It is a planned
module boundary; this change creates the app book, not the shop runtime.

| Owner | Responsibility |
| --- | --- |
| `amway.app` | Product Book, department experience and branded `/amway` shell |
| `shop.amway` | Catalog/offers, reservations, orders/subscriptions, fulfillment coordination, recognition-policy decisions, settlement, returns and reconciliation |
| `supply.core` | Goods, conservation, location, custody, title, transfer acceptance and valuation |
| Aggregat `shop.core` | Concrete fulfillment/publication reference; its fixture ledger is not production storage |
| Existing trust and directory owners | Identity, scoped roles, department phonebooks and contract authority |
| Native chat and Assembly/journal owners | Messaging/access, signed occurrences and evidence projections |

Expose the same domain operations through `refinio.api` for UI, HTTP and MCP.
Each mutation carries exact scope, expected version, idempotency identity and
current authority evidence. Chat-triggered shop actions use that same admission
boundary. Transactions pin purchase channel, seller of record, accepted terms,
currency, policy and exact goods/commercial references. Direct Amway orders do
not decrement facility stock. Earnings-statement reconciliation stays separate
from retail sales and does not invent compensation rules.

Implement in these slices:

1. Typed transaction/policy contracts, source mappings and module initialization.
2. Authoritative inventory/availability reads, catalog, offers and prices.
3. Reservations and order acceptance, including concurrent last-unit protection.
4. Linked fulfillment, recognition and settlement with durable crash recovery.
5. Recurring orders, returns, reversals, partial fulfillment and reconciliation.
6. Producer journal coverage and contracted chat actions, then route integration.

Shop events alone cannot provide the whole journal: role-assignment and other
sharing producers must emit their own lifecycle and recipient/version evidence.
Validate each slice through real persisted operations before marking it implemented.

## Verified integration boundaries

| Source | Existing contract | Amway integration requirement |
| --- | --- | --- |
| `heiner/one.flexibel/.../FlexibelStudiesPlan.ts` | `StudyCenterOrganizationProfile` has organizationName and optional departmentName | Adapt the StudyCenter organization; introduce explicit stable department scope |
| `heiner/one.flexibel/.../PhoneBookRecipes.ts` and `FlexibelContactsPlan.ts` | Owner-scoped PhoneBook, published/certified contacts and access requests | Include department in phonebook identity and entry projection; one owner can operate several departments |
| `one/packages/supply.core` | Lots/items, locations, opening evidence, movement, custody/title transfers, counts, traceability and valuation | Reuse the stock fold and admission rules; `Location.owner` is the operator, not goods title |
| `aggregat/src/shop.core/{ledger,service,book,publication}.ts` | Inventory event fold, production, orders/commitments, movement/title transfer, Book projections and publication closure | Reuse application patterns with durable ONE storage; its in-memory ShopLedger is a demo/fixture adapter |
| `aggregat/seho.app/chapters/03-inventory-and-revenue.md` | Related inventory/revenue product specification | Reuse transaction requirements as guidance, not proof of an implemented revenue ledger |
| `21/packages/21.core/src/recipes/index.ts` and `plans/DealsPlan.ts` | CRM opportunities with value and currency | Link deals to goods and commercial evidence; deal value is not recognized revenue |
| `akte/packages/rule.akte/src/AkteLineagePlan.ts` | Task/Story and signed Assembly lineage with exact references | Reuse causal occurrence and sharing patterns; no stock/revenue model exists here |
| `akte/packages/akte.calendar/src/AkteCalendarPlan.ts` | Authorized mutation intent and admission | Reference for authority-before-mutation workflow; no implicit inventory permissions |
| `one/packages/assembly.core/src/types/Assembly.ts` | Producer-signed Assembly closure and predecessors | Journal exact shared versions and their separate audience/receipt evidence |

Do not copy `21`'s old journal IPC wrapper as the general journal contract: its
referenced assembly JournalPlan is absent from current shared exports. Producer
events and current Assembly contracts must drive the new journal. The catalog's
source references resolve to the concrete files inspected.

Flexibel currently does not project `departmentName` into `PublishedContact`.
Its telephone-book flow documentation also differs from the implementation on
stable-id versus exact-version access grants. Resolve this before copying the
sharing behavior. Unpublishing a directory entry does not itself revoke pairing
or chat; an explicit contract revocation does govern future contract-dependent
actions. Reuse Flexibel's paired-contact prerequisite, while using VGER's current
trie-based chat architecture for this new app rather than copying Flexibel's
channel implementation.

## Brand reference captured 2026-09-13

The live German homepage was inspected in the browser. Its header uses the
[official black Amway SVG](https://images.contentstack.io/v3/assets/blt70a7e9d08c98ce54/bltc9c12b3aad776123/636a050025f98d3896160f1b/Color_Amway_Black.svg)
on white. Preserve this asset and its aspect ratio rather than redrawing it.

| Observed website treatment | Value |
| --- | --- |
| Header/page surface | `#FFFFFF` |
| Main text | `#2C2C2C` |
| Footer/neutral surface | `#F4F4F4` |
| Blue links and corporate hero action | `#38539A` |
| Nutrition category | `#546223` |
| Beauty category | `#7F3E3E` |
| Home category | `#396E75` |
| Typography | GT Walsheim regular, medium and bold; sans-serif fallback |

Use white, charcoal and blue for the department application shell, reserving
category colors for relevant product groupings. This is an application design
choice based on observed site styling, not a formal Amway brand manual. Verify
contrast and font availability when implementing the route. The catalog records
the source; no route assets or fonts have been bundled yet.

## Research-driven boundaries

The official [earnings overview](https://www.amway.de/about-amway/earn-with-amway)
requires a wider model than a single revenue total; the catalog now gives
performance and earnings their own chapter and reconciliation journey.
[Return handling](https://www.amway.de/secure-shopping/return-policy) and
[subscriptions](https://www.amway.de/about-amway/amway-recurring-order) inform
dedicated lifecycles. Source observations, design inferences and unverified
integration inputs are recorded separately in the research note.

The four requested app roles and the StudyCenter department template are retained.
External partner status, sponsor/team relationships and qualification ranks do
not grant internal permissions. Current compensation formulas and external
integration interfaces remain unverified; no operational implementation or
payout calculation is certified by these structural additions.
