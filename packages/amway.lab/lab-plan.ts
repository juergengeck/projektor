// packages/amway.lab/lab-plan.ts
/**
 * The lab's domain plan. Writes are ONE versioned objects whose disclosure is
 * a sender-side access grant to the projected audience; CHUM carries them.
 * Reads enumerate a department through its id-object reverse map and
 * re-project authority locally. Nothing here knows about other workers.
 */
import { storeVersionedObject, getObjectByIdHash, hasVersionHead, isMissingVersionHeadError } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
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
import {
  AMWAY_LAB_TYPES,
  createContact,
  createDepartment,
  createOffer,
  createOrder,
  createPurchaseDecision,
  createPurchaseRequest,
  createRoleAssignment,
  createStockReceipt,
} from "./recipes.ts";
import type {
  AmwayContact,
  AmwayDepartment,
  AmwayLabObject,
  AmwayOffer,
  AmwayOrder,
  AmwayPurchaseDecision,
  AmwayPurchaseRequest,
  AmwayRoleAssignment,
  AmwayStockReceipt,
} from "./recipes.ts";
import { LAB_STOCK, audience, canPublish, projectDepartment, rolesOf } from "./projection.ts";
import type { DepartmentProjection } from "./projection.ts";
import { createIoMOps } from "./iom.ts";

const KIND_OF_TYPE: Record<string, string> = { AmwayDepartment: "department", AmwayRoleAssignment: "assignment", AmwayContact: "contact", AmwayOffer: "offer", AmwayOrder: "order", AmwayPurchaseRequest: "purchase-request", AmwayPurchaseDecision: "purchase-decision", AmwayStockReceipt: "stock" };
const ID_FIELD: Record<string, string> = { AmwayDepartment: "department", AmwayRoleAssignment: "subject", AmwayContact: "person", AmwayOffer: "offerId", AmwayOrder: "idempotencyKey", AmwayPurchaseRequest: "idempotencyKey", AmwayPurchaseDecision: "idempotencyKey", AmwayStockReceipt: "receiptId" };

const versioned = (obj: AmwayLabObject): never => obj as never;

interface DepartmentState {
  deptIdHash: string;
  department: AmwayDepartment | null;
  assignments: AmwayRoleAssignment[];
  contacts: AmwayContact[];
  offers: AmwayOffer[];
  orders: AmwayOrder[];
  purchaseRequests: AmwayPurchaseRequest[];
  purchaseDecisions: AmwayPurchaseDecision[];
  stock: AmwayStockReceipt[];
}

export interface FeedRowInput {
  obj: Record<string, unknown>;
  idHash: string;
  hash: string;
}

export function createLabPlan({ connections, iomConnections, now = () => Date.now(), email, appBaseUrl }: {
  connections: ConnectionsModel;
  /** IoM-dedicated connections: pairing listener homed on the commserver. */
  iomConnections: ConnectionsModel;
  now?: () => number;
  /** Instance owner email; IoM invitations name it as the identity hint. */
  email: string;
  /** Lane entry URL prefix the QR-encoded IoM invitation links back to. */
  appBaseUrl: string;
}) {
  const self = (): string => {
    const owner = getInstanceOwnerIdHash();
    if (!owner) throw new Error("Amway lab: instance has no owner.");
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
    calculateIdHashOfObj(versioned({ $type$: "AmwayDepartment", department, name: "", admin: "0".repeat(64) }));

  async function latest<T extends AmwayLabObject>(idHashes: string[]): Promise<T[]> {
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
    const [assignments, contacts, offers, orders, purchaseRequests, purchaseDecisions, stock] = await Promise.all([
      latest<AmwayRoleAssignment>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayRoleAssignment"))),
      latest<AmwayContact>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayContact"))),
      latest<AmwayOffer>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayOffer"))),
      latest<AmwayOrder>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayOrder"))),
      latest<AmwayPurchaseRequest>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayPurchaseRequest"))),
      latest<AmwayPurchaseDecision>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayPurchaseDecision"))),
      latest<AmwayStockReceipt>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayStockReceipt"))),
    ]);
    // Not yet replicated is a normal state, asked explicitly — no error swallowing.
    let departmentObj: AmwayDepartment | null = null;
    if (await hasVersionHead(idHashOf(deptIdHash))) {
      try {
        departmentObj = (await getObjectByIdHash(idHashOf(deptIdHash))).obj as unknown as AmwayDepartment;
      } catch (error) {
        // Head selected and then transiently unreadable (concurrent head
        // swap): report not-replicated rather than a storage crash.
        if (!isMissingVersionHeadError(error)) throw error;
      }
    }
    if (!departmentObj) {
      return { deptIdHash, department: null, assignments, contacts, offers, orders, purchaseRequests, purchaseDecisions, stock };
    }
    return { deptIdHash, department: departmentObj, assignments, contacts, offers, orders, purchaseRequests, purchaseDecisions, stock };
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

  async function requireDepartment(department: string): Promise<DepartmentState & { department: AmwayDepartment }> {
    const state = await load(department);
    if (!state.department) throw new Error(`Amway lab: department ${department} has not reached this instance.`);
    return state as DepartmentState & { department: AmwayDepartment };
  }

  async function offerIdHash(state: DepartmentState, offerId: string): Promise<string | undefined> {
    for (const candidate of await getAllIdObjectEntries(idHashOf(state.deptIdHash), typeNameOf("AmwayOffer"))) {
      try {
        const obj = (await getObjectByIdHash(idHashOf(candidate))).obj as AmwayOffer;
        if (obj.offerId === offerId) return candidate;
      } catch (error) {
        if (!isMissingVersionHeadError(error)) throw error;
      }
    }
    return undefined;
  }

  async function publish(kind: string, state: DepartmentState & { department: AmwayDepartment }, obj: AmwayLabObject, subject?: string): Promise<{ idHash: string }> {
    const author = self();
    if (!canPublish(kind, { department: state.department, assignments: state.assignments, author, subject, atTime: now() })) {
      throw new Error(`Amway lab: ${author} may not publish ${kind} in ${state.department.department}.`);
    }
    const stored = await storeVersionedObject(versioned(obj));
    await grant(stored.idHash, audience(kind, { department: state.department, assignments: state.assignments, row: obj }));
    return { idHash: stored.idHash };
  }

  async function placeOrderRecord({ state, offer, quantity, idempotencyKey, allowExisting }: {
    state: DepartmentState & { department: AmwayDepartment };
    offer: string;
    quantity: number;
    idempotencyKey?: string;
    allowExisting: boolean;
  }): Promise<{ idHash: string; idempotencyKey: string; order: AmwayOrder }> {
    const offerRow = state.offers.find(entry => entry.offerId === offer);
    if (!offerRow) throw new Error(`Amway lab: offer ${offer} is not known in ${state.department.department}.`);
    const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
    if (!roles.has("customer")) throw new Error("Amway lab: only a customer may place an order.");
    const key = idempotencyKey ?? `lab-order-${now()}`;
    const existing = state.orders.find(entry => entry.idempotencyKey === key);
    if (existing) {
      if (!allowExisting) throw new Error(`Amway lab: order ${key} is already placed.`);
      if (existing.customer !== self() || existing.offer !== offer || existing.quantity !== quantity) {
        throw new Error(`Amway lab: purchase retry ${key} does not match the original order.`);
      }
      const idHash = await calculateIdHashOfObj(versioned(existing));
      await grant(idHash, audience("order", { department: state.department, assignments: state.assignments, row: existing }));
      return { idHash, idempotencyKey: key, order: existing };
    }
    const order = createOrder({
      department: state.deptIdHash, idempotencyKey: key,
      customer: self(), seller: self(), offer, quantity, lot: LAB_STOCK.lot, facility: LAB_STOCK.facility,
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

  async function admitPlacedOrder(state: DepartmentState & { department: AmwayDepartment }, placed: AmwayOrder): Promise<{ idHash: string }> {
    const stocked = state.stock.reduce((sum, entry) => sum + entry.quantity, 0);
    const settled = settledQuantity(state);
    if (placed.quantity > stocked - settled) {
      throw new Error(
        `Amway lab: order ${placed.idempotencyKey} wants ${placed.quantity} units but only ${stocked - settled} are available.`,
      );
    }
    const obj = createOrder({
      department: state.deptIdHash, idempotencyKey: placed.idempotencyKey,
      customer: placed.customer, seller: self(), offer: placed.offer, quantity: placed.quantity,
      lot: placed.lot, facility: placed.facility,
      currency: placed.currency, unitAmount: placed.unitAmount, admittedAt: now(),
    });
    return publish("order", state, obj, placed.customer);
  }

  async function processAutomaticPurchase(result: FeedRowInput): Promise<void> {
    const type = result.obj.$type$;
    if (!["AmwayRoleAssignment", "AmwayOrder", "AmwayPurchaseRequest", "AmwayStockReceipt"].includes(type as string)) return;
    const department = result.obj.department;
    if (typeof department !== "string") return;
    await serializedAdmit(async () => {
      const state = await loadByIdHash(department);
      if (!state.department) return;
      const readyState = state as DepartmentState & { department: AmwayDepartment };
      const eventKey = type === "AmwayOrder" || type === "AmwayPurchaseRequest"
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
        const ownsCustomer = request.seller === self() && state.assignments.some(entry =>
          entry.role === "customer" && entry.subject === request.customer && entry.issuer === request.seller && entry.validFrom <= now());
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
          await publish("purchase-decision", readyState, createPurchaseDecision({
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
    const requestIds = await getAllIdObjectEntries(idHashOf(self()), typeNameOf("AmwayPurchaseRequest"));
    for (const request of await latest<AmwayPurchaseRequest>(requestIds)) {
      await processAutomaticPurchase({ obj: request as unknown as Record<string, unknown>, idHash: "", hash: "" });
    }
  }

  const plan = {
    whoAmI(): { person: string } {
      return { person: self() };
    },

    async createDepartment({ department, name }: { department: string; name: string }): Promise<{ departmentIdHash: string }> {
      const stored = await storeVersionedObject(versioned(createDepartment({ department, name, admin: self() })));
      await grant(stored.idHash, [self()]);
      return { departmentIdHash: stored.idHash };
    },

    async assignRole({ department, subject, role }: { department: string; subject: string; role: string }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const obj = createRoleAssignment({ department: state.deptIdHash, subject, role, issuer: self(), validFrom: now() });
      // Appointment chain: admin appoints managers, managers appoint
      // sellers, sellers appoint customers. Admin authority itself is never
      // delegated down: only the root admin appoints admins.
      const issuerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
      if (role === "admin" && self() !== state.department.admin) {
        throw new Error("Amway lab: only the department admin may appoint admins.");
      }
      if (role === "manager" && self() !== state.department.admin) {
        throw new Error("Amway lab: only the department admin may appoint managers.");
      }
      if (role === "seller" && self() !== state.department.admin && !issuerRoles.has("manager")) {
        throw new Error("Amway lab: only the department admin or a manager may appoint sellers.");
      }
      if (role === "customer" && self() !== state.department.admin && !issuerRoles.has("seller")) {
        throw new Error("Amway lab: only the seller may appoint customers.");
      }
      const result = await publish("assignment", state, obj, subject);
      const next = await requireDepartment(department);
      // Disclosure follows the chain, never broadcasts: appointments share
      // the department, team and directory with the newcomer, but inventory
      // (offers) and purchases keep the audience each row already carries.
      // A membership change must never leak a level's rows to another level.
      const team = audience("assignment", { department: next.department, assignments: next.assignments, row: obj });
      await grant(next.deptIdHash, team);
      for (const type of ["AmwayRoleAssignment", "AmwayContact"] as const) {
        for (const idHash of await getAllIdObjectEntries(idHashOf(next.deptIdHash), typeNameOf(type))) await grant(idHash, team);
      }
      // Stock receipts follow the inventory audience, never the whole team:
      // staff and sellers replicate them so admissions settle, customers
      // never hold inventory rows. A newcomer starts with no shared offers.
      const holders = new Set<string>([next.department.admin]);
      for (const entry of next.assignments) {
        const subjectRoles = rolesOf({ department: next.department, assignments: next.assignments, subject: entry.subject, atTime: now() });
        if (subjectRoles.has("manager") || subjectRoles.has("seller")) holders.add(entry.subject);
      }
      for (const idHash of await getAllIdObjectEntries(idHashOf(next.deptIdHash), typeNameOf("AmwayStockReceipt"))) {
        await grant(idHash, [...holders]);
      }
      for (const type of ["AmwayOffer", "AmwayOrder", "AmwayPurchaseRequest", "AmwayPurchaseDecision"] as const) {
        for (const idHash of await getAllIdObjectEntries(idHashOf(next.deptIdHash), typeNameOf(type))) {
          let row: AmwayLabObject;
          try {
            row = (await getObjectByIdHash(idHash)).obj as AmwayLabObject;
          } catch (error) {
            // Same transient as latest(): skip this grant pass; the next
            // membership change re-grants every entry.
            if (!isMissingVersionHeadError(error)) throw error;
            continue;
          }
          const kind = KIND_OF_TYPE[type];
          await grant(idHash, audience(kind, { department: next.department, assignments: next.assignments, row }));
        }
      }
      return result;
    },

    async publishContact({ department, name, role }: { department: string; name: string; role: string }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const obj = createContact({ department: state.deptIdHash, person: self(), name, role, publishedBy: self(), publishedAt: now() });
      return publish("contact", state, obj, self());
    },

    async publishOffer({ department, offerId, item, priceList, unitAmount, currency }: {
      department: string; offerId: string; item: string; priceList: string; unitAmount: number; currency: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const obj = createOffer({ department: state.deptIdHash, offerId, item, priceList, channel: "facility", unitAmount, currency, publishedBy: self() });
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
        throw new Error("Amway lab: only the department admin (purchasing) may stock up inventory.");
      }
      const obj = createStockReceipt({
        department: state.deptIdHash, receiptId,
        lot: lot ?? LAB_STOCK.lot, facility: facility ?? LAB_STOCK.facility,
        quantity, receivedBy: self(), receivedAt: now(),
      });
      return publish("stock", state, obj);
    },

    /**
     * The seller shares a published offer down with an appointed customer.
     * This is the only way inventory reaches customers: publishing discloses
     * to sellers through their manager, never further. Pure disclosure, no
     * new object; repeating it is harmless.
     */
    async shareOffer({ department, offerId, customer }: {
      department: string; offerId: string; customer: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
      if (!roles.has("seller") && self() !== state.department.admin) {
        throw new Error("Amway lab: only the seller may share offers with customers.");
      }
      const customerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: customer, atTime: now() });
      if (!customerRoles.has("customer")) {
        throw new Error("Amway lab: offers are shared with appointed customers only.");
      }
      if (!state.offers.some(entry => entry.offerId === offerId)) {
        throw new Error(`Amway lab: offer ${offerId} is not known in ${department}.`);
      }
      const idHash = await offerIdHash(state, offerId);
      if (!idHash) throw new Error(`Amway lab: offer ${offerId} has not reached this instance.`);
      await grant(idHash, [customer]);
      return { idHash };
    },

    /**
     * The manager shares a published offer down with a chosen seller.
     * Publishing alone never reaches sellers: this explicit step is the
     * only way inventory arrives at a seller, mirroring shareOffer.
     * Pure disclosure, no new object; repeating it is harmless.
     */
    async shareOfferWithSeller({ department, offerId, seller }: {
      department: string; offerId: string; seller: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
      if (!roles.has("manager") && self() !== state.department.admin) {
        throw new Error("Amway lab: only the manager may share offers with sellers.");
      }
      const sellerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: seller, atTime: now() });
      if (!sellerRoles.has("seller")) {
        throw new Error("Amway lab: offers are shared with appointed sellers only.");
      }
      if (!state.offers.some(entry => entry.offerId === offerId)) {
        throw new Error(`Amway lab: offer ${offerId} is not known in ${department}.`);
      }
      const idHash = await offerIdHash(state, offerId);
      if (!idHash) throw new Error(`Amway lab: offer ${offerId} has not reached this instance.`);
      await grant(idHash, [seller]);
      return { idHash };
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
      const owningSellers = state.assignments
        .filter(entry => entry.role === "customer" && entry.subject === self() && entry.validFrom <= now())
        .map(entry => entry.issuer)
        .filter(seller => rolesOf({ department: state.department, assignments: state.assignments, subject: seller, atTime: now() }).has("seller"));
      if (owningSellers.length !== 1) {
        throw new Error(`Amway lab: customer must have exactly one owning seller, found ${owningSellers.length}.`);
      }
      const seller = owningSellers[0];
      const placed = await placeOrderRecord({ state, offer, quantity, idempotencyKey, allowExisting: true });
      state = await requireDepartment(department);
      const existingRequest = state.purchaseRequests.find(entry => entry.idempotencyKey === placed.idempotencyKey);
      if (existingRequest) {
        if (existingRequest.customer !== self() || existingRequest.seller !== seller) {
          throw new Error(`Amway lab: purchase retry ${placed.idempotencyKey} belongs to another customer.`);
        }
        const retried = createPurchaseRequest({
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
      const request = createPurchaseRequest({
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
          throw new Error("Amway lab: only the seller or staff may admit orders.");
        }
        const placed = state.orders.find(entry => entry.idempotencyKey === idempotencyKey);
        if (!placed) {
          throw new Error(`Amway lab: order ${idempotencyKey} was never placed by a customer.`);
        }
        if (placed.admittedAt !== 0) {
          throw new Error(`Amway lab: order ${idempotencyKey} is already admitted.`);
        }
        if (state.purchaseRequests.some(entry => entry.idempotencyKey === idempotencyKey)) {
          throw new Error(`Amway lab: order ${idempotencyKey} is owned by the automatic purchase processor.`);
        }
        if (state.purchaseDecisions.some(entry => entry.idempotencyKey === idempotencyKey)) {
          throw new Error(`Amway lab: order ${idempotencyKey} has a terminal purchase decision.`);
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
      if (!(AMWAY_LAB_TYPES as readonly string[]).includes(type)) return null;
      return { type, kind: KIND_OF_TYPE[type], id: result.obj[ID_FIELD[type]] as string, department: result.obj.department, idHash: result.idHash, hash: result.hash, obj: result.obj };
    },

    processAutomaticPurchase,
    recoverAutomaticPurchases,

    async setOnline({ online }: { online: boolean }): Promise<{ online: boolean }> {
      if (online) await connections.enableAllConnections();
      else await connections.disableAllConnections();
      return { online };
    },

    ...createIoMOps({ connections: iomConnections, self, email, appBaseUrl }),
  };
  return plan;
}

export type LabPlan = ReturnType<typeof createLabPlan>;
