import { calculateIdHashOfObj, calculateHashOfObj } from "../../../one/packages/one.core/lib/util/object.js";
import { getObject, storeUnversionedObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { getObjectByIdHash, storeVersionedObject } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { readBlobAsUint8Array, storeArrayBufferAsBlob } from "../../../one/packages/one.core/lib/storage-blob.js";
import { isMissingObjectError } from "../../../one/packages/source.core/dist/index.js";
import {
  createLocation, createUnitOfMeasure, createResourceKind, createLot,
  createMovement, createCountObservation, createSupplyInventoryOpening,
  createSupplyInventoryRoot, foldInventory, validateLocationWriter,
  requireName, requireTimestamp,
} from "../../../one/packages/supply.core/dist/index.js";

function fail(message) { throw new Error(message); }

/** One authenticated local operator. Every mutation commits through the ordered root. */
export class InventoryPlan {
  constructor({ owner, now = () => new Date().toISOString() }) {
    this.owner = owner;
    this.now = now;
    this.rootId = undefined;
    this.writeTail = Promise.resolve();
  }

  async init() {
    const root = createSupplyInventoryRoot({ id: "inventory", owner: this.owner, locationRefs: [], entryRefs: [] });
    this.rootId = await calculateIdHashOfObj(root);
    try {
      await getObjectByIdHash(this.rootId);
    } catch (error) {
      if (!isMissingObjectError(error)) throw error;
      await storeVersionedObject(root);
    }
    return this.getSnapshot();
  }

  async load() {
    if (!this.rootId) fail("Inventory is not initialized.");
    const stored = await getObjectByIdHash(this.rootId);
    const root = stored.obj;
    if (root.$type$ !== "SupplyInventoryRoot" || root.owner !== this.owner) fail("Inventory owner mismatch.");
    const locations = await Promise.all(root.locationRefs.map(async (ref) => {
      const { obj } = await getObjectByIdHash(ref);
      if (obj.$type$ !== "Location" || obj.owner !== this.owner) fail("Location is outside this operator's inventory.");
      return { ref, ...obj };
    }));
    const locationMap = new Map(locations.map(location => [location.ref, location]));
    const lots = new Map();
    const history = [];
    let projection = { lots: [], items: [], observations: [] };
    for (const ref of root.entryRefs) {
      const entry = await getObject(ref);
      if (entry.$type$ === "SupplyInventoryOpening") {
        const [lot, kind, unit] = await Promise.all([entry.lotVersion, entry.kindVersion, entry.unitVersion].map(ref => getObject(ref)));
        const lotRef = await calculateIdHashOfObj(lot);
        if (lot.$type$ !== "Lot" || kind.$type$ !== "ResourceKind" || unit.$type$ !== "UnitOfMeasure") fail("Opening has invalid goods references.");
        if (lot.kind !== await calculateIdHashOfObj(kind) || lot.unit !== await calculateIdHashOfObj(unit) || kind.defaultUnit !== lot.unit) fail("Opening goods references disagree.");
        if (entry.actor !== this.owner || lot.owner !== this.owner || kind.owner !== this.owner || kind.serialized || entry.custodian !== this.owner || entry.titleHolder !== this.owner) fail("Opening is outside the local operator's authority or supported goods scope.");
        if (!locationMap.has(entry.location) || lots.has(lotRef) || lot.producedBy) fail("Opening has an unknown location or duplicate/produced lot.");
        const evidence = new TextDecoder().decode(await readBlobAsUint8Array(entry.evidence));
        if (!evidence.trim()) fail("Opening evidence is empty.");
        lots.set(lotRef, { lotRef, name: kind.name, lotId: lot.lotId, unit: unit.id, openingRef: ref });
        projection.lots.push({ lot: lotRef, location: entry.location, custodian: entry.custodian, titleHolder: entry.titleHolder, quantity: lot.initialQuantity });
        history.push({ ref, type: "opening", lot: lotRef, location: entry.location, quantity: lot.initialQuantity, timestamp: entry.recordedAt, evidence });
      } else {
        if (!["Movement", "CountObservation"].includes(entry.$type$)) fail("Unsupported inventory entry.");
        this.assertEvent(entry, locationMap, lots);
        const next = foldInventory({ seedLots: projection.lots, seedItems: projection.items, events: [entry] });
        projection = { ...next, observations: [...projection.observations, ...next.observations] };
        history.push({ ref, type: entry.$type$ === "Movement" ? "movement" : "count", timestamp: entry.timestamp, event: entry });
      }
    }
    return { stored, locations, locationMap, lots, history, projection };
  }

  assertEvent(event, locationMap, lots) {
    const getLocation = ref => locationMap.get(ref) || fail("Unknown inventory location.");
    const violations = validateLocationWriter({ event, operatingParty: this.owner, getLocation });
    if (violations.length) fail(violations.map(value => value.message).join("; "));
    if (event.$type$ === "Movement") {
      getLocation(event.toLocation);
      if (event.fromLocation === event.toLocation) fail("Choose a different destination.");
      if (event.items.length || event.lots.some(value => !lots.has(value.lot))) fail("Movement references unknown goods.");
    } else if (event.actor !== this.owner || !lots.has(event.lot)) fail("Count references an unauthorized actor or unknown lot.");
  }

  async getSnapshot() {
    const state = await this.load();
    return this.snapshot(state);
  }

  snapshot({ stored, locations, lots, history, projection }) {
    return {
      rootRef: this.rootId, version: stored.hash, owner: this.owner,
      locations: locations.map(({ ref, name }) => ({ ref, name })),
      lots: [...lots.values()],
      stock: projection.lots.filter(row => row.quantity > 0).map(row => ({ ...row, ...lots.get(row.lot) })),
      observations: projection.observations,
      history,
    };
  }

  write(expectedVersion, action) {
    const work = this.writeTail.then(async () => {
      const state = await this.load();
      if (expectedVersion !== state.stored.hash) fail("Inventory changed. Refresh and review your action before submitting again.");
      const root = await action(state);
      await storeVersionedObject(createSupplyInventoryRoot(root));
      return this.getSnapshot();
    });
    // Release the single writer after failure; the caller still receives that rejection.
    this.writeTail = work.then(() => undefined, () => undefined);
    return work;
  }

  async storeDefinition(object) {
    const idHash = await calculateIdHashOfObj(object);
    try {
      const current = await getObjectByIdHash(idHash);
      if (current.hash !== await calculateHashOfObj(object)) fail("This goods or location identity already has a different definition.");
      return current;
    } catch (error) {
      if (!isMissingObjectError(error)) throw error;
      return storeVersionedObject(object);
    }
  }

  addLocation({ name, expectedVersion }) {
    return this.write(expectedVersion, async ({ stored }) => {
      const location = createLocation({ id: requireName(name, "Location name"), name, owner: this.owner });
      const ref = await calculateIdHashOfObj(location);
      if (stored.obj.locationRefs.includes(ref)) fail("That location already exists.");
      const saved = await this.storeDefinition(location);
      return { ...stored.obj, locationRefs: [...stored.obj.locationRefs, saved.idHash] };
    });
  }

  openLot({ name, lotId, unit, dimension, quantity, location, evidence, expectedVersion }) {
    return this.write(expectedVersion, async ({ stored, locationMap, lots }) => {
      if (!locationMap.has(location)) fail("Choose an inventory location.");
      const note = requireName(evidence, "Opening evidence");
      const recordedAt = requireTimestamp(this.now(), "recordedAt");
      if (!["count", "mass", "length", "volume"].includes(dimension)) fail("Unsupported unit dimension.");
      const unitObject = createUnitOfMeasure({ id: unit, dimension, baseFactor: 1 });
      const unitRef = await calculateIdHashOfObj(unitObject);
      const kindObject = createResourceKind({ id: requireName(name, "Material name"), name, owner: this.owner, defaultUnit: unitRef, serialized: false });
      const kindRef = await calculateIdHashOfObj(kindObject);
      const lotObject = createLot({ kind: kindRef, lotId, owner: this.owner, unit: unitRef, initialQuantity: quantity });
      if (lots.has(await calculateIdHashOfObj(lotObject))) fail("This lot already has opening stock.");
      const savedUnit = await this.storeDefinition(unitObject);
      const savedKind = await this.storeDefinition(kindObject);
      const savedLot = await this.storeDefinition(lotObject);
      const blob = await storeArrayBufferAsBlob(new TextEncoder().encode(note).buffer);
      const opening = createSupplyInventoryOpening({ actor: this.owner, lotVersion: savedLot.hash, kindVersion: savedKind.hash, unitVersion: savedUnit.hash, location, custodian: this.owner, titleHolder: this.owner, evidence: blob.hash, recordedAt });
      const entry = await storeUnversionedObject(opening);
      return { ...stored.obj, entryRefs: [...stored.obj.entryRefs, entry.hash] };
    });
  }

  recordEvent(expectedVersion, createEvent) {
    return this.write(expectedVersion, async (state) => {
      const event = createEvent(requireTimestamp(this.now(), "timestamp"));
      this.assertEvent(event, state.locationMap, state.lots);
      // Validate the actual projected transition before storing or advancing the root.
      foldInventory({ seedLots: state.projection.lots, events: [event] });
      const saved = await storeUnversionedObject(event);
      return { ...state.stored.obj, entryRefs: [...state.stored.obj.entryRefs, saved.hash] };
    });
  }

  move({ lot, quantity, fromLocation, toLocation, expectedVersion }) {
    return this.recordEvent(expectedVersion, timestamp => createMovement({ lots: [{ lot, quantity }], items: [], fromLocation, toLocation, timestamp }));
  }

  count({ lot, location, observedQuantity, expectedVersion }) {
    return this.recordEvent(expectedVersion, timestamp => createCountObservation({ actor: this.owner, lot, location, observedQuantity, timestamp }));
  }
}
