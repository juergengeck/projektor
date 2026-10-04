/** Received domain roots need local owner grants before CHUM can forward them
 * to another device of that person. Remote Access/IdAccess never replicate. */
import { createAccess } from "../../../one/packages/one.core/lib/access.js";
import { getInstanceOwnerIdHash } from "../../../one/packages/one.core/lib/instance.js";
import { SET_ACCESS_MODE } from "../../../one/packages/one.core/lib/storage-base-common.js";
import { getObjectByIdHash, hasVersionHead, isMissingVersionHeadError } from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { listAllIdHashTypes } from "../../../one/packages/one.core/lib/system/storage-base.js";
import { ensureIdHash } from "../../../one/packages/one.core/lib/util/type-checks.js";
import { labTypes } from "./recipes.ts";
import type { LabBrand } from "./brand.ts";
import type { FeedRowInput } from "./lab-plan.ts";

export function createIoMContentAccess(brand: LabBrand) {
  const types = new Set(Object.values(labTypes(brand)));
  // The storage inventory reports ID-object headers with ONE's " [ID]" suffix.
  const idTypes = new Set([...types].map(type => `${type} [ID]`));
  async function grantOwner(result: FeedRowInput): Promise<void> {
    if (!types.has(String(result.obj.$type$))) return;
    const owner = getInstanceOwnerIdHash();
    if (!owner) throw new Error(`${brand.label}: content arrived without an instance owner.`);
    await createAccess([{ id: ensureIdHash(result.idHash), person: [owner], hashGroup: [], mode: SET_ACCESS_MODE.ADD }]);
  }

  async function recover(onRoot: (result: FeedRowInput) => Promise<void>): Promise<void> {
    // Recover persisted receipts as well as arrivals racing listener installation.
    // The typed identity inventory avoids reading unrelated framework objects.
    for (const { idHash, type } of await listAllIdHashTypes()) {
      if (!idTypes.has(type) || !await hasVersionHead(idHash)) continue;
      try {
        const root = await getObjectByIdHash(idHash);
        const result = root as unknown as FeedRowInput;
        await grantOwner(result);
        await onRoot(result);
      } catch (error) {
        if (!isMissingVersionHeadError(error)) throw error;
      }
    }
  }
  return { grantOwner, recover };
}
