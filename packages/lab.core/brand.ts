/**
 * Everything that distinguishes one lab lane from another. Recipes,
 * projection, plans and the instance are brand-agnostic and receive a
 * LabBrand; nothing else may branch on the lane.
 */
export interface LabBrand {
  id: "amway" | "ek";
  /** Recipe name prefix; stored types are `${typePrefix}Department` etc. Never change it. */
  typePrefix: "Amway" | "Ek";
  /** Error message prefix. */
  label: string;
  orderKeyPrefix: string;
  stock: { lot: string; facility: string };
  emailDomain: string;
  department: { id: string; name: string };
  /** IndexedDB directory prefix; unique per brand because lanes share an origin. */
  storagePrefix: string;
  /** Lane id: the host path segment (`/lab/<lane>`) and the lane-app `?lane=`. */
  lane: string;
}

export const AMWAY: LabBrand = {
  id: "amway",
  typePrefix: "Amway",
  label: "Amway lab",
  orderKeyPrefix: "lab-order",
  stock: { lot: "demo-lot-a", facility: "demo-facility" },
  emailDomain: "lab.local",
  department: { id: "demo-de", name: "Demo DE" },
  storagePrefix: "amway-lab",
  lane: "amway",
};

export const EK: LabBrand = {
  id: "ek",
  typePrefix: "Ek",
  label: "Ek lab",
  orderKeyPrefix: "ek-order",
  stock: { lot: "ek-lot-a", facility: "ek-facility" },
  emailDomain: "ek.local",
  department: { id: "ek-de", name: "Elektro Klein" },
  storagePrefix: "ek-lab",
  lane: "ek",
};

export const LAB_BRANDS: readonly LabBrand[] = [AMWAY, EK];

export function brandById(id: string): LabBrand {
  const brand = LAB_BRANDS.find(entry => entry.id === id);
  if (!brand) throw new Error(`lab.core: unknown brand ${JSON.stringify(id)} (known: ${LAB_BRANDS.map(entry => entry.id).join(", ")}).`);
  return brand;
}
