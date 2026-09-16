# Inventory App Book and local application

The application and Book name are `inventory`; the display title is **Inventory**.
The [catalog](../packages/inventory.app/app-book.js) is the authoritative authored
product foundation. It now has five chapters and six structured journeys,
including evidenced opening stock.

## Run the application

From this repository:

```bash
npm run inventory:start
```

Open [Inventory](http://127.0.0.1:4175). Create or unlock a local account with an
email and password, add locations, and record opening stock with its source
explanation. The app can move stock, record physical counts, filter the stock
view, and show the ordered history and exact evidence references.

Data lives in `~/.local/share/projektor/inventory`. `INVENTORY_STORAGE_DIR` changes
the directory and `INVENTORY_PORT` changes the port. The process binds only to
loopback. Restart the process to unlock a different account. Existing identity
keys are unlocked through ONE.core; its Node filesystem object storage is not
encrypted at rest. Protect the data directory with the host's filesystem and
disk protections.

This is a separate local application in the workspace. The existing static
Projektor deployment does not host its storage runtime.

## Implemented slice

- Create locations owned by the authenticated operator.
- Record goods already held and owned locally as opening stock, with exact
  material, lot, and unit versions and a source explanation stored as a BLOB.
- Move quantities between owned locations without changing custody or title.
- Record counts, including zero, and show observed-minus-recorded discrepancies
  without overwriting stock.
- Read stock, counts, and evidence after a server restart.
- Reject duplicate openings, invalid quantities, unknown references, overspending,
  and mutations against a stale inventory version.

The browser and runtime use the public `inventory` operation methods
`getSnapshot`, `addLocation`, `openLot`, `move`, and `count`. Discovery is available
at `GET /api` after login. Mutations require the current root version, the local
session cookie, and the same Origin as the runtime. Actor identity comes from
the unlocked ONE instance rather than a request parameter.

## Durable ownership and admission

The shared [`supply.core`](../../one/packages/supply.core/README.md) owns the new
`SupplyInventoryOpening` and `SupplyInventoryRoot` types, recipes, constructors,
and existing stock folds. The application
[`InventoryPlan`](../packages/inventory.app/InventoryPlan.js) owns the local
operator workflow and consumes native ONE storage.

An opening is an immutable assertion referencing exact Lot, ResourceKind, and
UnitOfMeasure versions, its operator, location, custody, title, and evidence
BLOB. It is neither a physical count nor a delivery receipt. Duplicate opening
of the same lot is rejected. This first slice supports non-serialized lots in
one explicitly named unit; unit conversion is not implemented.

The root's `(owner, id)` identity is stable. It stores location references and
one ordered sequence of exact opening, Movement, and CountObservation refs.
Root order is the local admission order; timestamps describe recorded instants
and do not reorder the sequence. The projection follows these known refs in
order, so a later opening cannot change an earlier count. It never scans ambient
storage to reconstruct an inventory. Stock quantities are not stored on the root.

The runtime serializes its writes and compares the submitted `expectedVersion`
with the current root version before mutation. It validates the projected
transition before storing an event, and commits admission by advancing the root
only after referenced objects exist. Interrupted preparation can leave
unreferenced content-addressed objects; these are not admitted inventory. This
is one local writer, not a distributed multi-writer merge protocol.

## App Book registration

The package declares `appBook` and exports `./app-book`, matching VGER's workspace
App Book resolver. Both local services expose `inventoryAppBook.getDefinition`;
`POST /api/inventoryAppBook/getDefinition` with `{}` returns the catalog in the
operation result's `product` field. The original Projektor HTTP service also
exposes this read through its existing MCP operation catalog.

In an authenticated VGER runtime, pass `{catalog: response.product}` to the
existing `appBook.materialize` operation. The native materializer supplies the
author and creates the parent Book, nested chapter Books and text documents,
FlowDefinitions, FlowBindings, evidence producers, provenance, and Library
membership. The inventory runtime has not materialized this Book into a user
Library or published inventory data Books.

## Evidence and remaining work

Bindings for opening stock, stock inspection, and count reconciliation have
scope `local-runtime`. Transfer acceptance, recall, and valuation retain
`core-contract` scope; those complete application journeys are not implemented.

```bash
npm run test:inventory
pnpm --dir ../one --filter @refinio/supply.core test
```

The runtime test uses a temporary real ONE instance through the HTTP operation
boundary. It covers opening evidence, movement of 0.1 and 0.2 out of 0.3 without
rounding drift, count discrepancies, invalid requests, concurrent stale writes,
password rejection, and restart persistence. Catalog tests check native Book
and flow contracts, provenance paths, and HTTP/MCP definition discovery.

The browser flow has also been exercised with 10 units: moving 4 to the workshop
leaves 6 at the warehouse; counting 3 at the workshop reports -1 while stock
remains 4 there.

Remaining application work: order-linked receiving, external custody and title
transfers, serialized items, unit conversion, discrepancy resolution, reactive
Book publication and sharing, and recall and valuation screens. The shared
[Supply Chain PRD](../../vger/docs/SUPPLY-CHAIN-PRD.md) remains the domain reference.
