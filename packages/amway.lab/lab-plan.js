// packages/amway.lab/lab-plan.js
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
import { AMWAY_LAB_TYPES, createContact, createDepartment, createOffer, createOrder, createRoleAssignment } from "./recipes.js";
import { LAB_STOCK, audience, canPublish, projectDepartment } from "./projection.js";

const KIND_OF_TYPE = { AmwayDepartment: "department", AmwayRoleAssignment: "assignment", AmwayContact: "contact", AmwayOffer: "offer", AmwayOrder: "order" };
const ID_FIELD = { AmwayDepartment: "department", AmwayRoleAssignment: "subject", AmwayContact: "person", AmwayOffer: "offerId", AmwayOrder: "idempotencyKey" };

export function createLabPlan({ connections, now = () => Date.now() }) {
  const self = () => {
    const owner = getInstanceOwnerIdHash();
    if (!owner) throw new Error("Amway lab: instance has no owner.");
    return owner;
  };

  const departmentIdHash = department =>
    calculateIdHashOfObj({ $type$: "AmwayDepartment", department, name: "", admin: "0".repeat(64) });

  async function latest(idHashes) {
    const objs = [];
    for (const idHash of idHashes) {
      try {
        objs.push((await getObjectByIdHash(idHash)).obj);
      } catch (error) {
        // CHUM materializes a referenced exact version before selecting its
        // head, so a reverse-map entry may briefly outrun its readable
        // version. That row has not arrived yet; anything else is a failure.
        if (!isMissingVersionHeadError(error)) throw error;
      }
    }
    return objs;
  }

  async function load(department) {
    const deptIdHash = await departmentIdHash(department);
    const [assignments, contacts, offers, orders] = await Promise.all(
      ["AmwayRoleAssignment", "AmwayContact", "AmwayOffer", "AmwayOrder"].map(async type =>
        latest(await getAllIdObjectEntries(deptIdHash, type))),
    );
    // Not yet replicated is a normal state, asked explicitly — no error swallowing.
    let departmentObj = null;
    if (await hasVersionHead(deptIdHash)) {
      try {
        departmentObj = (await getObjectByIdHash(deptIdHash)).obj;
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

  async function grant(idHash, people) {
    await createAccess([{ id: idHash, person: people, hashGroup: [], mode: SET_ACCESS_MODE.ADD }]);
  }

  async function requireDepartment(department) {
    const state = await load(department);
    if (!state.department) throw new Error(`Amway lab: department ${department} has not reached this instance.`);
    return state;
  }

  async function publish(kind, state, obj, subject) {
    const author = self();
    if (!canPublish(kind, { department: state.department, assignments: state.assignments, author, subject, atTime: now() })) {
      throw new Error(`Amway lab: ${author} may not publish ${kind} in ${state.department.department}.`);
    }
    const stored = await storeVersionedObject(obj);
    await grant(stored.idHash, audience(kind, { department: state.department, assignments: state.assignments, row: obj }));
    return { idHash: stored.idHash };
  }

  return {
    whoAmI() {
      return { person: self() };
    },

    async createDepartment({ department, name }) {
      const stored = await storeVersionedObject(createDepartment({ department, name, admin: self() }));
      await grant(stored.idHash, [self()]);
      return { departmentIdHash: stored.idHash };
    },

    async assignRole({ department, subject, role }) {
      const state = await requireDepartment(department);
      const obj = createRoleAssignment({ department: state.deptIdHash, subject, role, issuer: self(), validFrom: now() });
      if (role === "manager" && self() !== state.department.admin) {
        throw new Error("Amway lab: only the department admin may appoint managers.");
      }
      const result = await publish("assignment", state, obj, subject);
      const next = await requireDepartment(department);
      const everyone = audience("assignment", { department: next.department, assignments: next.assignments, row: obj });
      await grant(next.deptIdHash, everyone);
      for (const type of ["AmwayRoleAssignment", "AmwayContact", "AmwayOffer"]) {
        for (const idHash of await getAllIdObjectEntries(next.deptIdHash, type)) await grant(idHash, everyone);
      }
      for (const idHash of await getAllIdObjectEntries(next.deptIdHash, "AmwayOrder")) {
        let order;
        try {
          order = (await getObjectByIdHash(idHash)).obj;
        } catch (error) {
          // Same transient as latest(): skip this grant pass; the next
          // membership change re-grants every entry.
          if (!isMissingVersionHeadError(error)) throw error;
          continue;
        }
        await grant(idHash, audience("order", { department: next.department, assignments: next.assignments, row: order }));
      }
      return result;
    },

    async publishContact({ department, name, role }) {
      const state = await requireDepartment(department);
      const obj = createContact({ department: state.deptIdHash, person: self(), name, role, publishedBy: self(), publishedAt: now() });
      return publish("contact", state, obj, self());
    },

    async publishOffer({ department, offerId, item, priceList, unitAmount, currency }) {
      const state = await requireDepartment(department);
      const obj = createOffer({ department: state.deptIdHash, offerId, item, priceList, channel: "facility", unitAmount, currency, publishedBy: self() });
      return publish("offer", state, obj);
    },

    async admitOrder({ department, customer, offer, quantity, idempotencyKey }) {
      const state = await requireDepartment(department);
      if (!state.offers.some(entry => entry.offerId === offer)) {
        throw new Error(`Amway lab: offer ${offer} is not known in ${department}.`);
      }
      const obj = createOrder({
        department: state.deptIdHash, idempotencyKey: idempotencyKey ?? `lab-order-${now()}`,
        customer, seller: self(), offer, quantity, lot: LAB_STOCK.lot, facility: LAB_STOCK.facility, admittedAt: now(),
      });
      return publish("order", state, obj);
    },

    async getDepartment({ department }) {
      const state = await load(department);
      if (!state.department) return { department, known: false };
      return { known: true, ...projectDepartment({ ...state, department: state.department, viewer: self(), atTime: now() }) };
    },

    feedRow(result) {
      const type = result.obj.$type$;
      if (!AMWAY_LAB_TYPES.includes(type)) return null;
      return { type, kind: KIND_OF_TYPE[type], id: result.obj[ID_FIELD[type]], department: result.obj.department, idHash: result.idHash, hash: result.hash, obj: result.obj };
    },

    async setOnline({ online }) {
      if (online) await connections.enableAllConnections();
      else await connections.disableAllConnections();
      return { online };
    },
  };
}
