// packages/amway.lab/iom.ts
/**
 * IoM (self-device) invitations for the lab lane.
 *
 * A lab role's Person id derives from its email, so a second device that
 * registers with the exact same email reproduces the exact same Person id
 * with fresh instance keys. A same-person pairing invitation then authorizes
 * the new instance keys under a one-time token, and the native stack reports
 * the link as Internet of Me. Pairing never transfers identity; the invite
 * only introduces the two instances over a rendezvous relay neither side
 * could dial directly (browsers cannot listen).
 *
 * Invite URL: `<relay-http-origin>/amway/lab#<base64url-payload>` with
 * `{v: 1, mode: "IoM", relay, token, publicKey, person, email, department}`.
 * Acceptance is paste-only; no route is linked from any page.
 */
import { createWebSocket } from "../../../one/packages/one.core/lib/system/websocket.js";
import Connection from "../../../one/packages/one.models/lib/misc/Connection/Connection.js";
import WebSocketPlugin from "../../../one/packages/one.models/lib/misc/Connection/plugins/WebSocketPlugin.js";
import PromisePlugin from "../../../one/packages/one.models/lib/misc/Connection/plugins/PromisePlugin.js";
import { PAIRING_PROTOCOL_VERSION } from "../../../one/packages/one.models/lib/misc/ConnectionEstablishment/PairingManager.js";
import type ConnectionsModel from "../../../one/packages/one.models/lib/models/ConnectionsModel.js";

export interface IoMInvitePayload {
  v: 1;
  mode: "IoM";
  /** Base rendezvous URL, e.g. ws://127.0.0.1:4176/lab/relay */
  relay: string;
  token: string;
  publicKey: string;
  /** Owner Person id hash; the acceptor must hold this exact identity. */
  person: string;
  /** Owner email; the acceptor registers with this exact address. */
  email: string;
  department: string;
}

const HEX_64 = /^[0-9a-fA-F]{64}$/;
// Pairing tokens use the one.core 64-char alphabet, not hex.
const TOKEN_PATTERN = /^[0-9a-zA-Z_-]{16,128}$/;

function base64UrlEncode(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(payload: string): string {
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new TextDecoder().decode(bytes);
}

function relayHttpOrigin(relayUrl: string): string {
  const url = new URL(relayUrl);
  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Amway lab: IoM rendezvous must be a ws:// or wss:// URL.");
  }
  return `${url.protocol === "wss:" ? "https:" : "http:"}//${url.host}`;
}

export function encodeIoMInvite(payload: IoMInvitePayload): string {
  const origin = relayHttpOrigin(payload.relay);
  return `${origin}/amway/lab#${base64UrlEncode(JSON.stringify(payload))}`;
}

/** Strictly validate an invitation URL; anything else fails fast. */
export function decodeIoMInvite(invitationUrl: string): IoMInvitePayload {
  let url: URL;
  try {
    url = new URL(String(invitationUrl ?? "").trim());
  } catch {
    throw new Error("Amway lab: not a lab IoM invitation (unparseable URL).");
  }
  const fragment = url.hash.startsWith("#") ? url.hash.slice(1) : "";
  if (!fragment) throw new Error("Amway lab: not a lab IoM invitation (missing payload).");
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(base64UrlDecode(fragment)) as Record<string, unknown>;
  } catch {
    throw new Error("Amway lab: not a lab IoM invitation (undecodable payload).");
  }
  const reject = (reason: string): never => {
    throw new Error(`Amway lab: not a lab IoM invitation (${reason}).`);
  };
  if (payload.v !== 1) reject("unknown version");
  if (payload.mode !== "IoM") reject("wrong mode");
  if (typeof payload.relay !== "string") reject("missing rendezvous");
  try {
    relayHttpOrigin(payload.relay);
  } catch {
    reject("bad rendezvous");
  }
  if (typeof payload.token !== "string" || !TOKEN_PATTERN.test(payload.token)) reject("bad token");
  if (typeof payload.publicKey !== "string" || payload.publicKey.length < 32) reject("bad public key");
  if (typeof payload.person !== "string" || !HEX_64.test(payload.person)) reject("bad person");
  if (typeof payload.email !== "string" || !payload.email.includes("@")) reject("bad email");
  if (typeof payload.department !== "string" || !payload.department) reject("bad department");
  return payload as unknown as IoMInvitePayload;
}

export function relayRoomUrl(relay: string, token: string, side: "host" | "join"): string {
  return `${relay}?token=${token}&side=${side}`;
}

interface PairingInvitation {
  token: string;
  publicKey: string;
}

interface LabPairing {
  createInvitation(
    myPersonId?: string,
    token?: string,
    options?: { mode?: string; identityRelation?: string; deviceEnrollmentPersonId?: string },
  ): Promise<PairingInvitation>;
  connectUsingInvitation(invitation: Record<string, unknown>, myPersonId?: string): Promise<void>;
}

export interface IoMDeps {
  connections: ConnectionsModel;
  /** Instance owner Person id hash. */
  self(): string;
  /** Listener id carrying the registered pairing credential (lab:// url). */
  listenerUrl: string;
  /** Instance owner email; IoM invitations name it as the identity hint. */
  email: string;
}

interface PendingInvite {
  socket: { close(): void };
  paired: Promise<void>;
}

const pendingInvites = new Map<string, PendingInvite>();

function unref(timer: unknown): void {
  (timer as { unref?: () => void } | undefined)?.unref?.();
}

function waitOpen(socket: WebSocket, url: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = (finish: () => void): void => {
      clearTimeout(timer);
      socket.removeEventListener("open", onOpen);
      socket.removeEventListener("error", onError);
      finish();
    };
    const timer = setTimeout(() => {
      socket.close();
      done(() => reject(new Error(`Amway lab: rendezvous unreachable (${url}).`)));
    }, timeoutMs);
    unref(timer);
    const onOpen = (): void => done(resolve);
    const onError = (): void => done(() => reject(new Error(`Amway lab: rendezvous unreachable (${url}).`)));
    socket.addEventListener("open", onOpen);
    socket.addEventListener("error", onError);
  });
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

export function createIoMOps({ connections, self, listenerUrl, email }: IoMDeps) {
  const pairing = (connections as unknown as { pairing: LabPairing }).pairing;

  return {
    /**
     * Create a same-person pairing invitation and host its rendezvous room.
     * Returns immediately with the shareable URL; pairing completes when the
     * second device accepts. Await it with awaitIoMInvite.
     */
    async createIoMInvite({ department, relayUrl, openTimeoutMs = 15_000 }: {
      department: string;
      relayUrl: string;
      openTimeoutMs?: number;
    }): Promise<{ invitationUrl: string; token: string; person: string }> {
      const person = self();
      if (!department) throw new Error("Amway lab: IoM invitation needs a department.");
      if (!email || !email.includes("@")) throw new Error("Amway lab: IoM is not wired for this instance (owner email missing).");
      const relay = String(relayUrl ?? "").trim();
      relayHttpOrigin(relay);
      const invitation = await pairing.createInvitation(person, undefined, {
        mode: "primed",
        identityRelation: "same-person",
        deviceEnrollmentPersonId: person,
      });
      const socket = createWebSocket(relayRoomUrl(relay, invitation.token, "host"));
      await waitOpen(socket, relay, openTimeoutMs);
      // The outgoing side gains its PromisePlugin in connectWithEncryption;
      // the accepted side needs it added explicitly (the lab: chum-accept
      // path does the same for MessagePort sockets).
      const incoming = Connection.fromPlugin(new WebSocketPlugin(socket));
      incoming.addPlugin(new PromisePlugin());
      const paired = connections.acceptExternalConnection(incoming, listenerUrl).then(() => undefined);
      // Never float: awaitIoMInvite observes this promise; the catch below
      // only records so an unobserved failure cannot crash the worker.
      const observed = paired.catch(() => undefined);
      pendingInvites.set(invitation.token, { socket, paired: observed });
      const payload: IoMInvitePayload = {
        v: 1,
        mode: "IoM",
        relay,
        token: invitation.token,
        publicKey: String(invitation.publicKey),
        person,
        email,
        department,
      };
      return { invitationUrl: encodeIoMInvite(payload), token: invitation.token, person };
    },

    /** Wait for the pairing started by createIoMInvite (socket stays open). */
    async awaitIoMInvite({ token, timeoutMs = 120_000 }: {
      token: string;
      timeoutMs?: number;
    }): Promise<{ person: string }> {
      const pending = pendingInvites.get(token);
      if (!pending) throw new Error("Amway lab: unknown IoM invitation token.");
      await withTimeout(pending.paired, timeoutMs, "Amway lab: IoM pairing timed out waiting for the second device.");
      pendingInvites.delete(token);
      return { person: self() };
    },

    /**
     * Accept an IoM invitation on a device holding the invited identity
     * (registered with the exact invited email). Runs the standard
     * same-person pairing over the rendezvous room; the token authorizes
     * this instance's additional keys. Fails fast for any other person.
     */
    async acceptIoMInvite({ invitationUrl, timeoutMs = 120_000 }: {
      invitationUrl: string;
      timeoutMs?: number;
    }): Promise<{ person: string }> {
      const invite = decodeIoMInvite(invitationUrl);
      const person = self();
      if (person !== invite.person) {
        throw new Error(
          "Amway lab: this IoM invitation names a different person. " +
          `Open it on a device registered as ${invite.email}.`,
        );
      }
      await withTimeout(
        pairing.connectUsingInvitation({
          url: relayRoomUrl(invite.relay, invite.token, "join"),
          publicKey: invite.publicKey,
          token: invite.token,
          pairingMode: "primed",
          pairingProtocolVersion: PAIRING_PROTOCOL_VERSION,
          identityRelation: "same-person",
          deviceEnrollmentPersonId: invite.person,
        }, person),
        timeoutMs,
        "Amway lab: IoM pairing timed out.",
      );
      return { person };
    },
  };
}

export type IoMOps = ReturnType<typeof createIoMOps>;
