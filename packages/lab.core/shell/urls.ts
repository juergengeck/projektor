// packages/lab.core/shell/urls.ts
import type { LabBrand } from "../brand.ts";

/** Lane-app iframe URL: the lane app boots from the brand's lane with its
 * instance key and the host page load's session id. A commserver override on
 * the lane page travels with it: the iframe boots its own ONE instance, so
 * without forwarding the override the mesh would pair over the default
 * commserver instead of the hermetic test one. Only ws(s) URLs pass. */
export function labAppUrl(href: string, brand: LabBrand, key: string, session: string): string {
  const here = new URL(href);
  const url = new URL("/browser/app/", here);
  url.searchParams.set("lane", brand.lane);
  url.searchParams.set("labInstance", key);
  url.searchParams.set("labSession", session);
  const commServer = here.searchParams.get("commServer") ?? "";
  if (/^wss?:\/\//.test(commServer)) url.searchParams.set("commServer", commServer);
  return url.href;
}

/** Canonical lane host address (`/lab/amway`, `/lab/ek`): the page that boots
 * the four role iframes and that IoM invitations open. */
export function laneHostUrl(origin: string, brand: LabBrand): string {
  return new URL(`/lab/${brand.lane}`, origin).href;
}

/** Lane named by a lane host path (`/lab/<lane>`, trailing slash allowed). */
export function laneFromHostPath(pathname: string): string | null {
  return /^\/lab\/([a-z]+)\/?$/.exec(pathname)?.[1] ?? null;
}
