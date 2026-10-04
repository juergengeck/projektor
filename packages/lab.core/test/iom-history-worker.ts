/** Persist domain roots without local access grants, as an older receiver did.
 * The normal lab worker must restore their owner access when it boots them. */
import "../../../../one/packages/one.core/lib/system/load-nodejs.js";
import { parentPort, workerData } from "node:worker_threads";
import MultiUser from "../../../../one/packages/one.models/lib/models/Authenticator/MultiUser.js";
import RecipesStable from "../../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import { ReverseMapsStable, ReverseMapsForIdObjectsStable } from "../../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import { ReverseMapsExperimental, ReverseMapsForIdObjectsExperimental } from "../../../../one/packages/one.models/lib/recipes/reversemaps-experimental.js";
import { getInstanceOwnerIdHash } from "../../../../one/packages/one.core/lib/instance.js";
import { storeVersionedObject } from "../../../../one/packages/one.core/lib/storage-versioned-objects.js";
import { brandById } from "../brand.ts";
import { createLabObjects, createLabRecipes } from "../recipes.ts";
import type { Recipe } from "../../../../one/packages/one.core/lib/recipes.js";

if (!parentPort) throw new Error("IoM history fixture needs a parent port.");
const { brand: brandId, directory } = workerData as { brand: string; directory: string };
const brand = brandById(brandId);
const { recipes, reverseMapsForIdObjects } = createLabRecipes(brand);
const multiUser = new MultiUser({
  directory,
  recipes: [...RecipesStable, ...RecipesExperimental, ...(recipes as unknown as Recipe[])],
  reverseMaps: new Map([...ReverseMapsStable, ...ReverseMapsExperimental]),
  reverseMapsForIdObjects: new Map([...ReverseMapsForIdObjectsStable, ...ReverseMapsForIdObjectsExperimental, ...reverseMapsForIdObjects]) as never,
});
await multiUser.loginOrRegister(`seller@${brand.emailDomain}`, "lab-seller", "seller");
const owner = getInstanceOwnerIdHash();
if (!owner) throw new Error("IoM history fixture has no owner.");
const objects = createLabObjects(brand);
const department = await storeVersionedObject(objects.createDepartment({
  department: brand.department.id, name: brand.department.name, admin: owner,
}) as never);
await storeVersionedObject(objects.createRoleAssignment({
  department: department.idHash, subject: owner, role: "seller", issuer: owner, validFrom: Date.now(),
}) as never);
await multiUser.logout();
parentPort.postMessage({ kind: "history-ready" });
