export const INVENTORY_APP_BOOK_NAME = "inventory";

const APP_BOOK_DOC = "repo://projektor/docs/inventory-app-book.md";
const SUPPLY_PRD = "repo://vger/docs/SUPPLY-CHAIN-PRD.md";
const SUPPLY_TEST = "repo://one/packages/supply.core/src/index.test.ts";

const documents = [
  {
    name: "inventory.people-and-purpose",
    title: "People and purpose",
    body: `Inventory helps a storekeeper, project team, purchasing colleague, and auditor answer: what goods do we have, where are they, who holds them, who owns them, and what evidence explains that state?

The storekeeper records arrivals, movements, and counts. A project team follows material at its sites and workshops. Purchasing follows orders and supplier commitments. An auditor traces changes and discrepancies back to their authors and source records. An AI works under the same explicit access and mutation authority as other participants.

The first useful result is a stock view for a selected party and location, with quantities, units, custody, title, and the underlying evidence. A stock number always belongs to a declared scope and event cut. An unavailable source or incomplete scope remains visible.

The application composes the existing supply.core model. Project assignments are consumer context referencing goods and locations; they do not create a second stock ledger. The App Book holds product meaning. Inventory data Books hold projections of goods events.`,
    sourceRefs: [APP_BOOK_DOC, SUPPLY_PRD],
  },
  {
    name: "inventory.receiving-and-orders",
    title: "Receiving goods and following orders",
    body: `The intended receiving journey begins when goods physically arrive. The receiving person selects the supplier, destination location, resource kind and unit, lot or serialized items, quantity, and any existing purchase order and commitment. Existing goods retain their identities across arrival.

Record physical movement, custody acceptance, and title transfer separately when those events actually occur. A delivery can change location without changing ownership. Verified signatures establish offered versus affirmed transfer state; creating a local transfer claim alone is not bilateral acceptance. An order can remain short or late even when a delivery has arrived.

An opening balance needs an explicit, evidenced origin and placement before it can feed the inventory projection. The local inventory runtime now stores a SupplyInventoryOpening with exact goods versions, operator, location, custody, title, and an evidence BLOB. Its SupplyInventoryRoot records the ordered admission history. Opening stock asserts goods already owned and held by the local operator; it is not a new delivery receipt. A count must never be repurposed as a goods-creation or stock-adjustment event.

The complete receiving interface, order attachment, and cross-party receipt publication remain application integration work. They are requirements in this chapter, not claimed executable receiving journeys in the current catalog.`,
    sourceRefs: [APP_BOOK_DOC, SUPPLY_PRD, "repo://one/packages/supply.core/src/inventory.ts", "repo://one/packages/supply.core/src/transfers.ts"],
  },
  {
    name: "inventory.data-flow",
    title: "Expected data flow",
    body: `The runtime supplies authenticated actor identity, location-writer authority, authorized source roots, a declared event order and cut, and the goods and unit records referenced by events. supply.core validates conservation before a local conservation event is stored. Imported invalid claims remain unchanged and produce typed violation evidence for trust evaluation.

Stock is a fold over admitted, ordered immutable events and evidenced starting placements. Movement changes location, CustodyTransfer changes custody, and TitleTransfer changes ownership. CountObservation produces discrepancy evidence. The application must identify the admission and ordering policy used by its projection; foldInventory itself is not the trust gate.

The runtime advances inventory, valuation, and traveler Book projections on admitted event arrival. source.core and the owning Book materializer persist Books; supply.core supplies projection descriptors. Identity, signatures, access, CHUM publication, and workflow execution stay with their existing owners.

Book and run outputs retain exact producer-owned event, traceability-root, rate-card, and authority references. A person can navigate from a number or decision to the evidence that produced it. Corrections add new evidence and advance projections under the applicable policy while preserving earlier claims.`,
    sourceRefs: [APP_BOOK_DOC, SUPPLY_PRD, "repo://one/packages/supply.core/README.md"],
  },
  {
    name: "inventory.invariants",
    title: "Rules and acceptance examples",
    body: `Goods are rival: a transformation, split, or merge must satisfy the exact conservation contract, including declared waste. Applied labor or machine time contributes to valuation without pretending to be conserved physical material. The single writer for a location stream is checked at admission.

Location, custody, and title are independent. Moving 10 units from the factory to a warehouse leaves total stock at 10. Transferring custody to the warehouse and title to a customer does not move or duplicate those units.

If a count observes 9 where the event fold says 10, show folded quantity 10, observed quantity 9, and discrepancy -1. The count does not overwrite stock. Investigating and resolving the discrepancy must retain both the observation and the events behind the expected quantity.

A recall follows the maintained forward traceability root through descendant goods and stops at the authorized party boundary, exposing the outbound frontier. Changing a rate card can change a valuation while the goods and event history remain unchanged. Cost-based value added and margin are explicitly different calculations.

An incomplete history cannot support a claim of complete inventory. Missing authority cannot be replaced by a permissive default. A projection descriptor is not evidence that a persisted or peer-shared inventory Book exists.`,
    sourceRefs: [APP_BOOK_DOC, SUPPLY_PRD, SUPPLY_TEST],
  },
  {
    name: "inventory.delivery-status",
    title: "Implementation and evidence boundary",
    body: `This package provides the inventory App Book catalog, a local inventory runtime, and its browser UI. The inventoryAppBook.getDefinition operation exposes the catalog. The VGER appBook.materialize operation can persist it using the existing native AppBookCatalogMaterializer and the authenticated runtime owner.

Bindings with scope core-contract certify only their declared shared-core checks. Bindings with scope local-runtime cover the authenticated single-operator HTTP runtime. The runtime test stores real ONE objects, records opening evidence, moves fractional quantities, records counts, rejects invalid or stale mutations, restarts the server, and reads back the same inventory. Browser verification also exercises opening stock, movement, and a discrepant count. Evidence does not certify cross-party delivery or Book publication.

The shared supply.core package implements event folds, durable opening and inventory-root recipes, conservation validation, traceability, transfer state, and valuation. The local runtime admits only its operator's locations and goods, serializes writes, and requires the reviewed root version on mutations. Stock and history screens expose current data and exact evidence. Application integration remains: receiving, external custody and title transfer, serialized items, unit conversion, reactive Book publication, valuation and recall screens, and cross-party end-to-end validation.`,
    sourceRefs: [APP_BOOK_DOC, "repo://projektor/packages/inventory.app/app-book.test.js", "repo://vger/packages/vger.headless/src/server.ts"],
  },
];

const journeys = [
  {
    id: "inventory.flow.open-stock",
    title: "Establish evidenced opening stock",
    purpose: "Start a local inventory with durable goods identities and an inspectable source for their starting placement.",
    inputRequirements: ["Authenticated local operator", "Owned location", "Material, lot, unit, and positive starting quantity", "Opening evidence"],
    steps: [
      { id: "location", title: "Add an owned location", actorRole: "Storekeeper", intent: "Name a location operated by the current local identity." },
      { id: "origin", title: "Record opening stock", actorRole: "Storekeeper", intent: "Record goods already owned and held here with a source explanation." },
      { id: "inspect", title: "Read the persisted stock", actorRole: "Storekeeper", intent: "Inspect the stock and its opening evidence, including after a runtime restart." },
    ],
    outputContracts: ["Evidenced SupplyInventoryOpening admitted once to the operator's SupplyInventoryRoot", "Stock and evidence survive a runtime restart"],
    verificationChecks: ["Duplicate opening of a lot is rejected.", "Opening stock and evidence survive a runtime restart."],
    sourceRefs: ["repo://one/packages/supply.core/src/inventory-records.ts", "repo://projektor/packages/inventory.app/runtime.test.js"],
  },
  {
    id: "inventory.flow.inspect-stock",
    title: "Inspect stock at a location",
    purpose: "Explain the available stock projection without conflating custody and ownership.",
    triggerHints: ["A person asks what is at a warehouse, workshop, or project site."],
    inputRequirements: ["Authorized starting placements", "Admitted ordered events", "Selected location and event cut"],
    steps: [
      { id: "select", title: "Select the scope", actorRole: "Storekeeper", intent: "Choose the party, location, and source event cut." },
      { id: "fold", title: "Project the goods", actorRole: "Inventory runtime", intent: "Fold the supplied history and select stock at the location." },
      { id: "inspect", title: "Inspect the result", actorRole: "Storekeeper", intent: "Read quantity, custody, title, and discrepancy evidence separately." },
    ],
    outputContracts: ["Scoped inventory projection with independent location, custody, and title"],
    verificationChecks: ["Location, custody, and title remain independent.", "Movements conserve total stock."],
    sourceRefs: ["repo://one/packages/supply.core/src/inventory.ts", SUPPLY_TEST],
  },
  {
    id: "inventory.flow.transfer-goods",
    title: "Move goods and inspect transfer acceptance",
    purpose: "Track physical movement and separately establish custody and title claims.",
    triggerHints: ["Goods leave a location or pass to another party."],
    inputRequirements: ["Referenced goods and quantities", "Source and destination locations", "Transfer parties", "Verified signature records"],
    steps: [
      { id: "move", title: "Record movement", actorRole: "Storekeeper", intent: "Describe the physical change of location for the referenced goods." },
      { id: "transfer", title: "Record the handover", actorRole: "Transfer parties", intent: "Express custody and title changes independently of movement." },
      { id: "verify", title: "Inspect acceptance", actorRole: "Inventory runtime", intent: "Derive offered or affirmed state from verified signatures and retain conflicting claims." },
    ],
    outputContracts: ["Independent placement changes and signature-derived transfer state"],
    verificationChecks: ["Custody and title changes do not duplicate or move stock.", "One-sided claims remain distinct from affirmed transfers."],
    sourceRefs: ["repo://one/packages/supply.core/src/transfers.ts", "repo://one/packages/supply.core/src/inventory.ts", SUPPLY_TEST],
  },
  {
    id: "inventory.flow.reconcile-count",
    title: "Compare a physical count with recorded stock",
    purpose: "Make discrepancies inspectable without rewriting the goods history.",
    triggerHints: ["A stocktake or spot check produces an observed quantity."],
    inputRequirements: ["Actor, location, and lot or item", "Observed quantity and observation instant", "Stock history through the observation"],
    steps: [
      { id: "observe", title: "Record the count", actorRole: "Counter", intent: "Retain a CountObservation identifying who counted which goods and where." },
      { id: "compare", title: "Compare with the fold", actorRole: "Inventory runtime", intent: "Calculate expected stock and the observation discrepancy." },
      { id: "investigate", title: "Inspect the discrepancy", actorRole: "Storekeeper", intent: "Use the count and goods history as evidence for a separate resolution." },
    ],
    outputContracts: ["Observation, folded quantity, and signed difference; goods quantities unchanged"],
    verificationChecks: ["A count of 9 against folded stock of 10 produces discrepancy -1 and leaves stock at 10."],
    sourceRefs: ["repo://one/packages/supply.core/src/inventory.ts", SUPPLY_TEST],
  },
  {
    id: "inventory.flow.trace-recall",
    title: "Trace affected goods for a recall",
    purpose: "Find affected descendants and the next party boundary from maintained provenance.",
    triggerHints: ["A lot or serialized item is identified as affected."],
    inputRequirements: ["Affected goods identity", "Persisted traceability root", "Authorized boundary traversal policy"],
    steps: [
      { id: "select", title: "Select affected goods", actorRole: "Auditor", intent: "Select the exact lot or item and the current traceability root." },
      { id: "descend", title: "Follow descendants", actorRole: "Inventory runtime", intent: "Follow consuming events through descendant goods and outbound transfers." },
      { id: "bound", title: "Inspect the frontier", actorRole: "Auditor", intent: "Report affected local goods and boundary-limited outbound references." },
    ],
    outputContracts: ["Descendant and outbound-frontier projection within the supplied access boundary"],
    verificationChecks: ["The persisted root retains descendants and outbound frontier after service restart.", "Provenance ascent stops at the injected boundary gate."],
    sourceRefs: ["repo://one/packages/supply.core/src/traceability.ts", SUPPLY_TEST],
  },
  {
    id: "inventory.flow.value-stock",
    title: "Value stock and work in progress",
    purpose: "Explain a valuation using an explicit rate card while preserving goods history.",
    triggerHints: ["A project team needs stock or work-in-progress value."],
    inputRequirements: ["Inventory projection", "Selected rate card and currency", "Goods provenance", "Work-in-progress locations when applicable"],
    steps: [
      { id: "choose", title: "Choose the valuation basis", actorRole: "Project controller", intent: "Select the rate card, scope, and cost or margin calculation." },
      { id: "calculate", title: "Calculate from provenance", actorRole: "Inventory runtime", intent: "Roll up goods and applied-resource costs against the selected basis." },
      { id: "compare", title: "Compare valuations", actorRole: "Project controller", intent: "Inspect how another rate card changes value for the same goods." },
    ],
    outputContracts: ["Valuation for the selected rate card and scope; goods records unchanged"],
    verificationChecks: ["Changing the rate card changes cost without mutating goods.", "Work-in-progress valuation uses the selected locations and remaining quantity."],
    sourceRefs: ["repo://one/packages/supply.core/src/valuation.ts", SUPPLY_TEST],
  },
];

// Core evidence is deliberately scoped below the complete application journey.
const localRuntimeFlows = new Set(["inventory.flow.open-stock", "inventory.flow.inspect-stock", "inventory.flow.reconcile-count"]);
const flowBindings = journeys.map((journey) => ({
  id: journey.id.replace(".flow.", ".binding."),
  flowId: journey.id,
  workspaceId: INVENTORY_APP_BOOK_NAME,
  scope: localRuntimeFlows.has(journey.id) ? "local-runtime" : "core-contract",
  status: "active",
  allowedStarterRefs: ["role:inventory-developer"],
  toolRequirementRefs: [],
  outputDestinationRefs: [],
  evidence: localRuntimeFlows.has(journey.id) ? [{
    id: journey.id.replace(".flow.", ".evidence.local-runtime."),
    kind: "test",
    cwd: ".",
    command: "node --test packages/inventory.app/runtime.test.js",
    sourceRefs: ["repo://projektor/packages/inventory.app/runtime.test.js"],
    verifies: journey.id === "inventory.flow.reconcile-count"
      ? ["Counts report the observed-minus-recorded discrepancy without changing stock."]
      : journey.verificationChecks,
  }] : [{
    id: journey.id.replace(".flow.", ".evidence.supply-core."),
    kind: "test",
    cwd: "../one",
    command: "pnpm --filter @refinio/supply.core test",
    sourceRefs: [SUPPLY_TEST],
    verifies: journey.verificationChecks,
  }],
}));

/** Package-owned seed; the native materializer supplies author and ONE identity. */
export const INVENTORY_APP_BOOK_CATALOG = {
  book: {
    name: INVENTORY_APP_BOOK_NAME,
    title: "Inventory",
    kind: "workspace",
    description: "Inventory management: goods, locations, custody, ownership, counts, traceability, and valuation from evidenced events.",
    lifecycleStage: "source",
    status: "available",
    availabilityPayload: "local",
    availabilitySourceRef: "workspace://inventory/app",
    uses: ["@refinio/supply.core", "@refinio/source.core"],
    sourceRefs: [APP_BOOK_DOC, SUPPLY_PRD, "repo://projektor/packages/inventory.app/app-book.js"],
    entryIds: [...documents.map((document) => document.name), ...journeys.map((journey) => journey.id)],
  },
  documents,
  journeys,
  flowBindings,
};
