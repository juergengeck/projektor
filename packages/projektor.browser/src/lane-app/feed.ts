// packages/projektor.browser/src/lane-app/feed.ts
/**
 * Brand-agnostic feed-row reducer shared by the lane shells and the lane app.
 * Switches on the worker-provided `row.kind` (offer/contact/order/chat/...),
 * never on brand-prefixed type names. Unread counts distinct incoming chat
 * messages per closed peer: the worker already dedupes channel replays, and
 * the counted hashes below make a repeated row idempotent too.
 */
import type { FeedRow } from "@projektor/lab.core/port-ipc.ts";

/**
 * The lane app talks to its own instance through the registry, not a worker
 * port. Structurally the calls it needs (`call`, `onFeed`), so the host's
 * `PlanRegistry` client and the worker `PortApiClient` both satisfy it.
 */
export interface LaneClient {
  call<T>(plan: string, method: string, params?: Record<string, unknown>): Promise<T>;
  onFeed(callback: (row: FeedRow) => void): () => void;
}

/** Feed kinds that change the projection: re-snapshot after one arrives. */
export const SNAPSHOT_TRIGGER_KINDS = ["assignment", "department", "order", "stock", "purchase-request", "purchase-decision"];

export interface Offer {
  offerId: string;
  item: string;
  priceList?: string;
  unitAmount: number;
  currency: string;
  publishedBy: string;
}

export interface Contact {
  person: string;
  name: string;
  role: string;
  publishedBy: string;
}

export interface Order {
  idempotencyKey: string;
  customer: string;
  seller: string;
  offer: string;
  quantity: number;
  currency: string;
  unitAmount: number;
  admittedAt: number;
}

export interface Balance {
  party: string;
  role: string;
  receivable: number;
  payable: number;
  currency: string;
}

export interface View {
  known: boolean;
  roles: string[];
  assignments: { subject: string; role: string; issuer: string; validFrom: number }[];
  contacts: Contact[];
  offers: Offer[];
  orders: Order[];
  pendingOrders: Order[];
  purchaseFailures: { idempotencyKey: string; offer: string; quantity: number; reason: string; decidedAt: number }[];
  availability: { lot: string; facility: string; stocked: number; available: number } | null;
  balances: Balance[];
  rejected: { type: string; id: string; reason: string }[];
}

export interface FeedEntry {
  at: string;
  type: string;
  kind: string;
  id: string;
  hash: string;
  label: string;
}

export interface FeedColumn {
  view: View;
  fresh: Record<string, string>;
  feedLog: FeedEntry[];
  chatPeer: string | null;
  /** Unread chat messages per peer: bumped by distinct incoming messages while the
   * peer's chat is closed, cleared when it opens. */
  chatUnread: Record<string, number>;
  /** Message hashes already counted, so a repeated row never counts twice. */
  seenChatHashes: string[];
}

export const EMPTY_FEED_VIEW: View = {
  known: false,
  roles: [],
  assignments: [],
  contacts: [],
  offers: [],
  orders: [],
  pendingOrders: [],
  purchaseFailures: [],
  availability: null,
  balances: [],
  rejected: [],
};

export function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function emptyColumn(): FeedColumn {
  return { view: EMPTY_FEED_VIEW, fresh: {}, feedLog: [], chatPeer: null, chatUnread: {}, seenChatHashes: [] };
}

function upsert<T>(list: T[], item: T, same: (entry: T) => boolean): T[] {
  const index = list.findIndex(same);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function formatFeedLabel(row: FeedRow): string {
  const obj = (row.obj ?? {}) as Record<string, unknown>;
  if (row.kind === "offer") {
    const amt = typeof obj.unitAmount === "number" ? (obj.unitAmount / 100).toFixed(2) : "";
    return `Offer ${row.id} (${amt} ${obj.currency || "EUR"})`;
  }
  if (row.kind === "order") {
    const state = (obj.admittedAt as number) > 0 ? "admitted" : "placed";
    return `Order ${row.id} ${state} (${obj.offer} ×${obj.quantity})`;
  }
  if (row.kind === "contact") {
    return `Contact ${obj.name || row.id} (${obj.role})`;
  }
  if (row.kind === "assignment") {
    return `Role ${(obj.subject as string)?.slice(0, 8)}… → ${obj.role}`;
  }
  if (row.kind === "department") {
    return `Department ${row.id}`;
  }
  if (row.kind === "chat") {
    return `Chat ${row.id.slice(0, 8)}…`;
  }
  return `${row.kind ?? row.type} ${row.id}`;
}

/** Fold one worker feed row into a column: freshness, activity log, view upserts and unread. */
export function applyFeedRow(column: FeedColumn, row: FeedRow, at: string): FeedColumn {
  const kind = row.kind;
  const fresh = { ...column.fresh, [`${kind ?? row.type}:${row.id}`]: row.hash };
  const entry: FeedEntry = { at, type: row.type, kind: kind ?? row.type, id: row.id, hash: row.hash, label: formatFeedLabel(row) };
  const feedLog = [entry, ...column.feedLog].slice(0, 30);
  const view = column.view;

  if (kind === "offer") {
    const offer = row.obj as unknown as Offer;
    return {
      ...column, fresh, feedLog,
      view: { ...view, offers: upsert(view.offers, offer, e => e.offerId === offer.offerId) },
    };
  }

  if (kind === "contact") {
    const contact = row.obj as unknown as Contact;
    return {
      ...column, fresh, feedLog,
      view: { ...view, contacts: upsert(view.contacts, contact, e => e.person === contact.person) },
    };
  }

  if (kind === "order") {
    const order = row.obj as unknown as Order;
    const same = (e: Order): boolean => e.idempotencyKey === order.idempotencyKey;
    // Placed (admittedAt 0) and admitted rows share the idempotency key:
    // each version replaces the other, never both.
    const orders = order.admittedAt > 0 ? upsert(view.orders, order, same) : view.orders.filter(e => !same(e));
    const pendingOrders = order.admittedAt === 0
      ? upsert(view.pendingOrders, order, same)
      : view.pendingOrders.filter(e => !same(e));
    // The balance itself comes from the projection snapshot (refreshed on
    // every order row below): recomputing it here from the viewer-scoped
    // order list showed each column its own number.
    return { ...column, fresh, feedLog, view: { ...view, orders, pendingOrders } };
  }

  const chatUnread = { ...column.chatUnread };
  let seenChatHashes = column.seenChatHashes;
  if (kind === "chat" && (row.obj?.incoming as boolean) === true && row.id !== column.chatPeer &&
    !seenChatHashes.includes(row.hash)) {
    chatUnread[row.id] = (chatUnread[row.id] ?? 0) + 1;
    seenChatHashes = [...seenChatHashes, row.hash].slice(-500);
  }
  return { ...column, fresh, feedLog, chatUnread, seenChatHashes };
}
