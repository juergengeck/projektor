// packages/lab.core/lab-plan.ts
/**
 * The lab's domain plan. Writes are ONE versioned objects whose disclosure is
 * a sender-side access grant to the projected audience; CHUM carries them.
 * Reads enumerate a department through its id-object reverse map and
 * re-project authority locally. Nothing here knows about other workers.
 */
import { storeVersionedObject, getObjectByIdHash, hasVersionHead, isMissingVersionHeadError } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { calculateIdHashOfObj } from "../../../one/packages/one.core/lib/util/object.js";
import { getAllIdObjectEntries } from "../../../one/packages/one.core/lib/reverse-map-query.js";
import { createAccess } from "../../../one/packages/one.core/lib/access.js";
import { SET_ACCESS_MODE } from "../../../one/packages/one.core/lib/storage-base-common.js";
import { getInstanceOwnerIdHash } from "../../../one/packages/one.core/lib/instance.js";
import { ensureIdHash } from "../../../one/packages/one.core/lib/util/type-checks.js";
import type { SHA256IdHash } from "../../../one/packages/one.core/lib/util/type-checks.js";
import type { OneVersionedObjectTypeNames, Person } from "../../../one/packages/one.core/lib/recipes.js";
import type ConnectionsModel from "../../../one/packages/one.models/lib/models/ConnectionsModel.js";

// Custom lab types live outside the framework's closed type world, so values
// crossing into one.core APIs are validated (ensureIdHash) or cast (as never)
// at these boundary helpers — never inside domain logic.
const idHashOf = (value: string): SHA256IdHash<never> => ensureIdHash(value);
const typeNameOf = (value: string): OneVersionedObjectTypeNames => value as OneVersionedObjectTypeNames;
import { createLabObjects, createLabRecipes } from "./recipes.ts";
import type {
  LabContact,
  LabDepartment,
  LabObject,
  LabOffer,
  LabOfferShare,
  LabOfferAcceptance,
  LabOrder,
  LabPurchaseDecision,
  LabPurchaseRequest,
  LabRoleAssignment,
  LabStockReceipt,
} from "./recipes.ts";
import { createProjection } from "./projection.ts";
import type { DepartmentProjection } from "./projection.ts";
import { createIoMOps } from "./iom.ts";
import type { LabBrand } from "./brand.ts";

const versioned = (obj: LabObject): never => obj as never;

interface DepartmentState {
  deptIdHash: string;
  department: LabDepartment | null;
  assignments: LabRoleAssignment[];
  contacts: LabContact[];
  offers: LabOffer[];
  orders: LabOrder[];
  offerAcceptances: LabOfferAcceptance[];
  offerShares: LabOfferShare[];
  offerHandoffs: Record<string, LabOfferShare>;
  offerIdHashes: Record<string, string>;
  offerVersions: Record<string, { offer: LabOffer; idHash: string }>;
  purchaseRequests: LabPurchaseRequest[];
  purchaseDecisions: LabPurchaseDecision[];
  stock: LabStockReceipt[];
}

export interface FeedRowInput {
  obj: Record<string, unknown>;
  idHash: string;
  hash: string;
}

export function createLabPlan({ brand, connections, iomConnections, now = () => Date.now(), email, appBaseUrl }: {
  brand: LabBrand;
  connections: ConnectionsModel;
  /** IoM-dedicated connections: pairing listener homed on the commserver. */
  iomConnections: ConnectionsModel;
  now?: () => number;
  /** Instance owner email; IoM invitations name it as the identity hint. */
  email: string;
  /** Lane entry URL prefix the QR-encoded IoM invitation links back to. */
  appBaseUrl: string;
}) {
  const { types } = createLabRecipes(brand);
  const objects = createLabObjects(brand);
  const { stock, audience, canPublish, projectDepartment, rolesOf, owningSellers, validSellerOfferShare } = createProjection(brand);
  const KIND_OF_TYPE: Record<string, string> = {
    [types.Department]: "department", [types.RoleAssignment]: "assignment", [types.Contact]: "contact",
    [types.Offer]: "offer", [types.Order]: "order", [types.PurchaseRequest]: "purchase-request",
    [types.PurchaseDecision]: "purchase-decision", [types.StockReceipt]: "stock",
    [types.OfferShare]: "offer-share", [types.OfferAcceptance]: "offer-acceptance",
  };
  const ID_FIELD: Record<string, string> = {
    [types.Department]: "department", [types.RoleAssignment]: "subject", [types.Contact]: "person",
    [types.Offer]: "offerId", [types.Order]: "idempotencyKey", [types.PurchaseRequest]: "idempotencyKey",
    [types.PurchaseDecision]: "idempotencyKey", [types.StockReceipt]: "receiptId",
    [types.OfferShare]: "offer", [types.OfferAcceptance]: "idempotencyKey",
  };
  const fail = (message: string): never => { throw new Error(`${brand.label}: ${message}`); };
  const self = (): string => {
    const owner = getInstanceOwnerIdHash();
    if (!owner) throw new Error(`${brand.label}: instance has no owner.`);
    return owner;
  };

  // Admissions check the shared balance and then write: without a lock two
  // concurrent admissions on this worker both pass the check against the
  // same pre-write state and oversell. The chain below serializes
  // admissions on this instance so the second re-checks against the first's
  // write and fails fast; concurrent admissions on different workers
  // converge through deterministic settlement in the projection.
  let admitTail: Promise<void> = Promise.resolve();
  async function serializedAdmit<T>(work: () => Promise<T>): Promise<T> {
    const previous = admitTail;
    let release!: () => void;
    admitTail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }

  const departmentIdHash = (department: string): Promise<string> =>
    calculateIdHashOfObj(versioned({ $type$: types.Department, department, name: "", admin: "0".repeat(64) }));

  async function latest<T extends LabObject>(idHashes: string[]): Promise<T[]> {
    const objs: T[] = [];
    for (const idHash of idHashes) {
      try {
        objs.push((await getObjectByIdHash(idHashOf(idHash))).obj as unknown as T);
      } catch (error) {
        // CHUM materializes a referenced exact version before selecting its
        // head, so a reverse-map entry may briefly outrun its readable
        // version. That row has not arrived yet; anything else is a failure.
        if (!isMissingVersionHeadError(error)) throw error;
      }
    }
    return objs;
  }

  async function loadByIdHash(deptIdHash: string): Promise<DepartmentState> {
    const [assignments, contacts, offers, orders, purchaseRequests, purchaseDecisions, stock, offerAcceptances, offerShares] = await Promise.all([
      latest<LabRoleAssignment>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.RoleAssignment))),
      latest<LabContact>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.Contact))),
      latest<LabOffer>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.Offer))),
      latest<LabOrder>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.Order))),
      latest<LabPurchaseRequest>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.PurchaseRequest))),
      latest<LabPurchaseDecision>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.PurchaseDecision))),
      latest<LabStockReceipt>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.StockReceipt))),
      latest<LabOfferAcceptance>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.OfferAcceptance))),
      latest<LabOfferShare>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf(types.OfferShare))),
    ]);
    const offerVersions: DepartmentState["offerVersions"] = {};
    const offerHandoffs: DepartmentState["offerHandoffs"] = {};
    const offerIdHashes: DepartmentState["offerIdHashes"] = {};
    for (const offer of offers) offerIdHashes[offer.offerId] = await calculateIdHashOfObj(versioned(offer));
    for (const acceptance of offerAcceptances) {
      const offer = await getObject(acceptance.offerVersion) as unknown as LabOffer;
      offerVersions[acceptance.offerVersion] = { offer, idHash: await calculateIdHashOfObj(versioned(offer)) };
      if (acceptance.handoff !== acceptance.offerVersion) {
        offerHandoffs[acceptance.handoff] = await getObject(acceptance.handoff) as unknown as LabOfferShare;
      }
    }
    // Not yet replicated is a normal state, asked explicitly — no error swallowing.
    let departmentObj: LabDepartment | null = null;
    if (await hasVersionHead(idHashOf(deptIdHash))) {
      try {
        departmentObj = (await getObjectByIdHash(idHashOf(deptIdHash))).obj as unknown as LabDepartment;
      } catch (error) {
        // Head selected and then transiently unreadable (concurrent head
        // swap): report not-replicated rather than a storage crash.
        if (!isMissingVersionHeadError(error)) throw error;
      }
    }
    if (!departmentObj) {
      return { deptIdHash, department: null, assignments, contacts, offers, orders, purchaseRequests, purchaseDecisions, stock, offerAcceptances, offerShares, offerVersions, offerHandoffs, offerIdHashes };
    }
    return { deptIdHash, department: departmentObj, assignments, contacts, offers, orders, purchaseRequests, purchaseDecisions, stock, offerAcceptances, offerShares, offerVersions, offerHandoffs, offerIdHashes };
  }

  async function load(department: string): Promise<DepartmentState> {
    return loadByIdHash(await departmentIdHash(department));
  }

  async function grant(idHash: string, people: string[]): Promise<void> {
    await createAccess([{
      id: idHashOf(idHash),
      person: people as SHA256IdHash<Person>[],
      hashGroup: [],
      mode: SET_ACCESS_MODE.ADD,
    }]);
  }

  async function requireDepartment(department: string): Promise<DepartmentState & { department: LabDepartment }> {
    const state = await load(department);
    if (!state.department) fail(`department ${department} has not reached this instance.`);
    return state as DepartmentState & { department: LabDepartment };
  }

  async function offerIdHash(state: DepartmentState, offerId: string): Promise<string | undefined> {
    for (const candidate of await getAllIdObjectEntries(idHashOf(state.deptIdHash), typeNameOf(types.Offer))) {
      try {
        const obj = (await getObjectByIdHash(idHashOf(candidate))).obj as LabOffer;
        if (obj.offerId === offerId) return candidate;
      } catch (error) {
        if (!isMissingVersionHeadError(error)) throw error;
      }
    }
    return undefined;
  }

  async function publish(kind: string, state: DepartmentState & { department: LabDepartment }, obj: LabObject, subject?: string): Promise<{ idHash: string }> {
    const author = self();
    if (!canPublish(kind, { department: state.department, assignments: state.assignments, author, subject, atTime: now() })) {
      fail(`${author} may not publish ${kind} in ${state.department.department}.`);
    }
    const stored = await storeVersionedObject(versioned(obj));
    await grant(stored.idHash, audience(kind, { department: state.department, assignments: state.assignments, row: obj }));
    return { idHash: stored.idHash };
  }

  async function placeOrderRecord({ state, offer, quantity, idempotencyKey, allowExisting }: {
    state: DepartmentState & { department: LabDepartment };
    offer: string;
    quantity: number;
    idempotencyKey?: string;
    allowExisting: boolean;
  }): Promise<{ idHash: string; idempotencyKey: string; order: LabOrder }> {
    const offerRow = state.offers.find(entry => entry.offerId === offer);
    if (!offerRow) throw new Error(`${brand.label}: offer ${offer} is not known in ${state.department.department}.`);
    const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
    if (!roles.has("customer")) fail("only a customer may place an order.");
    const key = idempotencyKey ?? `${brand.orderKeyPrefix}-${now()}`;
    const existing = state.orders.find(entry => entry.idempotencyKey === key);
    if (existing) {
      if (!allowExisting) fail(`order ${key} is already placed.`);
      if (existing.customer !== self() || existing.offer !== offer || existing.quantity !== quantity) {
        fail(`purchase retry ${key} does not match the original order.`);
      }
      const idHash = await calculateIdHashOfObj(versioned(existing));
      await grant(idHash, audience("order", { department: state.department, assignments: state.assignments, row: existing }));
      return { idHash, idempotencyKey: key, order: existing };
    }
    const order = objects.createOrder({
      department: state.deptIdHash, idempotencyKey: key,
      customer: self(), seller: self(), offer, quantity, lot: stock.lot, facility: stock.facility,
      // The price is agreed at placement: admission settles exactly this,
      // never a later offer price.
      currency: offerRow.currency, unitAmount: offerRow.unitAmount, admittedAt: 0,
    });
    const result = await publish("order", state, order, self());
    return { ...result, idempotencyKey: key, order };
  }

  function settledQuantity(state: DepartmentState): number {
    const stocked = state.stock.reduce((sum, entry) => sum + entry.quantity, 0);
    let settled = 0;
    for (const entry of state.orders
      .filter(order => order.admittedAt > 0)
      .sort((a, b) => a.admittedAt - b.admittedAt ||
        (a.idempotencyKey < b.idempotencyKey ? -1 : a.idempotencyKey > b.idempotencyKey ? 1 : 0))) {
      if (settled + entry.quantity <= stocked) settled += entry.quantity;
    }
    return settled;
  }

  async function admitPlacedOrder(state: DepartmentState & { department: LabDepartment }, placed: LabOrder): Promise<{ idHash: string }> {
    const stocked = state.stock.reduce((sum, entry) => sum + entry.quantity, 0);
    const settled = settledQuantity(state);
    if (placed.quantity > stocked - settled) {
      fail(`order ${placed.idempotencyKey} wants ${placed.quantity} units but only ${stocked - settled} are available.`);
    }
    const obj = objects.createOrder({
      department: state.deptIdHash, idempotencyKey: placed.idempotencyKey,
      customer: placed.customer, seller: self(), offer: placed.offer, quantity: placed.quantity,
      lot: placed.lot, facility: placed.facility,
      currency: placed.currency, unitAmount: placed.unitAmount, admittedAt: now(),
    });
    return publish("order", state, obj, placed.customer);
  }

  async function processAutomaticPurchase(result: FeedRowInput): Promise<void> {
    const type = result.obj.$type$;
    if (![types.RoleAssignment, types.Order, types.PurchaseRequest, types.StockReceipt].includes(type as string)) return;
    const department = result.obj.department;
    if (typeof department !== "string") return;
    await serializedAdmit(async () => {
      const state = await loadByIdHash(department);
      if (!state.department) return;
      const readyState = state as DepartmentState & { department: LabDepartment };
      const eventKey = type === types.Order || type === types.PurchaseRequest
        ? result.obj.idempotencyKey
        : undefined;
      const requests = typeof eventKey === "string"
        ? state.purchaseRequests.filter(entry => entry.idempotencyKey === eventKey)
        : state.purchaseRequests;
      for (const request of requests) {
        const decision = state.purchaseDecisions.find(entry => entry.idempotencyKey === request.idempotencyKey);
        const placed = state.orders.find(entry => entry.idempotencyKey === request.idempotencyKey);
        if (!placed || placed.customer !== request.customer) continue;
        const customerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: request.customer, atTime: now() });
        const ownsCustomer = request.seller === self() &&
          owningSellers(state.department, state.assignments, request.customer, now()).includes(self());
        const sellerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
        if (!customerRoles.has("customer") || !sellerRoles.has("seller") || !ownsCustomer) continue;
        if (decision) {
          const decisionIdHash = await calculateIdHashOfObj(versioned(decision));
          await grant(decisionIdHash, audience("purchase-decision", {
            department: state.department, assignments: state.assignments, row: decision,
          }));
          continue;
        }
        if (placed.admittedAt > 0) {
          const admittedIdHash = await calculateIdHashOfObj(versioned(placed));
          await grant(admittedIdHash, audience("order", {
            department: state.department, assignments: state.assignments, row: placed,
          }));
          continue;
        }
        const stocked = state.stock.reduce((sum, entry) => sum + entry.quantity, 0);
        const settled = settledQuantity(state);
        if (placed.quantity > stocked - settled) {
          await publish("purchase-decision", readyState, objects.createPurchaseDecision({
            department: state.deptIdHash, idempotencyKey: placed.idempotencyKey,
            customer: placed.customer, seller: self(), outcome: "rejected", reason: "out-of-stock", decidedAt: now(),
          }), placed.customer);
          continue;
        }
        await admitPlacedOrder(readyState, placed);
        // Refresh before considering another request from the same triggering
        // event so every stock check includes the admission just written.
        state.orders = (await loadByIdHash(department)).orders;
      }
    });
  }

  async function recoverAutomaticPurchases(): Promise<void> {
    const requestIds = await getAllIdObjectEntries(idHashOf(self()), typeNameOf(types.PurchaseRequest));
    for (const request of await latest<LabPurchaseRequest>(requestIds)) {
      await processAutomaticPurchase({ obj: request as unknown as Record<string, unknown>, idHash: "", hash: "" });
    }
  }

  async function replayOfferShares(state: DepartmentState & { department: LabDepartment }): Promise<void> {
    const shares = await latest<LabOfferShare>(await getAllIdObjectEntries(idHashOf(state.deptIdHash), typeNameOf(types.OfferShare)));
    const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
    for (const share of shares) {
      // Only the sharing person's devices apply this private intent. Recheck
      // the same authority as the command before creating any local grant.
      if (share.sharedBy !== self()) continue;
      const required = share.recipientRole === "seller" ? "manager" : share.recipientRole === "customer" ? "seller" : null;
      if (!required || (!roles.has(required) && self() !== state.department.admin)) continue;
      const recipientRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: share.recipient, atTime: now() });
      if (!recipientRoles.has(share.recipientRole)) continue;
      if (brand.id === "igm" && share.recipientRole === "seller" && !validSellerOfferShare({ department: state.department, assignments: state.assignments, share, recipient: share.recipient, offer: share.offer, atTime: now() })) continue;
      if (await hasVersionHead(idHashOf(share.offer))) {
        if (brand.id === "igm" && share.recipientRole === "seller") await grant(await calculateIdHashOfObj(versioned(share)), [share.recipient]);
        await grant(share.offer, [share.recipient]);
      }
    }
  }

  async function recordOfferShare(state: DepartmentState & { department: LabDepartment }, offer: string, recipient: string, recipientRole: "seller" | "customer"): Promise<void> {
    const intent = objects.createOfferShare({
      department: state.deptIdHash, offer, recipient, recipientRole, sharedBy: self(), sharedAt: now(),
    });
    await grant(await calculateIdHashOfObj(versioned(intent)), brand.id === "igm" && recipientRole === "seller" ? [self(), recipient] : [self()]);
    await storeVersionedObject(versioned(intent));
  }

  async function grantMembership(state: DepartmentState & { department: LabDepartment }, assignment: LabRoleAssignment): Promise<void> {
    const team = audience("assignment", { department: state.department, assignments: state.assignments, row: assignment });
    await grant(state.deptIdHash, team);
    for (const row of state.assignments) await grant(await calculateIdHashOfObj(versioned(row)), team);
    // Membership disclosure belongs to the appointing person. Private contacts
    // retain their own audience rather than becoming a team-wide directory.
    for (const row of [...state.contacts, ...state.offers, ...state.orders, ...state.offerAcceptances, ...state.purchaseRequests, ...state.purchaseDecisions]) {
      await grant(await calculateIdHashOfObj(versioned(row)), audience(KIND_OF_TYPE[row.$type$], {
        department: state.department, assignments: state.assignments, row,
      }));
    }
    const holders = new Set<string>([state.department.admin]);
    for (const entry of state.assignments) {
      const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: entry.subject, atTime: now() });
      if (roles.has("manager") || roles.has("seller")) holders.add(entry.subject);
    }
    for (const row of state.stock) await grant(await calculateIdHashOfObj(versioned(row)), [...holders]);
  }

  async function processDisclosures(result: FeedRowInput): Promise<void> {
    const type = String(result.obj.$type$);
    if (!KIND_OF_TYPE[type]) return;
    const deptIdHash = type === types.Department ? result.idHash : String(result.obj.department);
    const state = await loadByIdHash(deptIdHash);
    if (!state.department) return;
    const author = self();
    if (type === types.RoleAssignment && result.obj.issuer === author) {
      const assignment = result.obj as unknown as LabRoleAssignment;
      if (rolesOf({ department: state.department, assignments: state.assignments, subject: assignment.subject, atTime: now() }).has(assignment.role)) {
        await grantMembership(state as DepartmentState & { department: LabDepartment }, assignment);
      }
    }
    const owns = (row: LabObject): boolean => {
      switch (row.$type$) {
        case types.Department: return (row as LabDepartment).admin === author;
        case types.RoleAssignment: return (row as LabRoleAssignment).issuer === author;
        case types.Contact: return (row as LabContact).person === author && (row as LabContact).publishedBy === author;
        case types.Offer: return (row as LabOffer).publishedBy === author;
        case types.OfferAcceptance: return (row as LabOfferAcceptance).acceptedBy === author;
        case types.StockReceipt: return (row as LabStockReceipt).receivedBy === author;
        case types.PurchaseRequest: return (row as LabPurchaseRequest).customer === author;
        case types.PurchaseDecision: return (row as LabPurchaseDecision).seller === author;
        case types.Order: {
          const order = row as LabOrder;
          return order.customer === author || (order.admittedAt !== 0 && order.seller === author);
        }
        default: return false;
      }
    };
    // Another device publishes as this same person, but its local grants do
    // not travel with the object. Replay only the publisher's domain audience.
    // Membership arrivals also revisit owned roots (including private contacts
    // published before their seller was appointed). Foreign rows keep their
    // existing disclosure; an offer audience never includes explicit shares.
    const rows: LabObject[] = [types.Department, types.RoleAssignment].includes(type)
      ? [state.department, ...state.assignments, ...state.contacts, ...state.offers, ...state.orders, ...state.offerAcceptances,
        ...state.purchaseRequests, ...state.purchaseDecisions, ...state.stock]
      : [result.obj as unknown as LabObject];
    for (const row of rows) {
      if (!owns(row)) continue;
      await grant(await calculateIdHashOfObj(versioned(row)), audience(KIND_OF_TYPE[row.$type$], {
        department: state.department, assignments: state.assignments, row,
      }));
    }
    await replayOfferShares(state as DepartmentState & { department: LabDepartment });
  }

  const plan = {
    whoAmI(): { person: string } {
      return { person: self() };
    },

    async createDepartment({ department, name }: { department: string; name: string }): Promise<{ departmentIdHash: string }> {
      const stored = await storeVersionedObject(versioned(objects.createDepartment({ department, name, admin: self() })));
      await grant(stored.idHash, [self()]);
      return { departmentIdHash: stored.idHash };
    },

    async assignRole({ department, subject, role }: { department: string; subject: string; role: string }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const obj = objects.createRoleAssignment({ department: state.deptIdHash, subject, role, issuer: self(), validFrom: now() });
      // Admin-driven appointments belong to the root admin; Amway keeps its delegated chain.
      const issuerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
      if (brand.appointmentAuthority === "admin" && self() !== state.department.admin) {
        fail(brand.id === "ek" ? "only AG may appoint roles." : "only the department admin may appoint roles.");
      }
      if (role === "admin" && self() !== state.department.admin) {
        fail("only the department admin may appoint admins.");
      }
      if (role === "manager" && self() !== state.department.admin) {
        fail("only the department admin may appoint managers.");
      }
      if (role === "seller" && self() !== state.department.admin && !issuerRoles.has("manager")) {
        fail("only the department admin or a manager may appoint sellers.");
      }
      if (role === "customer" && self() !== state.department.admin && !issuerRoles.has("seller")) {
        fail("only the seller may appoint customers.");
      }
      const result = await publish("assignment", state, obj, subject);
      const next = await requireDepartment(department);
      await grantMembership(next, obj);
      return result;
    },

    async publishContact({ department, name, role }: { department: string; name: string; role: string }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const obj = objects.createContact({ department: state.deptIdHash, person: self(), name, role, publishedBy: self(), publishedAt: now() });
      return publish("contact", state, obj, self());
    },

    async publishOffer({ department, offerId, item, priceList, unitAmount, currency }: {
      department: string; offerId: string; item: string; priceList: string; unitAmount: number; currency: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const obj = objects.createOffer({ department: state.deptIdHash, offerId, item, priceList, channel: "facility", unitAmount, currency, publishedBy: self() });
      return publish("offer", state, obj);
    },

    /**
     * The department admin is also the purchasing department: receiving
     * goods stocks up the facility inventory every member projects from.
     * The receipt id makes stocking idempotent — re-recording the same
     * receipt replaces it instead of counting the goods twice.
     */
    async stockUp({ department, receiptId, quantity, lot, facility }: {
      department: string; receiptId: string; quantity: number; lot?: string; facility?: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      if (self() !== state.department.admin) {
        fail("only the department admin (purchasing) may stock up inventory.");
      }
      const obj = objects.createStockReceipt({
        department: state.deptIdHash, receiptId,
        lot: lot ?? stock.lot, facility: facility ?? stock.facility,
        quantity, receivedBy: self(), receivedAt: now(),
      });
      return publish("stock", state, obj);
    },

    /**
     * The seller shares a published offer down with an appointed customer.
     * This is the only way inventory reaches customers: publishing discloses
     * to sellers through their manager, never further. Pure disclosure, no
     * price change; the private sharing intent also reaches our other devices.
     */
    async shareOffer({ department, offerId, customer }: {
      department: string; offerId: string; customer: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
      if (!roles.has("seller") && self() !== state.department.admin) {
        fail("only the seller may share offers with customers.");
      }
      const customerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: customer, atTime: now() });
      if (!customerRoles.has("customer")) {
        fail("offers are shared with appointed customers only.");
      }
      if (!state.offers.some(entry => entry.offerId === offerId)) {
        fail(`offer ${offerId} is not known in ${department}.`);
      }
      const idHash = await offerIdHash(state, offerId);
      if (!idHash) throw new Error(`${brand.label}: offer ${offerId} has not reached this instance.`);
      await grant(idHash, [customer]);
      await recordOfferShare(state, idHash, customer, "customer");
      return { idHash };
    },

    /**
     * The manager shares a published offer down with a chosen seller.
     * Publishing alone never reaches sellers: this explicit step is the
     * only way inventory arrives at a seller, mirroring shareOffer.
     * The private sharing intent lets other devices apply the same disclosure.
     */
    async shareOfferWithSeller({ department, offerId, seller }: {
      department: string; offerId: string; seller: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
      if (!roles.has("manager") && self() !== state.department.admin) {
        fail("only the manager may share offers with sellers.");
      }
      const sellerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: seller, atTime: now() });
      if (!sellerRoles.has("seller")) {
        fail("offers are shared with appointed sellers only.");
      }
      if (!state.offers.some(entry => entry.offerId === offerId)) {
        fail(`offer ${offerId} is not known in ${department}.`);
      }
      const idHash = await offerIdHash(state, offerId);
      if (!idHash) throw new Error(`${brand.label}: offer ${offerId} has not reached this instance.`);
      await grant(idHash, [seller]);
      await recordOfferShare(state, idHash, seller, "seller");
      return { idHash };
    },

    /** Acknowledges an upstream IGM offer without settling inventory or money. */
    async acceptOffer({ department, offerId, quantity, idempotencyKey }: {
      department: string; offerId: string; quantity: number; idempotencyKey?: string;
    }): Promise<{ idHash: string; idempotencyKey: string }> {
      return serializedAdmit(async () => {
        const state = await requireDepartment(department);
        const author = self();
        const roleContext = { department: state.department, assignments: state.assignments, atTime: now() };
        if (!canPublish("offer-acceptance", { ...roleContext, author })) fail("only IGM managers or sellers may accept upstream offers.");
        if (!state.offers.some(entry => entry.offerId === offerId)) return fail(`offer ${offerId} is not known in ${department}.`);
        const offerHash = await offerIdHash(state, offerId);
        if (!offerHash) return fail(`offer ${offerId} has not reached this instance.`);
        const key = idempotencyKey ?? `accept-${offerHash}-${author}`;
        const existing = state.offerAcceptances.find(entry => entry.idempotencyKey === key);
        if (existing) {
          if (existing.acceptedBy !== author || existing.offer !== offerHash || existing.quantity !== quantity) fail(`acceptance retry ${key} does not match the original acceptance.`);
          const idHash = await calculateIdHashOfObj(versioned(existing));
          await grant(idHash, audience("offer-acceptance", { department: state.department, assignments: state.assignments, row: existing }));
          return { idHash, idempotencyKey: key };
        }
        const roles = rolesOf({ ...roleContext, subject: author });
        const offerRoot = await getObjectByIdHash(idHashOf(offerHash));
        const offer = offerRoot.obj as unknown as LabOffer;
        const offerVersion = offerRoot.hash;
        if (!canPublish("offer", { ...roleContext, author: offer.publishedBy })) return fail(`offer ${offerId} publisher is not authorized.`);
        if (offer.publishedBy === author) fail("an offer publisher may not accept their own offer.");
        let acceptedFrom: string;
        let handoff: string;
        if (roles.has("manager")) {
          if (offer.publishedBy !== state.department.admin) fail("managers may accept only department-admin offers.");
          acceptedFrom = offer.publishedBy;
          handoff = offerVersion;
        } else {
          const shares: { share: LabOfferShare; hash: string }[] = [];
          for (const candidate of state.offerShares) {
            const root = await getObjectByIdHash(idHashOf(await calculateIdHashOfObj(versioned(candidate))));
            const share = root.obj as unknown as LabOfferShare;
            if (share.department === state.deptIdHash && validSellerOfferShare({
              department: state.department, assignments: state.assignments, share, recipient: author, offer: offerHash, atTime: roleContext.atTime,
            })) shares.push({ share, hash: root.hash });
          }
          shares.sort((a, b) => b.share.sharedAt - a.share.sharedAt || a.share.sharedBy.localeCompare(b.share.sharedBy));
          const selected = shares[0];
          if (!selected) return fail("sellers may accept only offers shared by an upstream manager or admin.");
          acceptedFrom = selected.share.sharedBy;
          handoff = selected.hash;
        }
        const acceptance = objects.createOfferAcceptance({ department: state.deptIdHash, idempotencyKey: key,
          offer: offerHash, offerVersion, handoff, offerId, quantity, acceptedBy: author, acceptedFrom,
          acceptedAt: roleContext.atTime, unitAmount: offer.unitAmount, currency: offer.currency });
        const idHash = await calculateIdHashOfObj(versioned(acceptance));
        await grant(idHash, audience("offer-acceptance", { department: state.department, assignments: state.assignments, row: acceptance }));
        await storeVersionedObject(versioned(acceptance));
        return { idHash, idempotencyKey: key };
      });
    },

    /**
     * A customer places an order for themselves. This records intent only
     * (`admittedAt: 0`): nobody has bought anything until the seller admits
     * it with admitOrder.
     */
    async placeOrder({ department, offer, quantity, idempotencyKey }: {
      department: string; offer: string; quantity: number; idempotencyKey?: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      return placeOrderRecord({ state, offer, quantity, idempotencyKey, allowExisting: false });
    },

    /**
     * Customer-facing purchase flow. The order remains the accounting fact;
     * this request tells the customer's owning seller to settle it without a
     * browser-hosted Admit action. Reusing a matching idempotency key is safe.
     */
    async buy({ department, offer, quantity, idempotencyKey }: {
      department: string; offer: string; quantity: number; idempotencyKey?: string;
    }): Promise<{ idHash: string; requestIdHash: string; idempotencyKey: string }> {
      let state = await requireDepartment(department);
      const sellers = owningSellers(state.department, state.assignments, self(), now());
      if (sellers.length !== 1) {
        fail(`customer must have exactly one owning seller, found ${sellers.length}.`);
      }
      const seller = sellers[0];
      const placed = await placeOrderRecord({ state, offer, quantity, idempotencyKey, allowExisting: true });
      state = await requireDepartment(department);
      const existingRequest = state.purchaseRequests.find(entry => entry.idempotencyKey === placed.idempotencyKey);
      if (existingRequest) {
        if (existingRequest.customer !== self() || existingRequest.seller !== seller) {
          fail(`purchase retry ${placed.idempotencyKey} belongs to another customer.`);
        }
        const retried = objects.createPurchaseRequest({
          department: state.deptIdHash, idempotencyKey: placed.idempotencyKey,
          customer: self(), seller, requestedAt: Math.max(now(), existingRequest.requestedAt + 1),
        });
        const retry = await publish("purchase-request", state, retried, self());
        return {
          idHash: placed.idHash,
          requestIdHash: retry.idHash,
          idempotencyKey: placed.idempotencyKey,
        };
      }
      const request = objects.createPurchaseRequest({
        department: state.deptIdHash, idempotencyKey: placed.idempotencyKey,
        customer: self(), seller, requestedAt: now(),
      });
      const published = await publish("purchase-request", state, request, self());
      return { idHash: placed.idHash, requestIdHash: published.idHash, idempotencyKey: placed.idempotencyKey };
    },

    /**
     * A seller admits a placed order, recording the purchase. There is no
     * other way for an admitted order to exist: admitting without a prior
     * customer placement fails, as does admitting twice.
     */
    async admitOrder({ department, idempotencyKey }: {
      department: string; idempotencyKey: string;
    }): Promise<{ idHash: string }> {
      return serializedAdmit(async () => {
        const state = await requireDepartment(department);
        const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
        if (!roles.has("seller") && !roles.has("admin") && !roles.has("manager")) {
          fail("only the seller or staff may admit orders.");
        }
        const placed = state.orders.find(entry => entry.idempotencyKey === idempotencyKey);
        if (!placed) {
          throw new Error(`${brand.label}: order ${idempotencyKey} was never placed by a customer.`);
        }
        if (placed.admittedAt !== 0) {
          fail(`order ${idempotencyKey} is already admitted.`);
        }
        if (state.purchaseRequests.some(entry => entry.idempotencyKey === idempotencyKey)) {
          fail(`order ${idempotencyKey} is owned by the automatic purchase processor.`);
        }
        if (state.purchaseDecisions.some(entry => entry.idempotencyKey === idempotencyKey)) {
          fail(`order ${idempotencyKey} has a terminal purchase decision.`);
        }
        // No oversell: the purchase settles against the same shared balance
        // every member projects. The serialized path makes every later check
        // observe this write.
        return admitPlacedOrder(state, placed);
      });
    },

    async getDepartment({ department }: { department: string }): Promise<{ department: string; known: false } | ({ known: true } & DepartmentProjection)> {
      const state = await load(department);
      if (!state.department) return { department, known: false };
      return { known: true, ...projectDepartment({ ...state, department: state.department, viewer: self(), atTime: now() }) };
    },

    feedRow(result: FeedRowInput): {
      type: string; kind: string; id: string; department: unknown; idHash: string; hash: string; obj: Record<string, unknown>;
    } | null {
      const type = result.obj.$type$ as string;
      if (!Object.values(types).includes(type)) return null;
      return { type, kind: KIND_OF_TYPE[type], id: result.obj[ID_FIELD[type]] as string, department: result.obj.department, idHash: result.idHash, hash: result.hash, obj: result.obj };
    },

    processAutomaticPurchase,
    recoverAutomaticPurchases,
    processDisclosures,

    async setOnline({ online }: { online: boolean }): Promise<{ online: boolean }> {
      if (online) await connections.enableAllConnections();
      else await connections.disableAllConnections();
      return { online };
    },

    ...createIoMOps({ brand, connections: iomConnections, self, email, appBaseUrl }),
  };
  return plan;
}

export type LabPlan = ReturnType<typeof createLabPlan>;
