// packages/lab.core/invite-url.ts
/**
 * Lane invitation URLs for mesh (IoP) pairing over the local lab:// switch.
 *
 * `connection.createInvite` returns bare pairing parts whose rendezvous URL
 * points at the commserver (for IoM). Mesh invites redial at the lab://
 * listener instead (see pairAll in worker/host-switch.ts), so the lane URL
 * carries the inviter's lab:// endpoint in the fragment and the decoder
 * rejects anything else: a commserver URL here would pair across the wrong
 * transport. The envelope (invited=true + JSON fragment) mirrors the IoM
 * format in iom.ts; fragment `mode` distinguishes the two ("IoP" vs "IoM").
 */
import { PAIRING_PROTOCOL_VERSION } from "../../../one/packages/one.models/lib/misc/ConnectionEstablishment/PairingManager.js";
import type { LabBrand } from "./brand.ts";

export interface MeshInvite {
  token: string;
  /** Inviter's lab:// endpoint; the acceptor dials here through the host switch. */
  url: string;
  publicKey: string;
  pairingProtocolVersion: number;
  pairingMode: "primed";
  mode: "IoP";
  /** Invited owner's email hint, from the `fe` query param. */
  email?: string;
}

const TOKEN_PATTERN = /^[0-9a-zA-Z_-]{16,128}$/;

function reject(reason: string, label: string): never {
  throw new Error(`${label}: not a lab mesh invitation (${reason}).`);
}

export function encodeMeshInviteUrl({ appBaseUrl, email, token, url, publicKey, pairingMode }: {
  appBaseUrl: string;
  email?: string;
  token: string;
  url: string;
  publicKey: string;
  pairingMode: "primed";
}): string {
  const inviteUrl = new URL(String(appBaseUrl ?? "").trim() || "http://localhost/");
  inviteUrl.searchParams.set("invited", "true");
  inviteUrl.searchParams.set("connectionMode", "primed");
  if (email) inviteUrl.searchParams.set("fe", email);
  inviteUrl.hash = encodeURIComponent(JSON.stringify({
    token,
    url,
    publicKey,
    pairingProtocolVersion: PAIRING_PROTOCOL_VERSION,
    pairingMode,
    mode: "IoP",
  }));
  return inviteUrl.toString();
}

/**
 * Read the pairing mode off a lane invitation URL (`invited=true` plus a
 * JSON fragment): "IoM" for same-person commserver pairing, "IoP" for mesh
 * pairing over the lab:// switch. Anything else fails fast.
 */
export function inviteMode(invitationUrl: string, brand: LabBrand): "IoM" | "IoP" {
  const label = brand.label;
  let url: URL;
  try {
    url = new URL(String(invitationUrl ?? "").trim());
  } catch {
    return reject("unparseable URL", label);
  }
  if (url.searchParams.get("invited") !== "true" || !url.hash || url.hash.length <= 1) {
    return reject("not a lane invitation", label);
  }
  let fragment: Record<string, unknown>;
  try {
    fragment = JSON.parse(decodeURIComponent(url.hash.slice(1))) as Record<string, unknown>;
  } catch {
    return reject("undecodable payload", label);
  }
  if (fragment.mode !== "IoM" && fragment.mode !== "IoP") return reject("wrong mode", label);
  return fragment.mode;
}

/**
 * Strictly validate a mesh invitation URL; anything else fails fast. Only
 * the `invited` marker, the fragment (token, lab:// rendezvous URL) and the
 * optional email hint matter — the origin is never fetched.
 */
export function decodeMeshInvite(invitationUrl: string, brand: LabBrand): MeshInvite {
  const label = brand.label;
  let url: URL;
  try {
    url = new URL(String(invitationUrl ?? "").trim());
  } catch {
    return reject("unparseable URL", label);
  }
  if (url.searchParams.get("invited") !== "true") return reject("wrong mode", label);
  if (!url.hash || url.hash.length <= 1) return reject("missing payload", label);
  let fragment: Record<string, unknown>;
  try {
    fragment = JSON.parse(decodeURIComponent(url.hash.slice(1))) as Record<string, unknown>;
  } catch {
    return reject("undecodable payload", label);
  }
  if (fragment.mode !== "IoP") return reject("wrong mode", label);
  if (typeof fragment.token !== "string" || !TOKEN_PATTERN.test(fragment.token)) return reject("bad token", label);
  if (typeof fragment.url !== "string") return reject("bad rendezvous", label);
  let rendezvous: URL;
  try {
    rendezvous = new URL(fragment.url);
  } catch {
    return reject("bad rendezvous", label);
  }
  if (rendezvous.protocol !== "lab:") return reject("bad rendezvous", label);
  if (typeof fragment.publicKey !== "string" || fragment.publicKey.length < 32) return reject("bad public key", label);
  if (fragment.pairingProtocolVersion !== PAIRING_PROTOCOL_VERSION) return reject("protocol mismatch", label);
  if (fragment.pairingMode !== "primed") return reject("bad pairing mode", label);
  const email = url.searchParams.get("fe") ?? undefined;
  if (email !== undefined && !email.includes("@")) return reject("bad email", label);
  return {
    token: fragment.token,
    url: fragment.url,
    publicKey: fragment.publicKey,
    pairingProtocolVersion: fragment.pairingProtocolVersion,
    pairingMode: "primed",
    mode: "IoP",
    ...(email === undefined ? {} : { email }),
  };
}
