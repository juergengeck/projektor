// packages/lab.core/storage.ts
/**
 * Session-scoped storage (D4): every page load boots each role into a fresh
 * directory. Reloading into persisted state wedges CHUM (paired and
 * connected, nothing flows) and one.models offers no repair short of a fresh
 * instance. Persistence returns only with a root cause for that wedge.
 */
import type { LabBrand } from "./brand.ts";

const NAME = /^[a-z-]{1,40}$/;
const SESSION = /^[0-9a-f]{8}$/;

export function resolveStorageDirectory(brand: LabBrand, search: string): string {
  const params = new URLSearchParams(search);
  const labInstance = params.get("labInstance");
  const labSession = params.get("labSession");
  if (labInstance === null || !NAME.test(labInstance)) {
    throw new Error(`${brand.label}: labInstance must match [a-z-]{1,40}, got ${JSON.stringify(labInstance)}.`);
  }
  if (labSession === null || !SESSION.test(labSession)) {
    throw new Error(`${brand.label}: labSession must be 8 hex characters, got ${JSON.stringify(labSession)}.`);
  }
  return `${brand.storagePrefix}-${labInstance}-${labSession}`;
}

/** Earlier sessions' directories for one role; `keep` is the live one. */
export function staleSessionDirectories(brand: LabBrand, role: string, keep: string, names: readonly string[]): string[] {
  const prefix = `${brand.storagePrefix}-${role}-`;
  return names.filter(name => name.startsWith(prefix) && name !== keep);
}
