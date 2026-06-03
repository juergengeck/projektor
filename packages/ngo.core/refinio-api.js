import { initializeModuleGraph, ModuleRegistry } from "../../../one/packages/refinio.api/dist/src/plan-system-index.js";
import { addRecipeToRuntime, hasRecipe } from "../../../one/packages/one.core/lib/object-recipes.js";
import { calculateHashOfObj, calculateIdHashOfObj } from "../../../one/packages/one.core/lib/util/object.js";
import {
  getObjectByIdHash,
  storeVersionedObject,
} from "../../../one/packages/one.core/lib/storage-versioned-objects.js";
import RecipesStable from "../../../one/packages/one.models/lib/recipes/recipes-stable.js";
import RecipesExperimental from "../../../one/packages/one.models/lib/recipes/recipes-experimental.js";
import {
  ReverseMapsForIdObjectsStable,
  ReverseMapsStable,
} from "../../../one/packages/one.models/lib/recipes/reversemaps-stable.js";
import {
  createNgoModule,
  NgoCoreRecipes,
  NgoCoreReverseMaps,
  NgoCoreReverseMapsForIdObjects,
} from "./index.js";

export function createNgoOneCoreSupply(overrides = {}) {
  return {
    hasRecipe,
    addRecipeToRuntime,
    calculateHashOfObj,
    calculateIdHashOfObj,
    storeVersionedObject,
    getObjectByIdHash,
    ...overrides,
  };
}

export function createNgoRefinioRuntimeConfig({
  recipes = [],
  reverseMaps = [],
  reverseMapsForIdObjects = [],
} = {}) {
  return {
    recipes: [...RecipesStable, ...RecipesExperimental, ...NgoCoreRecipes, ...recipes],
    reverseMaps: mergeReverseMapEntries([...ReverseMapsStable, ...NgoCoreReverseMaps, ...reverseMaps]),
    reverseMapsForIdObjects: mergeReverseMapEntries([
      ...ReverseMapsForIdObjectsStable,
      ...NgoCoreReverseMapsForIdObjects,
      ...reverseMapsForIdObjects,
    ]),
  };
}

export async function initializeNgoModuleGraph({
  data,
  module = createNgoModule({ data }),
  modules = [],
  oneCore = createNgoOneCoreSupply(),
  registry,
  operationRegistry,
  storageFunction = oneCore.storeVersionedObject,
  supplies = {},
  beforeInit,
} = {}) {
  return initializeModuleGraph({
    registry: registry || new ModuleRegistry(operationRegistry),
    storageFunction,
    supplies: {
      OneCore: oneCore,
      ...(data ? { NgoWorkspace: data } : {}),
      ...supplies,
    },
    modules: [...modules, module],
    beforeInit,
  });
}

function mergeReverseMapEntries(entries) {
  const merged = new Map();
  for (const [type, properties] of entries) {
    const current = merged.get(type) || new Set();
    for (const property of properties || []) current.add(property);
    merged.set(type, current);
  }
  return merged;
}
