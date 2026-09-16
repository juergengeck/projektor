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
  createRoleAssignment,
} from "./recipes.ts";
import type {
  AmwayContact,
  AmwayDepartment,
  AmwayLabObject,
  AmwayOffer,
  AmwayOrder,
  AmwayRoleAssignment,
} from "./recipes.ts";
import { LAB_STOCK, audience, canPublish, projectDepartment, rolesOf } from "./projection.ts";
import type { DepartmentProjection } from "./projection.ts";
import { createIoMOps } from "./iom.ts";

const KIND_OF_TYPE: Record<string, string> = { AmwayDepartment: "department", AmwayRoleAssignment: "assignment", AmwayContact: "contact", AmwayOffer: "offer", AmwayOrder: "order" };
const ID_FIELD: Record<string, string> = { AmwayDepartment: "department", AmwayRoleAssignment: "subject", AmwayContact: "person", AmwayOffer: "offerId", AmwayOrder: "idempotencyKey" };

const versioned = (obj: AmwayLabObject): never => obj as never;

interface DepartmentState {
  deptIdHash: string;
  department: AmwayDepartment | null;
  assignments: AmwayRoleAssignment[];
  contacts: AmwayContact[];
  offers: AmwayOffer[];
  orders: AmwayOrder[];
}

export interface FeedRowInput {
  obj: Record<string, unknown>;
  idHash: string;
  hash: string;
}

export function createLabPlan({ connections, now = () => Date.now(), listenerUrl, email }: {
  connections: ConnectionsModel;
  now?: () => number;
  /** Pairing listener id carrying the registered credential (lab:// url). */
  listenerUrl: string;
  /** Instance owner email; IoM invitations name it as the identity hint. */
  email: string;
}) {
  const self = (): string => {
    const owner = getInstanceOwnerIdHash();
    if (!owner) throw new Error("Amway lab: instance has no owner.");
    return owner;
  };

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

  async function load(department: string): Promise<DepartmentState> {
    const deptIdHash = await departmentIdHash(department);
    const [assignments, contacts, offers, orders] = await Promise.all([
      latest<AmwayRoleAssignment>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayRoleAssignment"))),
      latest<AmwayContact>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayContact"))),
      latest<AmwayOffer>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayOffer"))),
      latest<AmwayOrder>(await getAllIdObjectEntries(idHashOf(deptIdHash), typeNameOf("AmwayOrder"))),
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
      return { deptIdHash, department: null, assignments, contacts, offers, orders };
    }
    return { deptIdHash, department: departmentObj, assignments, contacts, offers, orders };
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

  async function publish(kind: string, state: DepartmentState & { department: AmwayDepartment }, obj: AmwayLabObject, subject?: string): Promise<{ idHash: string }> {
    const author = self();
    if (!canPublish(kind, { department: state.department, assignments: state.assignments, author, subject, atTime: now() })) {
      throw new Error(`Amway lab: ${author} may not publish ${kind} in ${state.department.department}.`);
    }
    const stored = await storeVersionedObject(versioned(obj));
    await grant(stored.idHash, audience(kind, { department: state.department, assignments: state.assignments, row: obj }));
    return { idHash: stored.idHash };
  }

  return {
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
      // sellers, sellers appoint customers. The root admin keeps authority.
      const issuerRoles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
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
      const everyone = audience("assignment", { department: next.department, assignments: next.assignments, row: obj });
      await grant(next.deptIdHash, everyone);
      for (const type of ["AmwayRoleAssignment", "AmwayContact", "AmwayOffer"]) {
        for (const idHash of await getAllIdObjectEntries(idHashOf(next.deptIdHash), typeNameOf(type))) await grant(idHash, everyone);
      }
      for (const idHash of await getAllIdObjectEntries(idHashOf(next.deptIdHash), typeNameOf("AmwayOrder"))) {
        let order: AmwayOrder;
        try {
          order = (await getObjectByIdHash(idHash)).obj as AmwayOrder;
        } catch (error) {
          // Same transient as latest(): skip this grant pass; the next
          // membership change re-grants every entry.
          if (!isMissingVersionHeadError(error)) throw error;
          continue;
        }
        await grant(idHash, audience("order", { department: next.department, assignments: next.assignments, row: order as AmwayOrder }));
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
     * A customer places an order for themselves. This records intent only
     * (`admittedAt: 0`): nobody has bought anything until the seller admits
     * it with admitOrder.
     */
    async placeOrder({ department, offer, quantity, idempotencyKey }: {
      department: string; offer: string; quantity: number; idempotencyKey?: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      if (!state.offers.some(entry => entry.offerId === offer)) {
        throw new Error(`Amway lab: offer ${offer} is not known in ${department}.`);
      }
      const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
      if (!roles.has("customer")) {
        throw new Error("Amway lab: only a customer may place an order.");
      }
      const key = idempotencyKey ?? `lab-order-${now()}`;
      if (state.orders.some(entry => entry.idempotencyKey === key)) {
        throw new Error(`Amway lab: order ${key} is already placed.`);
      }
      const obj = createOrder({
        department: state.deptIdHash, idempotencyKey: key,
        customer: self(), seller: self(), offer, quantity, lot: LAB_STOCK.lot, facility: LAB_STOCK.facility, admittedAt: 0,
      });
      return publish("order", state, obj, self());
    },

    /**
     * A seller admits a placed order, recording the purchase. There is no
     * other way for an admitted order to exist: admitting without a prior
     * customer placement fails, as does admitting twice.
     */
    async admitOrder({ department, idempotencyKey }: {
      department: string; idempotencyKey: string;
    }): Promise<{ idHash: string }> {
      const state = await requireDepartment(department);
      const roles = rolesOf({ department: state.department, assignments: state.assignments, subject: self(), atTime: now() });
      if (!roles.has("seller") && !roles.has("admin") && !roles.has("manager")) {
        throw new Error("Amway lab: only the seller may admit orders.");
      }
      const placed = state.orders.find(entry => entry.idempotencyKey === idempotencyKey);
      if (!placed) {
        throw new Error(`Amway lab: order ${idempotencyKey} was never placed by a customer.`);
      }
      if (placed.admittedAt !== 0) {
        throw new Error(`Amway lab: order ${idempotencyKey} is already admitted.`);
      }
      const obj = createOrder({
        department: state.deptIdHash, idempotencyKey: placed.idempotencyKey,
        customer: placed.customer, seller: self(), offer: placed.offer, quantity: placed.quantity,
        lot: placed.lot, facility: placed.facility, admittedAt: now(),
      });
      return publish("order", state, obj, placed.customer);
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

    async setOnline({ online }: { online: boolean }): Promise<{ online: boolean }> {
      if (online) await connections.enableAllConnections();
      else await connections.disableAllConnections();
      return { online };
    },

    ...createIoMOps({ connections, self, listenerUrl, email }),
  };
}

export type LabPlan = ReturnType<typeof createLabPlan>;
