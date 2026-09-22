// packages/ek.lab/iom.ts
/**
 * IoM (self-device) invitations for the lab lane.
 *
 * A lab role's Person id derives from its email, so a second device that
 * registers with the exact same email reproduces the exact same Person id
 * with fresh instance keys. A same-person pairing invitation then authorizes
 * the new instance keys under a one-time token, and the native stack reports
 * the link as Internet of Me. Pairing never transfers identity; the invite
 * only introduces the two instances over a commserver neither side could
 * replace by listening directly (browsers cannot listen, and the mesh
 * `eklab://` endpoints are unreachable across devices) — the same join_token
 * discovery every ONE app pairs with (see the glue commserver and flexibel).
 * The mesh itself stays on the local `eklab://` switch; only IoM discovery
 * and pairing ride the commserver, through a dedicated ConnectionsModel
 * whose pairing listener lives there.
 *
 * Wire format mirrors the ONE stack's canonical invitation (ConnectionPlan +
 * ContactPairingUtils in flexibel): the invitation travels as the lane entry
 * `{appBase}?invited=true&connectionMode=primed` with the owner hint as
 * `fe`/`fdi` query params and the pairing handshake as an
 * `encodeURIComponent(JSON)` fragment carrying `{token, url, publicKey,
 * pairingProtocolVersion, pairingMode: "primed", identityRelation:
 * "same-person", deviceEnrollmentPersonId, mode: "IoM"}`. The fragment `url`
 * is the commserver both sides dial; opening the lane URL starts the join
 * flow in the lane itself.
 */
import { PAIRING_PROTOCOL_VERSION } from "../../../one/packages/one.models/lib/misc/ConnectionEstablishment/PairingManager.js";
import type ConnectionsModel from "../../../one/packages/one.models/lib/models/ConnectionsModel.js";

/** Commserver carrying lane IoM discovery and pairing (glue service). */
export const DEFAULT_COMM_SERVER_URL = "wss://api.glue.one/comm";

export { PAIRING_PROTOCOL_VERSION };

export interface IoMInvite {
  token: string;
  /** Commserver both devices dial for discovery and the pairing handshake. */
  url: string;
  publicKey: string;
  pairingProtocolVersion: number;
  pairingMode: "primed";
  identityRelation: "same-person";
  /** Owner Person id hash; the acceptor must hold this exact identity. */
  deviceEnrollmentPersonId: string;
  mode: "IoM";
  /** Owner email from the `fe` query param; the identity hint. */
  email: string;
}

const HEX_64 = /^[0-9a-fA-F]{64}$/;
// Pairing tokens use the one.core 64-char alphabet, not hex.
const TOKEN_PATTERN = /^[0-9a-zA-Z_-]{16,128}$/;
const INVITE_DEVICE_PATH = /\/(?:invites\/)?invitedevice(?:\/|$)/;
const INVITE_PARTNER_PATH = /\/(?:invites\/)?invitepartner(?:\/|$)/;

function commServerHttpOrigin(commServerUrl: string): string {
  const url = new URL(commServerUrl);
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Ek lab: IoM commserver must be a ws:// or wss:// URL.");
  }
  return `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
}

function reject(reason: string): never {
  throw new Error(`Ek lab: not a lab IoM invitation (${reason}).`);
}

/**
 * Strictly validate an invitation URL; anything else fails fast. Only the
 * path (mode), the `fe`/`fdi` params and the fragment (token, commserver
 * URL) matter — the origin is never fetched.
 */
export function decodeIoMInvite(invitationUrl: string): IoMInvite {
  let url: URL;
  try {
    url = new URL(String(invitationUrl ?? "").trim());
  } catch {
    return reject("unparseable URL");
  }
  if (INVITE_PARTNER_PATH.test(url.pathname.toLowerCase())) return reject("wrong mode");
  const pathMode = INVITE_DEVICE_PATH.test(url.pathname.toLowerCase()) ? "IoM" : undefined;
  if (!url.hash || url.hash.length <= 1) return reject("missing payload");
  let fragment: Record<string, unknown>;
  try {
    fragment = JSON.parse(decodeURIComponent(url.hash.slice(1))) as Record<string, unknown>;
  } catch {
    return reject("undecodable payload");
  }
  const embeddedMode = fragment.mode === "IoM" ? "IoM" : undefined;
  if (fragment.mode !== undefined && !embeddedMode) return reject("wrong mode");
  if (pathMode && embeddedMode && pathMode !== embeddedMode) return reject("mode conflict");
  if ((pathMode ?? embeddedMode) !== "IoM") return reject("wrong mode");
  if (typeof fragment.token !== "string" || !TOKEN_PATTERN.test(fragment.token)) return reject("bad token");
  if (typeof fragment.url !== "string") return reject("bad rendezvous");
  try {
    commServerHttpOrigin(fragment.url);
  } catch {
    return reject("bad rendezvous");
  }
  if (typeof fragment.publicKey !== "string" || fragment.publicKey.length < 32) return reject("bad public key");
  if (fragment.pairingProtocolVersion !== PAIRING_PROTOCOL_VERSION) return reject("protocol mismatch");
  if (fragment.pairingMode !== "primed") return reject("bad pairing mode");
  if (fragment.identityRelation !== "same-person") return reject("wrong mode");
  const email = url.searchParams.get("fe") ?? undefined;
  if (!email || !email.includes("@")) return reject("bad email");
  const queryPerson = url.searchParams.get("fdi") ?? undefined;
  const fragmentPerson = fragment.deviceEnrollmentPersonId;
  if (queryPerson !== undefined && fragmentPerson !== undefined && queryPerson !== fragmentPerson) {
    return reject("person conflict");
  }
  const person = queryPerson ?? fragmentPerson;
  if (typeof person !== "string" || !HEX_64.test(person)) return reject("bad person");
  return {
    token: fragment.token,
    url: fragment.url,
    publicKey: fragment.publicKey,
    pairingProtocolVersion: fragment.pairingProtocolVersion,
    pairingMode: "primed",
    identityRelation: "same-person",
    deviceEnrollmentPersonId: person,
    mode: "IoM",
    email,
  };
}

interface PairingInvitation {
  token: string;
  url: string;
  publicKey: string;
}

interface LabPairing {
  createInvitation(
    myPersonId?: string,
    token?: string,
    options?: { mode?: string; identityRelation?: string; deviceEnrollmentPersonId?: string },
  ): Promise<PairingInvitation>;
  connectUsingInvitation(
    invitation: Record<string, unknown>,
    myPersonId?: string,
    options?: { mode?: string },
  ): Promise<void>;
  onPairingSuccess: {
    listen(callback: (...args: unknown[]) => void): () => void;
  };
}

export interface IoMDeps {
  /** IoM-dedicated connections: pairing listener homed on the commserver. */
  connections: ConnectionsModel;
  /** Instance owner Person id hash. */
  self(): string;
  /** Instance owner email; IoM invitations name it as the identity hint. */
  email: string;
  /** Lane entry URL prefix the QR-encoded invitation links back to. */
  appBaseUrl: string;
}

function unref(timer: unknown): void {
  (timer as { unref?: () => void } | undefined)?.unref?.();
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    unref(timer);
  });
  return Promise.race([promise.then(value => {
    clearTimeout(timer);
    return value;
  }), timeout]);
}

/** Resolve once the pairing with this token commits on our side. */
function waitForPairingToken(
  pairing: LabPairing,
  token: string,
  timeoutMs: number,
  label: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unlisten();
      reject(new Error(label));
    }, timeoutMs);
    unref(timer);
    const unlisten = pairing.onPairingSuccess.listen((...args: unknown[]) => {
      if (args[5] !== token) return;
      clearTimeout(timer);
      unlisten();
      resolve();
    });
  });
}

export function createIoMOps({ connections, self, email, appBaseUrl }: IoMDeps) {
  const pairing = (connections as unknown as { pairing: LabPairing }).pairing;

  return {
    /**
     * Create a same-person pairing invitation on the commserver. Creating
     * the invitation registers this instance's pairing listener there, so
     * this is purely local work plus the listener registration — no relay
     * room to host. Returns immediately with the shareable lane URL; pairing
     * completes when the second device accepts. Await it with awaitIoMInvite.
     */
    async createIoMInvite(): Promise<{ invitationUrl: string; token: string; person: string }> {
      const person = self();
      if (!email || !email.includes("@")) throw new Error("Ek lab: IoM is not wired for this instance (owner email missing).");
      const invitation = await pairing.createInvitation(person, undefined, {
        mode: "primed",
        identityRelation: "same-person",
        deviceEnrollmentPersonId: person,
      });
      const base = String(appBaseUrl ?? "").trim() || "http://localhost/";
      const inviteUrl = new URL(base);
      inviteUrl.searchParams.set("invited", "true");
      inviteUrl.searchParams.set("connectionMode", "primed");
      inviteUrl.searchParams.set("fe", email);
      inviteUrl.searchParams.set("fdi", person);
      inviteUrl.hash = encodeURIComponent(JSON.stringify({
        token: invitation.token,
        url: invitation.url,
        publicKey: String(invitation.publicKey),
        pairingProtocolVersion: PAIRING_PROTOCOL_VERSION,
        pairingMode: "primed",
        identityRelation: "same-person",
        deviceEnrollmentPersonId: person,
        mode: "IoM",
      }));
      return { invitationUrl: inviteUrl.toString(), token: invitation.token, person };
    },

    /** Wait for the pairing started by createIoMInvite to commit. */
    async awaitIoMInvite({ token, timeoutMs = 120_000 }: {
      token: string;
      timeoutMs?: number;
    }): Promise<{ person: string }> {
      await waitForPairingToken(pairing, token, timeoutMs, "Ek lab: IoM pairing timed out waiting for the second device.");
      return { person: self() };
    },

    /**
     * Accept an IoM invitation on a device holding the invited identity
     * (registered with the exact invited email). Runs the standard
     * same-person pairing through the commserver named in the invitation;
     * the token authorizes this instance's additional keys. Fails fast for
     * any other person.
     */
    async acceptIoMInvite({ invitationUrl, timeoutMs = 120_000 }: {
      invitationUrl: string;
      timeoutMs?: number;
    }): Promise<{ person: string }> {
      const invite = decodeIoMInvite(invitationUrl);
      const person = self();
      if (person !== invite.deviceEnrollmentPersonId) {
        throw new Error(
          "Ek lab: this IoM invitation names a different person. " +
          `Open it on a device registered as ${invite.email}.`,
        );
      }
      // The `mode` marker is URL-level metadata; the pairing handshake only
      // takes the invitation itself, primed like the canonical IoM accept.
      await withTimeout(
        pairing.connectUsingInvitation({
          token: invite.token,
          url: invite.url,
          publicKey: invite.publicKey,
          pairingProtocolVersion: invite.pairingProtocolVersion,
          pairingMode: invite.pairingMode,
          identityRelation: invite.identityRelation,
          deviceEnrollmentPersonId: invite.deviceEnrollmentPersonId,
        }, person, { mode: "primed" }),
        timeoutMs,
        "Ek lab: IoM pairing timed out.",
      );
      return { person };
    },
  };
}

export type IoMOps = ReturnType<typeof createIoMOps>;
