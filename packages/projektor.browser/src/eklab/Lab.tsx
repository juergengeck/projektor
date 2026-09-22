// packages/projektor.browser/src/lab/Lab.tsx
import { useEffect, useReducer, useRef, useState } from "react";
import { LabDeviceInvite } from "../components/LabDeviceInvite";
import { bootJoinInstance, bootLab, LAB_KEYS, type FeedRow, type LabHandle, type LabKey } from "./transport";
import type { PortApiClient } from "@projektor/ek.lab/port-ipc.ts";
import { Badge, RoleBadge } from "../components/ui";
import ekLogo from "./assets/elektro-klein-logo.jpg";
import omniturm from "./assets/omniturm.jpg";

/**
 * Invitation link opened from a QR code (`?invited=true` plus the pairing
 * payload in the hash): the lane offers to join as a second device instead
 * of booting another mesh.
 */
function inviteLinkFromLocation(): string | null {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("invited") === "true" && url.hash.length > 1 ? url.toString() : null;
  } catch {
    return null;
  }
}

const TITLES: Record<LabKey, { title: string; subtitle: string; roleType: string }> = {
  admin: { title: "Klein", subtitle: "Root Authority & Scope Governance", roleType: "admin" },
  manager: { title: "Bauleiter", subtitle: "Catalog, Offers & Team Management", roleType: "manager" },
  seller: { title: "Vorarbeiter", subtitle: "Sales & Order Admission", roleType: "seller" },
  customer: { title: "Werker", subtitle: "Client Account & Direct Purchase", roleType: "customer" },
};

const DEPARTMENT = "ek-de";

function roleLabel(role: string): string {
  return Object.hasOwn(TITLES, role) ? TITLES[role as LabKey].title : role;
}

function EkRoleBadge({ role }: { role: string }) {
  return <RoleBadge role={role} label={roleLabel(role)} />;
}

/** Clipboard fallback for contexts without navigator.clipboard. */
function fallbackCopy(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

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

export type { FeedRow };

export interface FeedEntry {
  at: string;
  type: string;
  id: string;
  hash: string;
  label: string;
}

export type TabKey = "overview" | "offers" | "orders" | "contacts" | "activity";

function ContactNameField({ currentName, role, disabled, onSave }: {
  currentName: string; role: string; disabled: boolean; onSave: (name: string, role: string) => void;
}) {
  const [name, setName] = useState(currentName);
  const trimmed = name.trim();
  return (
    <div className="lab-contact-name">
      <input
        type="text"
        value={name}
        maxLength={120}
        placeholder="Contact name"
        aria-label="Contact name"
        disabled={disabled}
        onChange={e => setName(e.target.value)}
      />
      <button
        type="button"
        className="secondary"
        disabled={disabled || !trimmed || trimmed === currentName}
        onClick={() => onSave(trimmed, role)}
      >
        {currentName ? "Save Name" : "Publish Contact"}
      </button>
    </div>
  );
}

function StockUpField({ disabled, onSave }: {
  disabled: boolean; onSave: (receiptId: string, quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState("10");
  const amount = Number(quantity);
  const valid = Number.isSafeInteger(amount) && amount > 0;
  return (
    <div className="lab-contact-name">
      <input
        type="number"
        min={1}
        step={1}
        value={quantity}
        aria-label="Stock quantity"
        disabled={disabled}
        onChange={e => setQuantity(e.target.value)}
      />
      <button
        type="button"
        className="btn-accent"
        disabled={disabled || !valid}
        onClick={() => onSave(`stock-${Date.now()}`, amount)}
      >
        Stock Up
      </button>
    </div>
  );
}

export interface Column {
  online: boolean;
  view: View;
  fresh: Record<string, string>;
  notice: string;
  tab: TabKey;
  feedLog: FeedEntry[];
  chatPeer: string | null;
  /** Unread chat messages per peer: bumped by chat feed rows while the
   * peer's chat is closed, cleared when it opens. */
  chatUnread: Record<string, number>;
}

type State = Record<LabKey, Column>;

type Action =
  | { kind: "snapshot"; key: LabKey; view: View }
  | { kind: "feed"; key: LabKey; row: FeedRow }
  | { kind: "online"; key: LabKey; online: boolean }
  | { kind: "tab"; key: LabKey; tab: TabKey }
  | { kind: "notice"; key: LabKey; notice: string }
  | { kind: "clear_notice"; key: LabKey }
  | { kind: "chat"; key: LabKey; peer: string | null };

const EMPTY_VIEW: View = {
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

function upsert<T>(list: T[], item: T, same: (entry: T) => boolean): T[] {
  const index = list.findIndex(same);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function timeNow(): string {
  return new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatFeedLabel(row: FeedRow): string {
  if (row.type === "EkOffer") {
    const obj = row.obj as Record<string, unknown>;
    const amt = typeof obj.unitAmount === "number" ? (obj.unitAmount / 100).toFixed(2) : "";
    return `Offer ${row.id} (${amt} ${obj.currency || "EUR"})`;
  }
  if (row.type === "EkOrder") {
    const obj = row.obj as Record<string, unknown>;
    const state = (obj.admittedAt as number) > 0 ? "admitted" : "placed";
    return `Order ${row.id} ${state} (${obj.offer} ×${obj.quantity})`;
  }
  if (row.type === "EkContact") {
    const obj = row.obj as Record<string, unknown>;
    return `Contact ${obj.name || row.id} (${roleLabel(String(obj.role))})`;
  }
  if (row.type === "EkRoleAssignment") {
    const obj = row.obj as Record<string, unknown>;
    return `Role ${(obj.subject as string)?.slice(0, 8)}… → ${roleLabel(String(obj.role))}`;
  }
  if (row.type === "EkDepartment") {
    return `Department ${row.id}`;
  }
  return `${row.type} ${row.id}`;
}

function reduce(state: State, action: Action): State {
  const column = state[action.key];
  if (action.kind === "snapshot") {
    // getDepartment answers { known: false } without projection fields until
    // the department reaches that worker. Keep the empty view for those
    // answers; storing them would crash role rendering on missing fields.
    const view = action.view.known ? action.view : { ...EMPTY_VIEW };
    return { ...state, [action.key]: { ...column, view, notice: "" } };
  }
  if (action.kind === "online") {
    return { ...state, [action.key]: { ...column, online: action.online } };
  }
  if (action.kind === "tab") {
    return { ...state, [action.key]: { ...column, tab: action.tab } };
  }
  if (action.kind === "notice") {
    return { ...state, [action.key]: { ...column, notice: action.notice } };
  }
  if (action.kind === "clear_notice") {
    return { ...state, [action.key]: { ...column, notice: "" } };
  }
  if (action.kind === "chat") {
    const chatUnread = { ...column.chatUnread };
    if (action.peer) delete chatUnread[action.peer];
    return { ...state, [action.key]: { ...column, chatPeer: action.peer, chatUnread } };
  }

  const { row } = action;
  const view = column.view;
  const fresh = { ...column.fresh, [`${row.type}:${row.id}`]: row.hash };
  const entry: FeedEntry = {
    at: timeNow(),
    type: row.type,
    id: row.id,
    hash: row.hash,
    label: formatFeedLabel(row),
  };
  const feedLog = [entry, ...column.feedLog].slice(0, 30);

  if (row.type === "EkOffer") {
    const offer = row.obj as unknown as Offer;
    return {
      ...state,
      [action.key]: {
        ...column,
        fresh,
        feedLog,
        view: {
          ...view,
          offers: upsert(view.offers, offer, e => e.offerId === offer.offerId),
        },
      },
    };
  }

  if (row.type === "EkContact") {
    const contact = row.obj as unknown as Contact;
    return {
      ...state,
      [action.key]: {
        ...column,
        fresh,
        feedLog,
        view: {
          ...view,
          contacts: upsert(view.contacts, contact, e => e.person === contact.person),
        },
      },
    };
  }

  if (row.type === "EkOrder") {
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
    return {
      ...state,
      [action.key]: {
        ...column,
        fresh,
        feedLog,
        view: { ...view, orders, pendingOrders },
      },
    };
  }

  const chatUnread = { ...column.chatUnread };
  if (row.type === "EkChat" && row.id !== column.chatPeer) {
    chatUnread[row.id] = (chatUnread[row.id] ?? 0) + 1;
  }
  return { ...state, [action.key]: { ...column, fresh, feedLog, chatUnread } };
}

function initial(): State {
  return Object.fromEntries(
    LAB_KEYS.map(key => [
      key,
      {
        online: false,
        view: EMPTY_VIEW,
        fresh: {},
        notice: "",
        tab: "overview" as TabKey,
        feedLog: [],
        chatPeer: null as string | null,
        chatUnread: {},
      },
    ]),
  ) as unknown as State;
}

export interface ChatMsg {
  text: string;
  sender: string;
  sentAt: number;
}

/** 1:1 chat with a directory contact over its topic channel. Opens the
 * deterministic P2P topic, reads the thread, and re-reads whenever the
 * worker reports a new message for this peer. */
function ChatPanel({ client, me, peer, peerName, onClose }: {
  client: PortApiClient | undefined;
  me: string;
  peer: string;
  peerName: string;
  onClose: () => void;
}) {
  const [thread, setThread] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("opening chat…");
  useEffect(() => {
    if (!client) {
      setStatus("worker not ready");
      return;
    }
    let cancelled = false;
    const read = async () => {
      try {
        const result = await client.call<{ messages: ChatMsg[] }>("ekChat", "readChat", { peer });
        if (!cancelled) {
          setThread(result.messages);
          setStatus("");
        }
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : String(error));
      }
    };
    void (async () => {
      try {
        await client.call("ekChat", "openChat", { peer });
        if (!cancelled) await read();
      } catch (error) {
        if (!cancelled) setStatus(error instanceof Error ? error.message : String(error));
      }
    })();
    const off = client.onFeed(row => {
      if (row.type === "EkChat" && row.id === peer) void read();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [client, peer]);
  const send = async () => {
    if (!client) return;
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    try {
      await client.call("ekChat", "sendChat", { peer, text: body });
      const result = await client.call<{ messages: ChatMsg[] }>("ekChat", "readChat", { peer });
      setThread(result.messages);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      setDraft(body);
    }
  };
  const fmtTime = (at: number) =>
    at > 0
      ? new Date(at).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : "";
  return (
    <div className="lab-chat" aria-label={`Chat with ${peerName}`}>
      <div className="lab-chat-header">
        <span>Chat with {peerName}</span>
        <button type="button" className="lab-copy-btn" onClick={onClose} aria-label="Close chat">
          ✕
        </button>
      </div>
      {status !== "" && <div className="lab-chat-status">{status}</div>}
      {status === "" && (
        <div className="lab-chat-thread">
          {thread.length === 0 ? (
            <div className="state-empty" style={{ padding: "0.4rem", fontSize: "0.72rem" }}>
              No messages yet.
            </div>
          ) : (
            thread.map((message, index) => (
              <div
                key={`${message.sentAt}-${message.sender.slice(0, 8)}-${index}`}
                className={`lab-chat-msg ${message.sender === me ? "lab-chat-own" : ""}`}
              >
                <span className="lab-chat-text">{message.text}</span>
                <span className="lab-chat-time">{fmtTime(message.sentAt)}</span>
              </div>
            ))
          )}
        </div>
      )}
      <div className="lab-chat-composer">
        <input
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onKeyDown={event => {
            if (event.key === "Enter") void send();
          }}
          placeholder={`Message ${peerName}`}
          aria-label={`Message ${peerName}`}
          maxLength={2000}
          style={{ flex: 1, minWidth: 0, fontSize: "0.72rem" }}
        />
        <button type="button" className="secondary sm" disabled={draft.trim() === ""} onClick={() => void send()}>
          Send
        </button>
      </div>
    </div>
  );
}

export default function Lab() {
  const [state, dispatch] = useReducer(reduce, undefined, initial);
  const [boot, setBoot] = useState<"booting" | "live" | string>("booting");
  const [bootStage, setBootStage] = useState("spawning workers");
  const [buying, setBuying] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const lab = useRef<LabHandle | null>(null);
  const [joinInvite] = useState<string | null>(() => inviteLinkFromLocation());
  const [joinStatus, setJoinStatus] = useState("");
  const joinHandle = useRef<LabHandle | null>(null);
  const [joined, setJoined] = useState<null | { key: LabKey; person: string; view: View }>(null);

  useEffect(() => {
    let cancelled = false;
    const offs: (() => void)[] = [];

    if (joinInvite) {
      // Invitation link: join-only page with no mesh boot. The inviting tab
      // stays alive elsewhere and holds the pairing listener; booting a mesh
      // here would only waste workers.
      setBootStage("invitation link — join only");
      setBoot("live");
      return () => {
        cancelled = true;
      };
    }

    bootLab(setBootStage)
      .then(async handle => {
        if (cancelled) {
          await handle.stop();
          return;
        }
        lab.current = handle;
        for (const key of LAB_KEYS) {
          const client = handle.clients[key];
          const snapshot = async () =>
            dispatch({
              kind: "snapshot",
              key,
              view: await client.call("ekLab", "getDepartment", { department: DEPARTMENT }),
            });

          offs.push(
            client.onFeed((row: FeedRow) => {
              dispatch({ kind: "feed", key, row });
              if (row.type === "EkRoleAssignment" || row.type === "EkDepartment" || row.type === "EkOrder" || row.type === "EkPurchaseRequest" || row.type === "EkPurchaseDecision" || row.type === "EkStockReceipt") {
                snapshot().catch(error => dispatch({ kind: "notice", key, notice: error.message }));
              }
            }),
          );
          await snapshot();
          dispatch({ kind: "online", key, online: true });
        }
        setBoot("live");
      })
      .catch(error => setBoot(error instanceof Error ? error.message : String(error)));

    return () => {
      cancelled = true;
      offs.forEach(off => off());
      void lab.current?.stop();
      lab.current = null;
    };
  }, []);

  // Keep a 1:1 chat room open for every directory contact (except self) so
  // incoming messages raise feed notifications — and the unread badge — even
  // when that peer's chat panel is closed. Rooms are deterministic P2P
  // topics: either side may create them, and reopening is a cache hit.
  const openChats = useRef<Record<LabKey, Set<string>>>({
    admin: new Set(), manager: new Set(), seller: new Set(), customer: new Set(),
  });
  useEffect(() => {
    const handle = lab.current;
    if (!handle || boot !== "live") return;
    for (const key of LAB_KEYS) {
      const me = handle.persons[key];
      if (!me) continue;
      const opened = openChats.current[key];
      for (const contact of state[key].view.contacts) {
        if (contact.person === me || opened.has(contact.person)) continue;
        opened.add(contact.person);
        handle.clients[key]
          .call("ekChat", "openChat", { peer: contact.person })
          .catch(() => opened.delete(contact.person));
      }
    }
  });

  async function run(key: LabKey, method: string, params: Record<string, unknown>) {
    const handle = lab.current;
    if (!handle) return;
    try {
      await handle.clients[key].call("ekLab", method, { department: DEPARTMENT, ...params });
    } catch (error) {
      dispatch({ kind: "notice", key, notice: error instanceof Error ? error.message : String(error) });
    }
  }

  async function buy(offer: string) {
    if (buying) return;
    setBuying(true);
    try { await run("customer", "buy", { offer, quantity: 1 }); }
    finally { setBuying(false); }
  }

  function copyPerson(key: LabKey) {
    const person = lab.current?.persons[key];
    if (!person) return;
    void navigator.clipboard?.writeText(person);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  /** Join link opened from a QR invitation: boot a same-person device and pair it. */
  async function joinWithInviteLink(invitationUrl: string) {
    if (joinHandle.current) {
      setJoinStatus("A joined device is already active; leave it first.");
      return;
    }
    let key: LabKey | null = null;
    try {
      const prefix = (new URL(invitationUrl).searchParams.get("fe") ?? "").split("@")[0];
      key = (LAB_KEYS as readonly string[]).includes(prefix) ? (prefix as LabKey) : null;
    } catch {
      key = null;
    }
    if (!key) {
      setJoinStatus("That URL is not a lab device invitation.");
      return;
    }
    setJoinStatus("booting device…");
    setJoined(null);
    try {
      const handle = await bootJoinInstance(key);
      joinHandle.current = handle;
      const client = handle.clients[key];
      const snapshotJoined = async () => {
        const raw = await client.call("ekLab", "getDepartment", { department: DEPARTMENT }) as View;
        const view = raw.known ? raw : { ...EMPTY_VIEW };
        setJoined(current => current ? { ...current, view } : current);
      };
      client.onFeed((row: FeedRow) => {
        if (row.type === "EkRoleAssignment" || row.type === "EkDepartment" || row.type === "EkOrder" || row.type === "EkPurchaseRequest" || row.type === "EkPurchaseDecision" || row.type === "EkStockReceipt") {
          void snapshotJoined().catch(() => {});
        }
      });
      const accepted = await client.call("ekLab", "acceptIoMInvite", {
        invitationUrl,
      }) as { person: string };
      setJoined({ key, person: accepted.person, view: { ...EMPTY_VIEW } });
      await snapshotJoined().catch(() => {});
      setJoinStatus("device paired ✓");
    } catch (error) {
      await joinHandle.current?.stop().catch(() => {});
      joinHandle.current = null;
      setJoined(null);
      setJoinStatus(`join failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function leaveJoined() {
    await joinHandle.current?.stop().catch(() => {});
    joinHandle.current = null;
    setJoined(null);
    setJoinStatus("");
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("invited");
      window.history.replaceState(null, "", url.pathname + url.search);
    } catch {
      // Link cleanup is cosmetic; the join state above already reset.
    }
  }

  const onlineCount = LAB_KEYS.filter(k => state[k].online).length;

  return (
    <div className="lab-container ek-lane">
      {/* Top Navigation & Mesh Status Header */}
      <header className="lab-header">
        <div className="ek-brand-heading">
          <a className="ek-logo" href="https://www.e-k-ag.de/" target="_blank" rel="noreferrer" aria-label="Elektro Klein AG website">
            <img src={ekLogo} width="200" height="70" alt="Elektro Klein AG" />
          </a>
          <div className="lab-title-group">
            <p className="ek-eyebrow">ELEKTRO KLEIN AG</p>
            <h1>EK lab</h1>
            <p className="lab-subtitle">Four connected workspaces · One team</p>
          </div>
        </div>
        <div className="ek-project-art">
          <img src={omniturm} alt="Omniturm, an Elektro Klein project in Frankfurt" />
          <span>Omniturm · Frankfurt</span>
        </div>

        <div className="lab-header-actions">
          <div className="lab-mesh-badge">
            <span className={boot === "live" && onlineCount === 4 ? "lab-pulse-online" : "lab-pulse-paused"} />
            <span>
              {boot === "booting"
                ? `Starting ${onlineCount}/4 nodes…`
                : boot === "live"
                  ? `Mesh: ${onlineCount}/4 Nodes Online`
                  : "Mesh unavailable"}
            </span>
          </div>

          <a href="#/overview" className="btn btn-secondary sm" style={{ textDecoration: "none" }}>
            ← Single-Instance App
          </a>

        </div>
      </header>

      {/* Booting Banner / Error Notice */}
      {boot !== "live" && (
        <div className={`card ${boot === "booting" ? "" : "state-denied"}`} style={{ marginBottom: "1.25rem", textAlign: "center" }}>
          {boot === "booting" ? (
            <p style={{ margin: 0, fontWeight: 600 }}>
              <span className="lab-pulse-online" /> Booting… {bootStage}
            </p>
          ) : (
            <p style={{ margin: 0, fontWeight: 600 }}>Boot Failure: {boot}</p>
          )}
        </div>
      )}

      {/* Invitation link (QR): join this lane as a second device */}
      {joinInvite && (
        <div className="card" role="dialog" aria-label="Join with device invitation" style={{ marginBottom: "1.25rem", fontSize: "0.8rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <strong>This device was invited to join the lane as a second device.</strong>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              <button type="button" className="secondary sm" onClick={() => void joinWithInviteLink(joinInvite)}>
                Join
              </button>
              <button type="button" className="secondary sm" onClick={() => void leaveJoined()}>
                Dismiss
              </button>
              {joinStatus && <span style={{ color: "var(--amway-muted)" }}>{joinStatus}</span>}
            </div>
            {joined && (
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", fontSize: "0.72rem" }}>
                <span style={{ color: "var(--amway-muted)" }}>Joined as {TITLES[joined.key].title}:</span>
                <span>{joined.person.slice(0, 10)}…{joined.person.slice(-4)}</span>
                {joined.view.roles.map(role => <EkRoleBadge key={role} role={role} />)}
                <button type="button" className="secondary sm" onClick={() => void leaveJoined()}>
                  Leave
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4-Node Multi-Worker Grid */}
      <div className="lab-grid">
        {LAB_KEYS.map(key => {
          const column = state[key];
          const { view } = column;
          const meta = TITLES[key];
          const staff = view.roles.includes("admin") || view.roles.includes("manager");
          const seller = staff || view.roles.includes("seller");
          const personId = lab.current?.persons[key] ?? "";
          const activeTab = column.tab;
          const isCustomer = key === "customer";
          const orderHistory = [...view.pendingOrders, ...view.orders];
          const purchaseCount = isCustomer ? view.orders.length : orderHistory.length;

          // Staff-only meter: sellers and customers project no availability
          // and must never see a phantom number here.
          const totalStock = view.availability?.stocked ?? 0;
          const currentStock = view.availability?.available ?? 0;
          const stockPct = totalStock > 0 ? Math.max(0, Math.min(100, (currentStock / totalStock) * 100)) : 0;
          const nameOf = (person: string) =>
            view.contacts.find(entry => entry.person === person)?.name
            ?? `${person.slice(0, 10)}…`;
          const fmtDate = (at: number) =>
            new Date(at).toLocaleString([], {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit", hour12: false,
            });
          const fmtMoney = (value: number, currency: string) =>
            `${(value / 100).toFixed(2)} ${currency}`;
          const unitsByCustomer = new Map<string, { units: number; orders: number; lastAt: number; seller: string }>();
          for (const entry of view.orders) {
            const agg = unitsByCustomer.get(entry.customer) ?? { units: 0, orders: 0, lastAt: 0, seller: entry.seller };
            agg.units += entry.quantity;
            agg.orders += 1;
            if (entry.admittedAt >= agg.lastAt) {
              agg.lastAt = entry.admittedAt;
              agg.seller = entry.seller;
            }
            unitsByCustomer.set(entry.customer, agg);
          }

          return (
            <div className="lab-device" key={key}>
            <section
              aria-label={meta.title}
              className={`lab-column lab-role-${meta.roleType} ${column.online ? "" : "lab-paused"}`}
            >
              {/* Column Header */}
              <header className="lab-column-header">
                <div className="lab-column-title-row">
                  <div className="lab-role-title">
                    <span>{meta.title}</span>
                  </div>
                  <Badge
                    text={boot === "booting" ? "Starting…" : boot !== "live" ? "Unavailable" : column.online ? "Online" : "Offline"}
                    variant={boot === "live" && column.online ? "success" : "neutral"}
                    dot={boot === "live" && column.online}
                  />
                </div>

                {/* Person Cryptographic Identity */}
                <div className="lab-person-id">
                  <span title={personId}>
                    ID: {personId ? `${personId.slice(0, 10)}…${personId.slice(-6)}` : "Initializing…"}
                  </span>
                  <button
                    type="button"
                    className="lab-copy-btn"
                    onClick={() => copyPerson(key)}
                    title="Copy full Person ID hash"
                  >
                    {copiedKey === key ? "✓ Copied" : "📋 Copy"}
                  </button>
                </div>

                {/* Role Badges */}
                <div className="lab-role-tags">
                  <span style={{ fontSize: "0.72rem", color: "var(--amway-muted)", marginRight: "2px" }}>Roles:</span>
                  {view.roles.length > 0 ? (
                    view.roles.map(r => <EkRoleBadge key={r} role={r} />)
                  ) : (
                    <Badge text="None" variant="neutral" />
                  )}
                </div>
              </header>

              {/* Column Body */}
              <div className="lab-column-body">
                {/* Notice / Error banner if any */}
                {column.notice && (
                  <div className="state-denied" style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ userSelect: "text", flex: 1, minWidth: 0 }}>{column.notice}</span>
                    <button
                      type="button"
                      className="lab-copy-btn"
                      title="Copy error text"
                      onClick={() => {
                        const text = column.notice;
                        if (navigator.clipboard?.writeText) {
                          void navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
                        } else {
                          fallbackCopy(text);
                        }
                      }}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      className="lab-copy-btn"
                      onClick={() => dispatch({ kind: "clear_notice", key })}
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Metrics Summary Strip */}
                <div className="lab-metrics-strip">
                  <div className="lab-metric-mini">
                    <span className="lab-metric-mini-val">{view.contacts.length}</span>
                    <span className="lab-metric-mini-lbl">Contacts</span>
                  </div>
                  <div className="lab-metric-mini">
                    <span className="lab-metric-mini-val">{view.offers.length}</span>
                    <span className="lab-metric-mini-lbl">Offers</span>
                  </div>
                  <div className="lab-metric-mini">
                    <span className="lab-metric-mini-val">{purchaseCount}</span>
                    <span className="lab-metric-mini-lbl">{isCustomer ? "Purchases" : "Orders"}</span>
                  </div>
                  <div className="lab-metric-mini">
                    <span className="lab-metric-mini-val">{view.availability ? currentStock : "—"}</span>
                    <span className="lab-metric-mini-lbl">{key === "admin" ? "Avail." : "Stock"}</span>
                  </div>
                </div>

                {/* Role Actions Panel */}
                <div className="lab-actions-section">
                  <div className="lab-section-title">
                    <span>⚡ Quick Actions</span>
                  </div>
                  <div className="lab-action-buttons">
                    <ContactNameField
                      key={view.contacts.find(entry => entry.person === personId)?.name ?? ""}
                      currentName={view.contacts.find(entry => entry.person === personId)?.name ?? ""}
                      role={view.roles[0] ?? ""}
                      disabled={!view.known || view.roles.length === 0 || boot !== "live"}
                      onSave={(name, role) => void run(key, "publishContact", { name, role })}
                    />

                    {key === "admin" && (
                      <>
                        <button
                          type="button"
                          className="btn-accent"
                          disabled={!view.known || boot !== "live"}
                          onClick={() =>
                            void run(key, "assignRole", {
                              subject: lab.current?.persons.manager,
                              role: "manager",
                            })
                          }
                        >
                          Appoint {roleLabel("manager")}
                        </button>
                        <StockUpField
                          disabled={!view.known || boot !== "live"}
                          onSave={(receiptId, quantity) => void run(key, "stockUp", { receiptId, quantity })}
                        />
                      </>
                    )}

                    {key === "manager" && (
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={!staff || boot !== "live"}
                        onClick={() =>
                          void run(key, "assignRole", {
                            subject: lab.current?.persons.seller,
                            role: "seller",
                          })
                        }
                      >
                        Appoint {roleLabel("seller")}
                      </button>
                    )}

                    {key === "seller" && (
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={!seller || boot !== "live"}
                        onClick={() =>
                          void run(key, "assignRole", {
                            subject: lab.current?.persons.customer,
                            role: "customer",
                          })
                        }
                      >
                        Appoint {roleLabel("customer")}
                      </button>
                    )}

                    {key === "seller" && view.offers.map(offer => (
                      <button
                        key={offer.offerId}
                        type="button"
                        className="secondary"
                        disabled={!seller || boot !== "live" || !view.assignments.some(a => a.role === "customer")}
                        onClick={() =>
                          void run(key, "shareOffer", {
                            offerId: offer.offerId,
                            customer: lab.current?.persons.customer,
                          })
                        }
                      >
                        Share {offer.offerId} down
                      </button>
                    ))}

                    {key === "manager" && view.offers.map(offer => (
                      <button
                        key={offer.offerId}
                        type="button"
                        className="secondary"
                        disabled={!staff || boot !== "live" || !view.assignments.some(a => a.role === "seller")}
                        onClick={() =>
                          void run(key, "shareOfferWithSeller", {
                            offerId: offer.offerId,
                            seller: lab.current?.persons.seller,
                          })
                        }
                      >
                        Share {offer.offerId} with {roleLabel("seller")}
                      </button>
                    ))}

                    {(staff || key === "manager") && (
                      <>
                        <button
                          type="button"
                          disabled={!staff || boot !== "live"}
                          onClick={() =>
                            void run(key, "publishOffer", {
                              offerId: `offer-ek-${view.offers.length + 1}`,
                              item: "BMA-WARTUNG@1",
                              priceList: "demo-retail@2026-09",
                              unitAmount: 10000,
                              currency: "EUR",
                            })
                          }
                        >
                          + Offer (100.00€)
                        </button>
                        <button
                          type="button"
                          disabled={!staff || boot !== "live"}
                          onClick={() =>
                            void run(key, "publishOffer", {
                              offerId: `offer-nutrilite-${view.offers.length + 1}`,
                              item: "NUTRILITE-DAILY@1",
                              priceList: "demo-retail@2026-09",
                              unitAmount: 4500,
                              currency: "EUR",
                            })
                          }
                        >
                          + Offer (45.00€)
                        </button>
                      </>
                    )}

                    {key === "customer" && (
                      <button
                        type="button"
                        disabled={!view.roles.includes("customer") || view.offers.length === 0 || boot !== "live" || buying || view.pendingOrders.length > 0}
                        onClick={() => void buy(view.offers[0]?.offerId ?? "")}
                      >
                        {buying || view.pendingOrders.length > 0 ? "Processing purchase…" : `Buy 1x (${view.offers[0]?.offerId ?? "Offer"})`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Admin holds no inventory of its own: network telemetry instead */}
                {key === "admin" ? (
                  <div className="lab-stock-meter">
                    <div className="lab-stock-header">
                      <span>Network telemetry</span>
                      <span>{view.orders.length} orders · {view.assignments.length} members</span>
                    </div>
                    {view.assignments.length === 0 ? (
                      <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
                        No team assignments replicated yet.
                      </div>
                    ) : (
                      view.assignments.map(entry => (
                        <div key={entry.subject} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", padding: "2px 0", gap: "0.5rem" }}>
                          <span>{nameOf(entry.subject)}<br />
                            <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>
                              authorized by {nameOf(entry.issuer)} · since {fmtDate(entry.validFrom)}
                            </span>
                          </span>
                          <EkRoleBadge role={entry.role} />
                        </div>
                      ))
                    )}
                    {[...unitsByCustomer.entries()].map(([customer, agg]) => (
                      <div key={customer} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", padding: "2px 0", gap: "0.5rem" }}>
                        <span>{nameOf(customer)}<br />
                          <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>
                            last {fmtDate(agg.lastAt)} · admitted by {nameOf(agg.seller)}
                          </span>
                        </span>
                        <span>{agg.orders} order{agg.orders === 1 ? "" : "s"} · {agg.units} units</span>
                      </div>
                    ))}
                    {view.availability && (
                      <>
                        <div className="lab-stock-header" style={{ marginTop: "0.4rem" }}>
                          <span>Network availability ({view.availability.lot})</span>
                          <span>{currentStock} / {totalStock} units</span>
                        </div>
                        <div className="lab-stock-bar">
                          <div className="lab-stock-fill" style={{ width: `${stockPct}%` }} />
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  view.availability && (
                    <div className="lab-stock-meter">
                      <div className="lab-stock-header">
                        <span>Facility Stock ({view.availability.lot})</span>
                        <span>
                          {currentStock} / {totalStock} units
                        </span>
                      </div>
                      <div className="lab-stock-bar">
                        <div className="lab-stock-fill" style={{ width: `${stockPct}%` }} />
                      </div>
                    </div>
                  )
                )}

                {/* Tabbed Inspector Navigation */}
                <div className="lab-tab-nav">
                  <button
                    type="button"
                    className={`lab-tab-btn ${activeTab === "overview" ? "active" : ""}`}
                    onClick={() => dispatch({ kind: "tab", key, tab: "overview" })}
                  >
                    All Items
                  </button>
                  <button
                    type="button"
                    className={`lab-tab-btn ${activeTab === "offers" ? "active" : ""}`}
                    onClick={() => dispatch({ kind: "tab", key, tab: "offers" })}
                  >
                    Offers ({view.offers.length})
                  </button>
                  <button
                    type="button"
                    className={`lab-tab-btn ${activeTab === "orders" ? "active" : ""}`}
                    onClick={() => dispatch({ kind: "tab", key, tab: "orders" })}
                  >
                    {isCustomer ? "Purchase history" : "Orders"} ({purchaseCount})
                  </button>
                  <button
                    type="button"
                    className={`lab-tab-btn ${activeTab === "contacts" ? "active" : ""}`}
                    onClick={() => dispatch({ kind: "tab", key, tab: "contacts" })}
                  >
                    Contacts ({view.contacts.length})
                  </button>
                  <button
                    type="button"
                    className={`lab-tab-btn ${activeTab === "activity" ? "active" : ""}`}
                    onClick={() => dispatch({ kind: "tab", key, tab: "activity" })}
                  >
                    CHUM Feed ({column.feedLog.length})
                  </button>
                </div>

                {/* Content View per Tab */}
                {(activeTab === "overview" || activeTab === "offers") && (
                  <div className="lab-section">
                    <div className="lab-section-title">
                      <span>Catalog Offers</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>{view.offers.length} active</span>
                    </div>
                    <div className="lab-items-list">
                      {view.offers.length === 0 ? (
                        <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
                          No offers replicated yet.
                        </div>
                      ) : (
                        view.offers.map(entry => {
                          const isFresh = Boolean(column.fresh[`EkOffer:${entry.offerId}`]);
                          return (
                            <div
                              key={`${entry.offerId}:${column.fresh[`EkOffer:${entry.offerId}`] ?? ""}`}
                              className={`lab-item-card ${isFresh ? "lab-fresh" : ""}`}
                            >
                              <div className="lab-item-main">
                                <span className="lab-item-title">🏷️ {entry.offerId}</span>
                                <span className="lab-item-sub">Item: {entry.item}</span>
                              </div>
                              <Badge
                                text={`${(entry.unitAmount / 100).toFixed(2)} ${entry.currency}`}
                                variant="nutrition"
                              />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {(activeTab === "overview" || activeTab === "orders") && (
                  <section className="lab-section" aria-label={isCustomer ? "Purchase history" : "Orders & Reservations"}>
                    <div className="lab-section-title">
                      <span>{isCustomer ? "Purchase history" : "Orders & Reservations"}</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>
                        {purchaseCount} {isCustomer ? (purchaseCount === 1 ? "purchase" : "purchases") : (purchaseCount === 1 ? "order" : "orders")}
                      </span>
                    </div>
                    <div className="lab-items-list">
                      {orderHistory.length === 0 && view.purchaseFailures.length === 0 ? (
                        <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
                          {isCustomer ? "No purchases yet." : "No orders placed."}
                        </div>
                      ) : (
                        orderHistory.map(entry => {
                          const isFresh = Boolean(column.fresh[`EkOrder:${entry.idempotencyKey}`]);
                          const confirmed = entry.admittedAt > 0;
                          return (
                            <div
                              key={entry.idempotencyKey}
                              data-order-id={entry.idempotencyKey}
                              className={`lab-item-card lab-purchase-card ${isFresh ? "lab-fresh" : ""}`}
                            >
                              <div className="lab-item-main">
                                <span className="lab-item-title">{entry.offer}</span>
                                <span className="lab-item-sub">
                                  Qty: {entry.quantity} · {fmtMoney(entry.quantity * entry.unitAmount, entry.currency)}
                                </span>
                                <span className="lab-item-sub">{entry.idempotencyKey}</span>
                                {confirmed && <span className="lab-item-sub">Confirmed {fmtDate(entry.admittedAt)}</span>}
                              </div>
                              <Badge text={confirmed ? "Confirmed" : "Processing purchase"} variant={confirmed ? "success" : "warning"} />
                            </div>
                          );
                        })
                      )}
                      {view.purchaseFailures.map(failure => (
                        <div key={failure.idempotencyKey} className="state-denied lab-purchase-failure" role="status">
                          <strong>{failure.reason === "out-of-stock" ? "Out of stock" : "Purchase could not be completed"}</strong>
                          <div>{failure.offer} · Qty: {failure.quantity}</div>
                          <div>No purchase was confirmed.</div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {(activeTab === "overview" || activeTab === "orders") && (
                  <div className="lab-section">
                    <div className="lab-section-title">
                      <span>Balances</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>{view.balances.length} parties</span>
                    </div>
                    <div className="lab-items-list">
                      {view.balances.length === 0 ? (
                        <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
                          No receivables or payables yet.
                        </div>
                      ) : (
                        view.balances.map(entry => (
                          <div key={`${entry.party}:${entry.currency}`} className="lab-item-card">
                            <div className="lab-item-main">
                              <span className="lab-item-title">{nameOf(entry.party)}</span>
                              <span className="lab-item-sub">
                                Receivable {fmtMoney(entry.receivable, entry.currency)} · Payable {fmtMoney(entry.payable, entry.currency)}
                              </span>
                            </div>
                            <EkRoleBadge role={entry.role} />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {(activeTab === "overview" || activeTab === "contacts") && (
                  <div className="lab-section">
                    <div className="lab-section-title">
                      <span>Directory Contacts</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>{view.contacts.length} verified</span>
                    </div>
                    <div className="lab-items-list">
                      {view.contacts.length === 0 ? (
                        <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
                          No directory contacts.
                        </div>
                      ) : (
                        view.contacts.map(entry => {
                          const isFresh = Boolean(column.fresh[`EkContact:${entry.person}`]);
                          const chatting = column.chatPeer === entry.person;
                          const peerName = entry.name || `${entry.person.slice(0, 10)}…`;
                          const unread = column.chatUnread[entry.person] ?? 0;
                          return (
                            <div key={`${entry.person}:${column.fresh[`EkContact:${entry.person}`] ?? ""}`}>
                              <div
                                className={`lab-item-card ${isFresh ? "lab-fresh" : ""}`}
                                role="button"
                                tabIndex={0}
                                title="Open chat"
                                aria-label={`Chat with ${peerName}`}
                                style={{ cursor: "pointer" }}
                                onClick={() => dispatch({ kind: "chat", key, peer: chatting ? null : entry.person })}
                                onKeyDown={event => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    dispatch({ kind: "chat", key, peer: chatting ? null : entry.person });
                                  }
                                }}
                              >
                                <div className="lab-item-main">
                                  <span className="lab-item-title">{entry.name}</span>
                                  <span className="lab-item-sub">
                                    {entry.person.slice(0, 10)}…{entry.person.slice(-4)}
                                  </span>
                                </div>
                                <EkRoleBadge role={entry.role} />
                                {entry.person !== personId && (
                                  <button
                                    type="button"
                                    className="lab-copy-btn lab-chat-icon"
                                    title="Open chat"
                                    aria-label={`Open chat with ${peerName}`}
                                    onClick={event => {
                                      event.stopPropagation();
                                      dispatch({ kind: "chat", key, peer: chatting ? null : entry.person });
                                    }}
                                  >
                                    💬
                                    {unread > 0 && (
                                      <span className="lab-chat-badge" aria-label={`${unread} unread`}>
                                        {unread > 9 ? "9+" : unread}
                                      </span>
                                    )}
                                  </button>
                                )}
                              </div>
                              {chatting && (
                                <ChatPanel
                                  client={lab.current?.clients[key]}
                                  me={personId}
                                  peer={entry.person}
                                  peerName={peerName}
                                  onClose={() => dispatch({ kind: "chat", key, peer: null })}
                                />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Real-Time CHUM Activity Feed */}
                {activeTab === "activity" && (
                  <div className="lab-section">
                    <div className="lab-section-title">
                      <span>CHUM Ingress Stream</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>Last {column.feedLog.length} events</span>
                    </div>
                    <div className="lab-feed-list">
                      {column.feedLog.length === 0 ? (
                        <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
                          No CHUM events recorded yet.
                        </div>
                      ) : (
                        column.feedLog.map((item, idx) => (
                          <div key={`${item.hash}-${idx}`} className={`lab-feed-item lab-feed-${item.type}`}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                              <span style={{ fontWeight: 600 }}>{item.label}</span>
                              <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>
                                #{item.hash.slice(0, 12)}…
                              </span>
                            </div>
                            <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>{item.at}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Access Control & Rejection Audit */}
                {view.rejected.length > 0 && (
                  <details style={{ marginTop: "0.25rem" }}>
                    <summary style={{ fontSize: "0.75rem", color: "var(--amway-danger)", cursor: "pointer", fontWeight: 600 }}>
                      ⚠️ {view.rejected.length} Access Denials / Ingress Rejections
                    </summary>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.5rem" }}>
                      {view.rejected.map(rej => (
                        <div
                          key={`${rej.type}:${rej.id}`}
                          className="state-denied"
                          style={{ padding: "0.4rem 0.6rem", fontSize: "0.72rem" }}
                        >
                          <strong>{rej.type}</strong> ({rej.id}): {rej.reason}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

              </div>
            </section>
            <LabDeviceInvite
              client={boot === "live" ? lab.current?.clients[key] : undefined}
              plan="ekLab"
              deviceKey={meta.title}
            />
            </div>
          );
        })}
      </div>
    </div>
  );
}
