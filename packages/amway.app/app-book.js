export const AMWAY_APP_BOOK_NAME = "amway";

const DOC = "repo://projektor/docs/amway-app-book.md";
const FOUNDATION = "repo://vger/docs/plans/2026-08-05-app-book-foundation-design.md";
const INVENTORY = "repo://projektor/packages/inventory.app/app-book.js";
const TRUST = "repo://projektor/packages/trust.projektor/README.md";
const CHAT = "repo://vger/docs/CHAT-TRIE-AND-CHUM.md";
const BUSINESS_RESEARCH = "repo://projektor/docs/amway-business-research.md";
const GOODS = "repo://one/packages/supply.core/src/types.ts";
const OPENING = "repo://one/packages/supply.core/src/inventory-records.ts";
const CRM = "repo://21/packages/21.core/src/plans/DealsPlan.ts";
const LINEAGE = "repo://akte/packages/rule.akte/src/AkteLineagePlan.ts";
const STUDYCENTER = "repo://heiner/one.flexibel/packages/flexibel.core/src/plans/FlexibelStudiesPlan.ts";
const PHONEBOOK = "repo://heiner/one.flexibel/packages/flexibel.core/src/recipes/PhoneBookRecipes.ts";
const CONTACTS = "repo://heiner/one.flexibel/packages/flexibel.core/src/plans/FlexibelContactsPlan.ts";
const SHOP = "repo://aggregat/src/shop.core/ledger.ts";
const SHOP_SERVICE = "repo://aggregat/src/shop.core/service.ts";
const ONE_INSTANCE = "repo://one/packages/one.core/src/instance.ts";
const UI_TRANSPORT = "repo://one/packages/ui.core/src/transport/TransportAdapter.ts";
const BROWSER_API = "repo://projektor/packages/projektor.browser/src/api.ts";
const AMWAY_SERVER = "repo://projektor/scripts/amway-server.mjs";

const documents = [
  {
    name: "amway.purpose-and-experience",
    title: "A dedicated Amway workspace",
    body: `Amway brings departments, people, goods, sales and their evidence into a dedicated experience at https://projektor.one/amway. The package is amway.app; the canonical Book.name is amway, following VGER's app-name identity convention. The authenticated materializer supplies the author. The URL and brand are presentation, never an authority grant.

The route must open directly and survive reloads and sign-in while retaining the selected department. Navigation offers Overview, People & Phonebook, Chat, Products, Orders & Subscriptions, Inventory, Sales & Earnings, Returns and Journal, with administration available under explicit authority. Sales & Earnings separates turnover, margin, commissions, incentives and payout. Every screen shows its department and facility scope. Empty, loading, denied, unavailable and incomplete states are distinct.

Use Amway's confirmed logo and color scheme with accessible text contrast, visible keyboard focus and responsive layouts. The user-confirmed reference is https://www.amway.de/, inspected on 2026-09-13. Use its black Amway wordmark on white, charcoal #2C2C2C text, #F4F4F4 neutral surface and observed #38539A blue accent. The source also uses category accents #546223, #7F3E3E and #396E75. These are observed website colors, not a claim of a formal brand manual. The exact official logo URL and typography observations are recorded in the companion document. Preserve the logo proportions and use accessible controls; font redistribution must be resolved before bundling the observed GT Walsheim font. The app book is the first deliverable. A deployed route and functioning operational screens are subsequent work.`,
    sourceRefs: [DOC, FOUNDATION],
  },
  {
    name: "amway.departments-and-phonebooks",
    title: "Departments based on Flexibel StudyCenter",
    body: `Use Flexibel's StudyCenter as the department template: an organizational scope with identity, membership, responsible people, invitations, a shared directory and explicitly shared working objects. Adapt its organizational behavior, not its clinical labels or patient-specific permissions. A person can participate in several departments without creating a new personal identity.

The verified template is StudyCenterOrganizationProfile, authored by upsertStudyCenterOrganizationProfile, with required organizationName and optional departmentName; no standalone DepartmentTemplate exists. Flexibel PhoneBook, PublishedContact, CertifiedPublishedContact and PhoneBookAccessRequest provide the directory pattern. Its current phonebook identity is per StudyCenter owner, and its PublishedContact projection copies organization context but not departmentName. Amway therefore requires a real stable department scope in its phonebook identity and entries; copying the owner-only key would collapse two departments run by one owner. This is new integration work, not an already implemented department feature.

Each department has one logical shared phonebook. Entries resolve existing person/profile identities and their department-scoped roles and contracts. Membership, phonebook visibility, permission to contact and permission to read shared content are separate decisions. A manager or admin acts only within an explicit grant; a seller receives the contacts needed for their work; a customer receives only their explicitly shared relationship view. A customer is never automatically a reader of the department's whole directory.

Cross-department sharing names both scopes, the recipient, exact shared objects and the authorizing contract. Revoking or expiring authority stops future discovery and sharing under that authority and invalidates derived permissions. Unpublishing a contact is a separate directory action and does not itself revoke an existing pairing or chat contract. Revocation cannot erase content already received. The runtime evaluates current authority at action time, including on already open screens.

Flexibel's telephone-book flow documentation and current producer disagree on stable-id versus exact-version access grants. Resolve that access contract before implementing Amway sharing; do not silently copy either side as established behavior. Its study-specific doctor/therapist publication gates must be replaced by explicit Amway role contracts, not bypassed with generic contact visibility.`,
    sourceRefs: [DOC, TRUST, STUDYCENTER, PHONEBOOK, CONTACTS,
      "repo://heiner/one.flexibel/docs/flows/08-telephone-book-published-contacts.md"],
  },
  {
    name: "amway.business-relationships",
    title: "Customers, business partners and department roles",
    body: `Official German-market research is recorded in docs/amway-business-research.md, with dated source links and unresolved inputs. Amway distinguishes customers and business partners. Preserve the requested admin, manager, seller and customer app roles independently of external account type, qualification rank or partner/team relationship.

Maintain separate references for department membership, the customer-to-selling-business relationship, and any source-evidenced sponsor/team connection. None implies the others or grants phonebook, chat, inventory or earnings access. The seller of record comes from the order contract, not the app role label. A manager may own facility stock as requested; Amway's no-purchase-obligation statement means stock acquisition must not be required to onboard a partner. Department boundaries remain the user's organizational model, not an inferred Amway compensation hierarchy.`,
    sourceRefs: [DOC, BUSINESS_RESEARCH, TRUST],
  },
  {
    name: "amway.products-and-catalog",
    title: "Products, variants, sets and stock identity",
    body: `Structure the catalog around Amway's German storefront families: nutrition, beauty, personal care and home. Preserve source item numbers, brand, market, language, variant, pack size and unit. The observed catalog includes Glister, g&h and Satinique products, set components and subscription-eligible items. Categories and brands are product facets, never authority scopes.

Proposed integration: distinguish the sellable catalog item from each physical lot or serialized item held at a facility. Record batch/expiry or serial/warranty evidence where the producer supplies it; do not fabricate those fields. A commercial set references its components and fulfilment quantities without being confused with a signed ONE Assembly. Version price lists and set composition so a later catalog change cannot rewrite an order. Public availability is not proof of local stock. Retain official product-information references for customer conversations instead of generating unsupported product claims.`,
    sourceRefs: [DOC, BUSINESS_RESEARCH, INVENTORY],
  },
  {
    name: "amway.orders-subscriptions-and-returns",
    title: "Purchase channel, recurring orders and after-sales",
    body: `Official return instructions distinguish direct Amway purchases, purchases from a business partner and guest orders. Model purchase channel and seller of record explicitly. Direct fulfilment must not decrement a manager's warehouse; facility fulfilment must reference real goods held there. Route a return to the original seller and retain order, return reference, tracking, receipt, inspection and refund/replacement evidence. Sets require component completeness checks. A request alone does not establish a refund or restored sellable stock.

Amway also offers editable and cancellable product subscriptions with account-dependent benefits. Proposed lifecycle: retain schedule, customer authorization, eligible products, policy version and external subscription reference; give each executed occurrence a distinct order. A future occurrence is forecast demand, not revenue or stock movement. Cancellation stops future occurrences without deleting completed orders. Benefits remain versioned source policy; do not hardcode advertised discounts.`,
    sourceRefs: [DOC, BUSINESS_RESEARCH, INVENTORY],
  },
  {
    name: "amway.earnings-and-performance",
    title: "Retail margin, commissions, incentives and payout",
    body: `Amway's German earnings overview separates retail margin, Core Plan monthly/annual commissions and Core Plus incentives. The proposed Earnings surface therefore separates customer sales, cost of goods, retail margin, commission accrual/statement, incentive award and cash payout. The public overview is not a complete formula or guaranteed income.

Import exact statement periods, source order links, beneficiary, market, currency, policy version and adjustments. Retain source PW/PV and GV/BV labels as performance measures, not money. Any team total needs an externally evidenced team scope; department membership does not establish bonus eligibility. Show estimated, reported, reconciled and paid states separately. Do not calculate commissions until current German plan rules and eligibility inputs are verified. Returns can require both goods/financial corrections and separate performance/commission adjustments, each linked to its original evidence.`,
    sourceRefs: [DOC, BUSINESS_RESEARCH, INVENTORY],
  },
  {
    name: "amway.roles-and-ownership",
    title: "Admin, manager, seller and customer",
    body: `The product roles are admin, manager, seller and customer. They are scoped assignments, not a global hierarchy inferred from a label. Admin configures departments, grants and brand settings within administrative authority; that does not silently grant access to every private chat or customer record. Manager manages assigned departments and facilities, authorizes delegated work, and may own inventory in a storage facility. Seller handles authorized offers, reservations, sales and customer communication. Customer sees their own shared offers, orders, delivery and payment evidence and conversations.

A manager's authority to operate a facility is distinct from legal title to the goods. Store facility/location, operator, custodian and owner independently. In supply.core, Location.owner means the operating party, not the owner of all goods there; title is carried by goods/opening and TitleTransfer evidence. There is no separate Facility recipe to assume. Goods owned by manager M can be held by facility operator F; moving them to another facility does not transfer title. A seller needs explicit sales authority for those goods even when they share the manager's department. A managerial role alone neither creates ownership nor transfers it on revocation.

Assignments retain issuer, subject, role, department, facility or object scope, validity, delegation limits and exact evidence. Resolve conflicts under the owning trust policy; missing, revoked, expired or insufficient authority denies mutation. The proposed permission matrix must be implemented through existing identity and trust owners rather than a second Amway identity or trust store.`,
    sourceRefs: [DOC, TRUST, INVENTORY, GOODS, OPENING],
  },
  {
    name: "amway.inventory-and-revenue",
    title: "Inventory and revenue flow together",
    body: `The initial requested integration sources were ../21 and ../akte. Current source inspection found no stock or revenue ledger in either: 21 CRMDeal records opportunity value/currency without goods or settlement links; akte supplies workflow authorization and signed causal Assembly lineage. Treat inventory imports from these apps as an unresolved adapter requirement, not an existing capability. The actual shared goods owner is ../one/packages/supply.core, already consumed by Projektor inventory.app.

The user-identified ../aggregat contains the concrete supply-chain application reference: src/shop.core/ledger.ts folds inventory from immutable events using ConservationWriteService; service.ts handles orders, commitments, station production, movements and outbound TitleTransfer; book.ts derives inventory, valuation and traveler projections; publication.ts defines the typed publication closure. Its ShopLedger is an in-memory demo/fixture adapter, not the production durable store to copy. Adapt these application patterns over the canonical shared contracts and durable producer roots. The related seho.app inventory-and-revenue chapter is a specification reference, not evidence of an implemented revenue ledger.

Reuse these owners instead of creating a second stock ledger. An adapter must preserve source repository/system, stable object identity, exact version, units, facility, owner, custodian and provenance. Repeated import of the same source event is idempotent; unresolved identities, conflicting units or missing authority remain explicit reconciliation failures.

Each commercial transaction links the customer, seller, manager/owner, department, facility, referenced goods and quantities, price, currency, tax basis, order, delivery, title/custody events, invoice, payment and any correction. These are proposed integration requirements, not claims that either source app already has a complete sales ledger. Physical stock, available-to-sell quantity, inventory cost, recognized revenue, receivable and cash received are separate projections of the same linked evidence.

Reservation reduces availability without pretending goods moved. Movement changes location, custody transfer changes custody, title transfer changes ownership, invoicing establishes the relevant billing claim, and payment records settlement. Revenue recognition follows an explicit versioned business policy and qualifying evidence; a movement or invoice must not silently count as cash or recognized revenue. Currency totals are separate unless an explicit exchange-rate basis is supplied.

Commit each local business event with its durable links and publication intent. Advance inventory and revenue projections from an admitted event cut with a stable transaction identity and idempotent application. If one side is missing, show pending or inconsistent state and its missing evidence; never present independently updated totals as a reconciled sale. Cross-party receipt and acceptance are asynchronous, not a fictitious distributed atomic commit. Concurrent reservations cannot sell the same available units twice. Returns, cancellations, refunds and disputes append linked corrections and preserve the original transaction.

Example facility-fulfilment acceptance fixture (not a direct Amway order or an Amway commission example): manager M owns 10 units at facility F. A seller reserves 2: physical stock is 10, availability is 8. Delivery of 2 to the customer leaves 8 at F, while custody and title follow their own evidence. At an agreed net price of 100 EUR per unit, a qualifying recognition event under the declared policy yields 200 EUR revenue; cash remains zero until settlement. A 200 EUR payment settles that receivable once. Costs and margin are calculated from the selected cost basis, independently of the selling price. A return of one unit links its goods receipt and 100 EUR credit/refund correction under the same policy.`,
    sourceRefs: [DOC, INVENTORY, GOODS, OPENING, CRM, LINEAGE, SHOP, SHOP_SERVICE,
      "repo://aggregat/src/shop.core/book.ts",
      "repo://aggregat/src/shop.core/publication.ts",
      "repo://aggregat/test/shop.end-to-end.test.ts",
      "repo://aggregat/seho.app/chapters/03-inventory-and-revenue.md",
      "repo://21/packages/21.core/src/recipes/index.ts",
      "repo://one/packages/supply.core/src/inventory.ts",
      "repo://one/packages/supply.core/src/conservation.ts",
      "repo://one/packages/supply.core/src/transfers.ts",
      "repo://one/packages/supply.core/src/traceability.ts",
      "repo://one/packages/supply.core/src/valuation.ts"],
  },
  {
    name: "amway.journal",
    title: "Every trust assignment and shared Assembly",
    body: `The journal lists all trust assignments and all Assembly objects shared within the viewer's authorized scope. It includes issuance, acceptance, change, expiry and revocation evidence for assignments; and every inbound/outbound Assembly share with its exact version, author, sender, recipient or audience, department, object/transaction links, authorizing contract and sharing/receipt status. Rejected or disputed evidence stays inspectable with its status rather than disappearing behind the latest successful entry.

Distinguish the assignment claim, receiver verification and effective authority. Distinguish an Assembly's signed occurrence, a publication attempt, a peer receipt and business acceptance. Sharing the same Assembly with two recipients creates two share occurrences linked to one exact Assembly. Retries do not create new business facts. Assemblies retain their producer-owned signed closure; do not manufacture an Assembly wrapper for every unversioned certificate.

Capture journal references at assignment and share production/admission time with stable roots, durable event identities and event-driven updates. Historical changes remain append-only; revoke with new evidence. Paginate from persisted roots, with filters by department, facility, actor, recipient, type, transaction and time. The visible scope and completeness cut are explicit. All means all authorized records at that cut, not a global bypass of another department's privacy. A missing producer event or offline recipient must surface as a gap/pending status. Journal access does not itself grant access to a referenced payload.`,
    sourceRefs: [DOC, TRUST, LINEAGE, "repo://one/packages/assembly.core/src/types/Assembly.ts",
      "repo://heiner/one.flexibel/docs/architecture/domain-assembly-capabilities.md",
      "repo://heiner/one.flexibel/packages/flexibel.core/src/services/JournalIdentityQuery.ts"],
  },
  {
    name: "amway.contract-chat",
    title: "Chat from phonebook contracts",
    body: `Start a conversation from an authorized department phonebook relationship. Resolve the contact identity, effective contract, allowed purpose, participants and department before creating or opening a topic. A directory entry or shared role label is not messaging or attachment authority. The exact contract and authority decision used by the action remain traceable.

New chat uses Topic, Message, ChatMessage, ChatTrieEntry and stable ChatTrieShareManifest access roots, with peer exchange through CHUM. Reuse native identity, trust and messaging operations. Flexibel's paired-contact prerequisite is reusable product behavior, but its channel-based transport is not the new VGER chat architecture: establish a paired contact plus the effective Amway contract, then use native trie chat. The phonebook lane supplies directory, credentials and presence; it does not become a relay for chat, inventory or sales content. A separately authorized department runtime may hold working objects only under its own explicit content contracts.

Sharing an inventory item, transaction or Assembly into chat requires its own object audience check and exact reference. Membership in a topic does not imply department-wide access. Re-check effective contract authority for sending, adding participants and granting new content access. An expired or revoked contract denies future actions and publication grants while preserving already received history. Offline delivery and missing attachments are shown explicitly; a send request is not proof of peer receipt.`,
    sourceRefs: [DOC, CHAT, TRUST, PHONEBOOK, CONTACTS,
      "repo://heiner/one.flexibel/docs/chat/CHAT_ARCHITECTURE.md"],
  },
  {
    name: "amway.shop-module",
    title: "shop.amway module and operation boundary",
    body: `Plan packages/shop.amway as the Amway commercial domain module. amway.app owns this product foundation and application experience. shop.amway owns commercial operations, transaction lifecycle and Amway policy composition. The module is planned, not created or registered by this app-book change.

Proposed operation families cover catalog/offers/prices, inventory and availability, reservations/release, order acceptance, recurring-order occurrences, fulfillment, recognition, settlement, returns/cancellations and reconciliation. Import and reconcile source earnings statements separately from retail sales; do not invent compensation rules or turn points into currency. These are proposed operations, not existing callable methods. Each mutation requires authenticated actor context, exact department/facility scope, expected transaction version, idempotency identity and effective authority/contract references. Recheck authority at execution time and reject stale or unauthorized work before producing results.

Keep transaction identity, purchase channel, seller of record, exact accepted terms, price/currency, policy version and goods/commercial references in producer-owned typed ONE objects. Direct Amway fulfillment does not consume department stock; a facility sale references real manager-owned goods. Money uses exact representation with explicit rounding/residual rules. Publish durable transaction roots and exact event references. Inventory and revenue project the same admitted transaction set and expose lag. Required paired goods/commercial results form one local admission unit where persistence supports atomicity; otherwise preserve durable intent and incomplete state until reconciled. Never label an incomplete pair completed.

supply.core owns goods, conservation, location/custody/title, transfer acceptance and valuation. Aggregat shop.core supplies concrete order/fulfillment/publication patterns; its in-memory demo ledger is not production storage. Existing trust owners decide scoped role and phonebook authority. Native chat owners enforce messaging and attachment access. assembly.core owns signed occurrences. shop.amway emits durable commercial and object-sharing evidence to the journal; assignment and non-shop sharing producers independently emit their own events so the journal remains complete.

Register the same shop.amway operations through refinio.api for UI, HTTP and MCP. Chat-initiated shop actions pass the same authority, admission, concurrency and idempotency checks; a message alone cannot reserve or sell goods. Explicit delegation is required to sell manager-owned stock held at another party's facility. Do not create a second goods, identity, trust, chat or Assembly implementation.

Implementation slices: define typed transaction and policy contracts with source mappings; initialize the module and authoritative read operations; add reservation and order admission with last-unit concurrency protection; implement linked fulfillment/recognition/settlement and durable recovery; add recurring orders, returns and reconciliation; connect journal producers and contracted chat actions to the branded route. Verify each slice through public operations with real persistence before promoting evidence scope. Shared commercial mechanics can move to a shared owner when another consumer needs the same contract.`,
    sourceRefs: [DOC, GOODS, OPENING, SHOP, SHOP_SERVICE, TRUST, CHAT,
      "repo://aggregat/src/shop.core/publication.ts",
      "repo://projektor/scripts/projektor-http-server.mjs"],
  },
  {
    name: "amway.four-instance-browser-lab",
    title: "Four independent Amway instances in one browser",
    body: `Provide a dedicated demonstration route at /amway/lab that presents four independent Amway actors as columns in one browser window: country-organisation admin, department manager, seller and customer. Each column is a view of a separate amway.core runtime hosted in its own dedicated module Web Worker. ONE.core permits one instance per JavaScript runtime; the worker boundary is therefore part of the product contract, not merely a performance optimization. Each worker owns its identity, recipes, keychain, operation registry, durable IndexedDB-backed storage and projections.

Extract the Amway runtime composition from the Node HTTP server into an environment-neutral amway.core boundary with initialize, invoke, subscribe and shutdown lifecycle operations. It must not depend on HTTP, DOM or Node process state. The existing server and each browser worker consume the same registered refinio.api operations. The React application receives a transport per column rather than calling the current hard-coded /api/amway endpoint. A WebWorker transport implements ui.core's TransportAdapter contract, including event subscription; requests and results use correlated identifiers and structured errors.

The browser shell is a deterministic virtual network and observation surface. It may connect, disconnect, delay or route protocol traffic between workers, but it must not copy domain objects, mutate worker state or grant access on a worker's behalf. Cross-instance effects use the real connection, access and CHUM paths. BroadcastChannel, shared React state or direct mutation-payload fan-out cannot stand in for replication because those shortcuts bypass identity, trust and disclosure behavior.

Every column has independent navigation, selected department and session state. Identity and scope cannot use the current unqualified localStorage keys shared by the whole origin. A sticky column header shows actor, effective role, connection state and current projection/root version. The shell highlights a projection only after that worker reports a meaningful local or remote change. It distinguishes local commit, publication/share, peer receipt, admission or denial, projection change and business acceptance; it never calls an asynchronous peer update an atomic distributed commit.

Add a shared propagation timeline with origin, recipient, exact object/version reference, authorizing contract when applicable, outcome and elapsed time. An unaffected column is an explicit result such as not shared or denied, not an ambiguous lack of refresh. Demo controls may pause an instance, disconnect a link, add bounded latency, reset and reseed the lab, inspect references and replay named scenarios. Refresh is event-driven through worker subscriptions; the UI does not poll identical status.

The first proving scenario is: a manager publishes an authorized offer; the seller receives it; the seller creates a facility order for a customer; the manager observes the reservation and inventory effect; the customer observes only their authorized order projection; and the country-organisation admin observes only journal evidence permitted by policy, not private payload. The scenario records both propagation and intentional non-propagation. A reset creates four clean, distinct instance identities and leaves the normal single-instance /amway workspace available.

Current implementation: /browser/#/lab runs the four actors in independent workers through packages/amway.lab. Its catalog slice proves role-gated offer publication, exact ONE-version propagation, per-worker provenance and independently projected availability. Its initial accepted-order path proves that a customer self-purchase feeds the same admitted order version back to admin, manager and seller projections, while a seller-admitted order reaches its named customer. Persisted peer endpoints are converted back into explicit connection demand during worker startup, so a reload restores the live CHUM mesh before readiness instead of stranding subsequent purchases in the origin column. The integration suite also proves pause/resume catch-up.

The remaining Order & Reservation slice must separate customer/seller order intent from the manager-authoritative reservation decision, protect the last available unit under concurrency, and narrow the admin/out-of-scope transaction projection. Until then, admitOrder is the lab's accepted-order fixture, not the final multi-step purchase protocol. Deterministic reset, the shared propagation timeline and the complete denial/non-disclosure presentation also remain specified. Four columns backed by one server state or one shared store still do not satisfy the contract.`,
    sourceRefs: [DOC, ONE_INSTANCE, UI_TRANSPORT, BROWSER_API, AMWAY_SERVER, CHAT,
      "repo://projektor/packages/amway.lab/lab-instance.ts",
      "repo://projektor/packages/amway.lab/lab.integration.test.ts"],
  },
  {
    name: "amway.delivery-and-evidence",
    title: "Delivery stages and honest evidence",
    body: `This package delivers a native-compatible source App Book catalog and read-only definition discovery. Its flow bindings have app-book-contract scope: their tests verify catalog validity, source references and registry discovery only. They do not certify the acceptance scenarios as implemented, authorize operational actions, publish data, or materialize a Book into a user's Library.

Implementation order: capture the confirmed brand assets and resolve source mappings; wire the dedicated route and authenticated department scope; extract the environment-neutral amway.core runtime and prove four isolated browser workers; implement scoped phonebook contracts and role decisions; integrate manager-owned inventory and facility operations; couple sales, recognition and settlement to goods evidence; connect producer journal events and contract chat; then validate multi-party behavior, restart recovery, duplicate delivery, concurrent selling and revocation. Promote a journey's evidence scope only when its real runtime protocol passes.

Open inputs: deployable brand asset/font packaging; initial department/facility roster and owners; the inventory source/export and access boundary for each source app; recognized-revenue/tax/returns policy; and who may issue or delegate each role and phonebook contract. These do not block recording the product foundation. They do block silently inventing deployment configuration or business authority.`,
    sourceRefs: [DOC, FOUNDATION],
  },
];

const journey = (key, title, role, purpose, inputs, actions, outputs, checks, refs) => ({
  id: `amway.flow.${key}`, title, purpose,
  inputRequirements: inputs,
  steps: actions.map(([id, title, intent]) => ({ id, title, actorRole: role, intent })),
  outputContracts: outputs, verificationChecks: checks, sourceRefs: [DOC, ...refs],
});

const journeys = [
  journey("catalog-to-order", "Select products and the actual fulfilment channel", "seller",
    "Preserve item identity and seller-of-record evidence from catalog to order.",
    ["Versioned German-market catalog", "Customer relationship", "Seller of record", "Direct or facility fulfilment evidence"],
    [["select", "Select item and pack", "Resolve item number, variant, unit and any set components."], ["route", "Choose evidenced fulfilment", "Record whether Amway or the stock-holding business fulfils the order."], ["link", "Link the order", "Pin price and product versions and reserve local goods only for facility fulfilment."]],
    ["Order linked to exact catalog versions, seller and fulfilment source"],
    ["A direct Amway order does not reduce manager-held stock.", "Changing a catalog price or set definition preserves existing order evidence."], [BUSINESS_RESEARCH]),
  journey("recurring-order", "Follow a subscription through order occurrences", "customer",
    "Represent scheduled demand without prematurely booking sales or goods movement.",
    ["Customer authorization", "External subscription reference", "Schedule and applicable benefit policy"],
    [["record", "Record subscription", "Keep exact products, interval and authorization evidence."], ["occur", "Link executed order", "Admit each actual order occurrence once under its external identity."], ["change", "Change or cancel", "Retain the new schedule state without deleting prior orders."]],
    ["Versioned subscription and independently traceable executed orders"],
    ["A scheduled occurrence creates no recognized revenue.", "Duplicate occurrence imports cannot create duplicate orders.", "Cancellation preserves historical fulfilment evidence."], [BUSINESS_RESEARCH]),
  journey("return-and-replace", "Return products through the original seller", "customer",
    "Connect after-sales service to the original goods and financial evidence.",
    ["Original order and seller", "Applicable return/guarantee policy", "Product or set components"],
    [["request", "Route request", "Use the purchase channel to identify the responsible seller and return reference."], ["receive", "Inspect returned goods", "Link tracking, receipt, condition and set completeness evidence."], ["resolve", "Refund or replace", "Link the decision, actual refund or replacement and any performance adjustment."]],
    ["Traceable return case with separate goods, refund and replacement state"],
    ["A partner purchase is routed to that partner.", "Requesting a return does not make the item sellable or imply a refund.", "A replacement remains linked to the original order without a duplicate sale."], [BUSINESS_RESEARCH]),
  journey("reconcile-earnings", "Reconcile performance and earnings statements", "seller",
    "Explain commissions and payouts without mixing them with sales turnover.",
    ["Authorized beneficiary statement", "Period and market", "Exact order and adjustment references"],
    [["import", "Import statement", "Preserve producer identity, performance labels and exact statement version."], ["reconcile", "Reconcile source evidence", "Link orders and corrections and expose unexplained differences."], ["settle", "Match payout", "Record cash received independently of the reported entitlement."]],
    ["Scoped earnings statement with reconciliation and payout status"],
    ["Points are never added to euro totals.", "A reported commission is not treated as paid cash.", "Department membership does not grant team earnings access.", "Missing plan rules cannot be replaced with a guessed commission formula."], [BUSINESS_RESEARCH]),
  journey("enter-workspace", "Open the branded department workspace", "customer",
    "Arrive at the dedicated route and select an authorized department.",
    ["Confirmed brand assets", "Authenticated identity and effective department grants"],
    [["open", "Open /amway", "Load Amway branding and restore the deep link through sign-in."], ["select", "Select department", "List only authorized scopes and show the selected scope on every screen."]],
    ["Branded, accessible workspace with explicit department scope"],
    ["Direct navigation and reload preserve /amway.", "Changing the URL cannot disclose another department."], [FOUNDATION]),
  journey("department-phonebook", "Create a department and share its phonebook", "admin",
    "Adapt the StudyCenter organizational template to department relationships.",
    ["Department authority", "Existing person identities", "Role and phonebook contract scope"],
    [["create", "Create department", "Establish the organizational scope and responsible manager."], ["invite", "Invite contacts", "Issue scoped assignments and phonebook contracts to existing identities."], ["share", "Share directory", "Publish only permitted directory entries and journal their authority evidence."]],
    ["One shared logical phonebook per department", "Traceable scoped assignments"],
    ["A customer cannot enumerate the complete department phonebook.", "Two departments operated by the same owner retain separate phonebooks.", "Revocation stops further sharing under the revoked contract."], [TRUST, STUDYCENTER, PHONEBOOK, CONTACTS]),
  journey("manager-inventory", "Hold manager-owned goods at a facility", "manager",
    "Bring source inventory into an evidenced view with independent ownership and custody.",
    ["Authorized supply.core goods source using Aggregat shop patterns; any 21/akte input requires a defined adapter", "Manager owner identity", "Facility and custodian", "Exact goods units and versions"],
    [["map", "Resolve source identities", "Retain exact source provenance and reject unresolved mappings."], ["admit", "Admit goods evidence", "Apply each source event once under the shared goods admission policy."], ["inspect", "Inspect holdings", "Show owner, custodian, facility and source completeness independently."]],
    ["Scoped stock projection without a duplicate ledger"],
    ["Re-importing an event does not duplicate stock.", "Moving manager-owned goods between facilities preserves title."], [INVENTORY, GOODS, OPENING, CRM, LINEAGE, SHOP, SHOP_SERVICE]),
  journey("sell-and-settle", "Sell facility goods with linked inventory and revenue", "seller",
    "Keep facility goods, commercial obligations, recognition and settlement traceable together; direct orders follow their own fulfilment evidence.",
    ["Explicit selling authority", "Available goods", "Customer contract", "Price/currency and recognition policy", "Facility fulfilment and seller-of-record evidence"],
    [["reserve", "Reserve goods", "Reserve available units against one transaction identity with concurrency control."], ["fulfil", "Fulfil and invoice", "Link movement, title/custody acceptance and invoice evidence."], ["settle", "Recognize and settle", "Apply recognition policy and payment evidence separately at a declared projection cut."], ["correct", "Handle returns", "Append linked goods and financial corrections without rewriting the sale."]],
    ["Reconciled transaction with inventory, revenue, receivable and cash evidence"],
    ["Two sellers cannot reserve the same last unit.", "A missing financial or goods event is visible as pending, never a completed reconciliation.", "The 10-unit, 2-unit sale fixture in the Book recognizes 200 EUR once and does not infer payment.", "Replayed payment and return events do not double count."], [INVENTORY]),
  journey("inspect-journal", "Inspect every assignment and Assembly share", "manager",
    "Explain who trusted whom and which exact objects were shared under that authority.",
    ["Authorized journal scope", "Assignment and sharing producer roots", "Declared completeness cut"],
    [["select", "Select scope and cut", "Read persisted journal roots for the authorized department and interval."], ["inspect", "Follow evidence", "Inspect each assignment lifecycle and each inbound/outbound Assembly share and receipt."], ["trace", "Trace authority", "Follow exact contract, recipient and transaction references without widening payload access."]],
    ["Complete scoped list of assignment and Assembly-sharing occurrences"],
    ["Revoked assignments remain visible with their original evidence.", "Sharing one Assembly with two recipients yields two auditable share occurrences.", "Restart and pagination lose no admitted journal occurrences.", "Missing sharing evidence marks the journal incomplete."], [TRUST]),
  journey("contract-chat", "Chat with a contracted phonebook contact", "customer",
    "Communicate and share working objects within an effective relationship contract.",
    ["Visible paired contact identity", "Effective department phonebook contract", "Authorized participants"],
    [["resolve", "Resolve relationship", "Check current contract purpose and participants from the phonebook entry."], ["open", "Open conversation", "Use the native topic and stable chat trie manifest."], ["send", "Send and share", "Check send authority and attachment audience separately and show receipt status."]],
    ["Contract-authorized peer chat with traceable object shares"],
    ["A contact entry without a valid contract cannot authorize chat.", "Expiry on an open conversation denies new sends and grants.", "The directory lane receives no chat payload or inventory attachment.", "Chat membership cannot widen an Assembly's audience."], [CHAT, TRUST]),
  journey("observe-four-instance-propagation", "Observe one action across four independent instances", "admin",
    "Make authorized propagation and intentional non-disclosure visible without sharing application state between views.",
    ["Four distinct browser-worker identities", "Environment-neutral amway.core operations", "Real connection/access/CHUM exchange", "Event subscription and deterministic demo seed"],
    [["boot", "Boot four isolated actors", "Initialize country-organisation admin, manager, seller and customer in separate module workers with separate storage and session state."], ["connect", "Connect the virtual network", "Route protocol traffic without inspecting or copying domain payloads into another worker."], ["act", "Perform a scoped transaction", "Publish an offer and create a customer facility order through the authorized manager and seller operations."], ["observe", "Observe each projection", "Render worker-emitted commit, receipt, admission, denial and projection-change events with exact references and elapsed time."], ["recover", "Disconnect and catch up", "Pause one recipient, continue authorized work, reconnect it and observe protocol-driven catch-up without polling."]],
    ["Four independently derived role projections", "Propagation timeline including explicit non-disclosure outcomes"],
    ["Four columns are backed by four concurrently active ONE instances, not one shared store.", "A local commit appears immediately in its origin column and remote columns change only after their own worker admits exchanged evidence.", "The customer receives only their authorized order projection and cannot inspect another customer's or the department's private payload.", "The country-organisation admin's journal visibility does not grant access to private order or chat payloads.", "A disconnected instance remains stale, then catches up after reconnection through the real exchange path.", "Reset produces four clean distinct identities and reproducible starting projections."], [ONE_INSTANCE, UI_TRANSPORT, BROWSER_API, AMWAY_SERVER, CHAT]),
];

// Active only as specification validation; no operational journey is certified.
const flowBindings = journeys.map(({ id }) => ({
  id: id.replace(".flow.", ".binding."), flowId: id,
  workspaceId: AMWAY_APP_BOOK_NAME, scope: "app-book-contract", status: "active",
  allowedStarterRefs: ["role:amway-developer"], toolRequirementRefs: [], outputDestinationRefs: [],
  evidence: [{
    id: id.replace(".flow.", ".evidence.catalog."), kind: "test", cwd: ".",
    command: "node --test packages/amway.app/app-book.test.js",
    sourceRefs: ["repo://projektor/packages/amway.app/app-book.test.js"],
    verifies: ["The catalog and flow seeds satisfy native contracts and source references resolve; operational acceptance is not certified."],
  }],
}));

export const AMWAY_APP_BOOK_CATALOG = {
  book: {
    name: AMWAY_APP_BOOK_NAME, title: "Amway", kind: "workspace",
    description: "Amway departments: shared phonebooks, contract chat, manager-owned facility inventory, linked revenue, a complete scoped trust and Assembly journal, and a four-instance browser lab that makes authorized propagation visible.",
    lifecycleStage: "source", status: "available", availabilityPayload: "local",
    availabilitySourceRef: "workspace://amway/app",
    uses: ["@refinio/source.core", "@refinio/supply.core", "@projektor/inventory.app"],
    sourceRefs: [DOC, FOUNDATION, BUSINESS_RESEARCH, "repo://projektor/packages/amway.app/app-book.js"],
    entryIds: [...documents.map(({ name }) => name), ...journeys.map(({ id }) => id)],
  },
  documents, journeys, flowBindings,
};
