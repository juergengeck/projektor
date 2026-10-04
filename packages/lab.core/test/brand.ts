import { brandById } from "../brand.ts";
import type { LabBrand } from "../brand.ts";

/** The brand a suite run verifies; ci.core sets LAB_BRAND per lane. */
export function testBrand(): LabBrand {
  const id = process.env.LAB_BRAND;
  if (!id) throw new Error("lab.core tests: LAB_BRAND is not set (run via ci.core/run-lane-suite.mjs or npm test).");
  return brandById(id);
}

/** Lanes may run side by side; each brand gets its own local commserver port. */
export function commServerPortFor(brand: LabBrand): number {
  return { amway: 18331, ek: 18332, igm: 18333 }[brand.id];
}
