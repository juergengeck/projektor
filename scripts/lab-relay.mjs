/**
 * Token-room relay for lab IoM device pairing.
 *
 * Browsers cannot listen for inbound connections, so two lab instances on
 * different devices cannot dial each other directly. Both sides open an
 * outbound WebSocket here instead: the inviter's worker holds the host side
 * and feeds it into its ConnectionsModel via acceptExternalConnection, while
 * the joiner's worker runs the standard pairing handshake over its side
 * with connectUsingInvitation. The relay never interprets a frame; the
 * encrypted handshake, the pairing token check, and the same-person
 * identity proof all run peer to peer inside the ONE stack.
 *
 * Rooms are single-use and expire. A token alone grants nothing: it only
 * selects which two sockets get piped. Authentication stays with the
 * pairing token verification and the signed same-person identity evidence.
 */
import { WebSocketServer } from "ws";

export const LAB_RELAY_PATH = "/lab/relay";
export const LAB_RELAY_ROOM_TTL_MS = 10 * 60 * 1000;
// Pairing tokens use the one.core 64-char alphabet, not hex.
const TOKEN_PATTERN = /^[0-9a-zA-Z_-]{16,128}$/;

export function createLabRelay({ roomTtlMs = LAB_RELAY_ROOM_TTL_MS } = {}) {
  const rooms = new Map();
  const wss = new WebSocketServer({ noServer: true });

  const closeRoom = (token, code, reason) => {
    const room = rooms.get(token);
    if (!room) return;
    rooms.delete(token);
    clearTimeout(room.timer);
    for (const socket of [room.host, room.joiner]) {
      if (!socket) continue;
      try {
        if (socket.readyState <= 1) socket.close(code, reason);
      } catch {
        // Already gone; the room is deleted either way.
      }
    }
  };

  const pipe = (token, from, to) => {
    from.on("message", (data, isBinary) => {
      if (to.readyState === 1) to.send(data, { binary: isBinary });
    });
    const teardown = () => closeRoom(token, 1000, "peer closed");
    from.on("close", teardown);
    from.on("error", teardown);
  };

  const attachHost = (token, socket) => {
    const tag = token.slice(0, 8);
    const existing = rooms.get(token);
    if (existing?.host && existing.host.readyState <= 1) {
      console.info(`[lab-relay] ${tag} host conflict, refusing second host`);
      socket.close(4409, "room already hosted");
      return;
    }
    if (existing) closeRoom(token, 4409, "room replaced");
    const room = { host: socket, joiner: null, timer: undefined };
    room.timer = setTimeout(() => closeRoom(token, 4408, "room expired"), roomTtlMs);
    if (room.timer.unref) room.timer.unref();
    rooms.set(token, room);
    console.info(`[lab-relay] ${tag} room hosted, waiting for joiner`);
    socket.on("close", (code, reason) => {
      console.info(`[lab-relay] ${tag} host socket closed (${code} ${reason})`);
      closeRoom(token, 1000, "host closed");
    });
    socket.on("error", error => {
      console.info(`[lab-relay] ${tag} host socket error (${error.message})`);
      closeRoom(token, 1011, "host error");
    });
  };

  const attachJoiner = (token, socket) => {
    const tag = token.slice(0, 8);
    const room = rooms.get(token);
    if (!room || !room.host || room.host.readyState > 1) {
      console.info(`[lab-relay] ${tag} join refused (no live room)`);
      socket.close(4404, "unknown or expired room");
      return;
    }
    if (room.joiner) {
      console.info(`[lab-relay] ${tag} join refused (already joined)`);
      socket.close(4409, "room already joined");
      return;
    }
    room.joiner = socket;
    clearTimeout(room.timer);
    console.info(`[lab-relay] ${tag} joiner attached, piping`);
    pipe(token, room.host, socket);
    pipe(token, socket, room.host);
    socket.on("close", (code, reason) => {
      console.info(`[lab-relay] ${tag} joiner socket closed (${code} ${reason})`);
    });
  };

  const attach = (socket, token, side) => {
    if (side === "host") attachHost(token, socket);
    else attachJoiner(token, socket);
  };

  return {
    path: LAB_RELAY_PATH,
    roomCount() {
      return rooms.size;
    },
    handleUpgrade(request, socket, head) {
      let url;
      try {
        url = new URL(request.url ?? "", "http://local");
      } catch {
        return false;
      }
      if (url.pathname !== LAB_RELAY_PATH) return false;
      const token = url.searchParams.get("token") ?? "";
      const side = url.searchParams.get("side") ?? "";
      if (!TOKEN_PATTERN.test(token) || (side !== "host" && side !== "join")) {
        try {
          socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
        } finally {
          socket.destroy();
        }
        return true;
      }
      wss.handleUpgrade(request, socket, head, ws => attach(ws, token, side));
      return true;
    },
    shutdown() {
      for (const token of [...rooms.keys()]) closeRoom(token, 1001, "relay shutdown");
      wss.close();
    },
  };
}
