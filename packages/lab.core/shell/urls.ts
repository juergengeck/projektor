// packages/lab.core/shell/urls.ts
import type { LabBrand } from "../brand.ts";

/** Lane-app iframe URL: the lane app boots from the brand's lane with its
 * instance key and the host page load's session id. */
export function labAppUrl(href: string, brand: LabBrand, key: string, session: string): string {
  const url = new URL("/browser/app/", href);
  url.searchParams.set("lane", brand.lane);
  url.searchParams.set("labInstance", key);
  url.searchParams.set("labSession", session);
  return url.href;
}
