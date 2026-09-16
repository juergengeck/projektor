// packages/projektor.browser/src/lab/Lab.tsx
import { useEffect, useReducer, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { bootJoinInstance, bootLab, LAB_KEYS, type FeedRow, type LabHandle, type LabKey } from "./transport";
import { Badge, RoleBadge, StatusBadge } from "../components/ui";

/** Best-effort role resolution for a pasted invite; the worker validates strictly on accept. */
function roleKeyFromInvite(invitationUrl: string): LabKey | null {
  try {
    const email = new URL(invitationUrl.trim()).searchParams.get("fe") ?? "";
    const prefix = email.split("@")[0];
    return (LAB_KEYS as readonly string[]).includes(prefix) ? (prefix as LabKey) : null;
  } catch {
    return null;
  }
}

function defaultRelayUrl(): string {
  const secure = window.location.protocol === "https:";
  return `${secure ? "wss:" : "ws:"}//${window.location.host}/lab/relay`;
}

const TITLES: Record<LabKey, { title: string; subtitle: string; icon: string; roleType: string }> = {
  admin: { title: "Org Admin", subtitle: "Root Authority & Scope Governance", icon: "🏛️", roleType: "admin" },
  manager: { title: "Manager", subtitle: "Catalog, Offers & Team Management", icon: "🏢", roleType: "manager" },
  seller: { title: "Seller", subtitle: "Sales & Order Admission", icon: "💼", roleType: "seller" },
  customer: { title: "Customer", subtitle: "Client Account & Direct Purchase", icon: "👤", roleType: "customer" },
};

const DEPARTMENT = "demo-de";

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
  admittedAt: number;
}

export interface View {
  known: boolean;
  roles: string[];
  assignments: { subject: string; role: string; issuer: string; validFrom: number }[];
  contacts: Contact[];
  offers: Offer[];
  orders: Order[];
  availability: { lot: string; facility: string; gross: number; available: number } | null;
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

export interface Column {
  online: boolean;
  view: View;
  fresh: Record<string, string>;
  notice: string;
  tab: TabKey;
  feedLog: FeedEntry[];
}

type State = Record<LabKey, Column>;

type Action =
  | { kind: "snapshot"; key: LabKey; view: View }
  | { kind: "feed"; key: LabKey; row: FeedRow }
  | { kind: "online"; key: LabKey; online: boolean }
  | { kind: "tab"; key: LabKey; tab: TabKey }
  | { kind: "notice"; key: LabKey; notice: string }
  | { kind: "clear_notice"; key: LabKey };

const EMPTY_VIEW: View = {
  known: false,
  roles: [],
  assignments: [],
  contacts: [],
  offers: [],
  orders: [],
  availability: null,
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
  if (row.type === "AmwayOffer") {
    const obj = row.obj as Record<string, unknown>;
    const amt = typeof obj.unitAmount === "number" ? (obj.unitAmount / 100).toFixed(2) : "";
    return `Offer ${row.id} (${amt} ${obj.currency || "EUR"})`;
  }
  if (row.type === "AmwayOrder") {
    const obj = row.obj as Record<string, unknown>;
    return `Order ${row.id} (${obj.offer} ×${obj.quantity})`;
  }
  if (row.type === "AmwayContact") {
    const obj = row.obj as Record<string, unknown>;
    return `Contact ${obj.name || row.id} (${obj.role})`;
  }
  if (row.type === "AmwayRoleAssignment") {
    const obj = row.obj as Record<string, unknown>;
    return `Role ${(obj.subject as string)?.slice(0, 8)}… → ${obj.role}`;
  }
  if (row.type === "AmwayDepartment") {
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

  if (row.type === "AmwayOffer") {
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

  if (row.type === "AmwayContact") {
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

  if (row.type === "AmwayOrder") {
    const order = row.obj as unknown as Order;
    const orders = upsert(view.orders, order, e => e.idempotencyKey === order.idempotencyKey);
    const availability = view.availability
      ? { ...view.availability, available: Math.max(0, view.availability.gross - orders.reduce((sum, e) => sum + e.quantity, 0)) }
      : null;
    return {
      ...state,
      [action.key]: {
        ...column,
        fresh,
        feedLog,
        view: { ...view, orders, availability },
      },
    };
  }

  return { ...state, [action.key]: { ...column, fresh, feedLog } };
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
      },
    ]),
  ) as unknown as State;
}

export default function Lab() {
  const [state, dispatch] = useReducer(reduce, undefined, initial);
  const [boot, setBoot] = useState<"booting" | "live" | string>("booting");
  const [bootStage, setBootStage] = useState("spawning workers");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const lab = useRef<LabHandle | null>(null);
  const [relayUrl, setRelayUrl] = useState<string>(() => defaultRelayUrl());
  const [iomInvites, setIomInvites] = useState<Record<string, { url: string; status: string }>>({});
  const [joinUrl, setJoinUrl] = useState("");
  const [joinStatus, setJoinStatus] = useState("");
  const joinHandle = useRef<LabHandle | null>(null);
  const [joined, setJoined] = useState<null | {
    key: LabKey;
    person: string;
    view: View;
    feed: FeedEntry[];
  }>(null);

  useEffect(() => {
    let cancelled = false;
    const offs: (() => void)[] = [];

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
              view: await client.call("amwayLab", "getDepartment", { department: DEPARTMENT }),
            });

          offs.push(
            client.onFeed((row: FeedRow) => {
              dispatch({ kind: "feed", key, row });
              if (row.type === "AmwayRoleAssignment" || row.type === "AmwayDepartment") {
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

  async function run(key: LabKey, method: string, params: Record<string, unknown>) {
    const handle = lab.current;
    if (!handle) return;
    try {
      await handle.clients[key].call("amwayLab", method, { department: DEPARTMENT, ...params });
    } catch (error) {
      dispatch({ kind: "notice", key, notice: error instanceof Error ? error.message : String(error) });
    }
  }

  async function toggleNode(key: LabKey) {
    const handle = lab.current;
    if (!handle) return;
    const online = !state[key].online;
    handle.setSwitch(key, online);
    await handle.clients[key].call("amwayLab", "setOnline", { online });
    dispatch({ kind: "online", key, online });
    if (online) {
      dispatch({
        kind: "snapshot",
        key,
        view: await handle.clients[key].call("amwayLab", "getDepartment", { department: DEPARTMENT }),
      });
    }
  }

  async function toggleAll(online: boolean) {
    const handle = lab.current;
    if (!handle) return;
    for (const key of LAB_KEYS) {
      if (state[key].online !== online) {
        handle.setSwitch(key, online);
        await handle.clients[key].call("amwayLab", "setOnline", { online });
        dispatch({ kind: "online", key, online });
        if (online) {
          dispatch({
            kind: "snapshot",
            key,
            view: await handle.clients[key].call("amwayLab", "getDepartment", { department: DEPARTMENT }),
          });
        }
      }
    }
  }

  function copyPerson(key: LabKey) {
    const person = lab.current?.persons[key];
    if (!person) return;
    void navigator.clipboard?.writeText(person);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  }

  function inviteNotice(key: LabKey, url: string, status: string) {
    setIomInvites(current => {
      const entry = current[key];
      if (url && entry && entry.url !== url) return current;
      return { ...current, [key]: { url, status } };
    });
  }

  /** Create a same-person pairing invitation for this column's device lane. */
  async function inviteDevice(key: LabKey) {
    const handle = lab.current;
    if (!handle || boot !== "live") return;
    setIomInvites(current => ({ ...current, [key]: { url: "", status: "creating invitation…" } }));
    try {
      const result = await handle.clients[key].call("amwayLab", "createIoMInvite", {
        relayUrl: relayUrl.trim(),
      }) as { invitationUrl: string; token: string };
      setIomInvites(current => ({ ...current, [key]: { url: result.invitationUrl, status: "waiting for device…" } }));
      // The room stays hosted; this only observes the pairing outcome.
      void handle.clients[key].call("amwayLab", "awaitIoMInvite", { token: result.token, timeoutMs: 600_000 })
        .then(() => inviteNotice(key, result.invitationUrl, "device paired ✓"))
        .catch(error => inviteNotice(
          key,
          result.invitationUrl,
          `pairing failed: ${error instanceof Error ? error.message : String(error)}`,
        ));
    } catch (error) {
      setIomInvites(current => ({
        ...current,
        [key]: { url: "", status: `invite failed: ${error instanceof Error ? error.message : String(error)}` },
      }));
    }
  }

  /** Join this lane as a second device of the invited person. */
  async function joinWithInvite() {
    const key = roleKeyFromInvite(joinUrl);
    if (!key) {
      setJoinStatus("That URL is not a lab device invitation.");
      return;
    }
    if (joinHandle.current) {
      setJoinStatus("A joined device is already active; leave it first.");
      return;
    }
    setJoinStatus("booting device…");
    setJoined(null);
    try {
      const handle = await bootJoinInstance(key);
      joinHandle.current = handle;
      const client = handle.clients[key];
      // A freshly paired instance answers { known: false } without projection
      // fields until the department replicates; keep the empty view instead
      // of storing a shapeless answer that crashes role rendering.
      const snapshotJoined = async () => {
        const raw = await client.call("amwayLab", "getDepartment", { department: DEPARTMENT }) as View;
        const view = raw.known ? raw : { ...EMPTY_VIEW };
        setJoined(current => current ? { ...current, view } : current);
      };
      client.onFeed((row: FeedRow) => {
        const entry: FeedEntry = {
          at: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          type: row.type,
          id: row.id,
          hash: row.hash,
          label: formatFeedLabel(row),
        };
        setJoined(current => current ? { ...current, feed: [entry, ...current.feed].slice(0, 30) } : current);
        if (row.type === "AmwayRoleAssignment" || row.type === "AmwayDepartment") {
          void snapshotJoined().catch(() => {});
        }
      });
      const accepted = await client.call("amwayLab", "acceptIoMInvite", {
        invitationUrl: joinUrl.trim(),
      }) as { person: string };
      setJoined({ key, person: accepted.person, view: { ...EMPTY_VIEW }, feed: [] });
      await snapshotJoined().catch(() => {});
      setJoinStatus("");
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
  }

  const allOnline = LAB_KEYS.every(k => state[k].online);
  const onlineCount = LAB_KEYS.filter(k => state[k].online).length;

  return (
    <div className="lab-container">
      {/* Top Navigation & Mesh Status Header */}
      <header className="lab-header">
        <div className="lab-title-group">
          <h1>
            <span>🌐</span> Amway lab
          </h1>
          <p className="lab-subtitle">
            Four independent Web Workers running isolated ONE instances · Pure CHUM peer-to-peer sync · Host switches MessagePorts only
          </p>
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

          <button
            type="button"
            className="secondary sm"
            disabled={boot !== "live"}
            onClick={() => void toggleAll(!allOnline)}
          >
            {boot === "booting"
              ? "Starting…"
              : boot === "live"
                ? (allOnline ? "❚❚ Pause Entire Mesh" : "● Resume Entire Mesh")
                : "Unavailable"}
          </button>

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

      {/* Device pairing: second device joins as the same person (IoM) */}
      <details className="card" style={{ marginBottom: "1.25rem", fontSize: "0.8rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>Device pairing</summary>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <span style={{ color: "var(--amway-muted)" }}>Rendezvous</span>
            <input
              value={relayUrl}
              onChange={event => setRelayUrl(event.target.value)}
              aria-label="Pairing rendezvous URL"
              style={{ flex: 1, minWidth: 0, fontSize: "0.72rem" }}
            />
          </label>
          <label style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <span style={{ color: "var(--amway-muted)" }}>Invitation</span>
            <input
              value={joinUrl}
              onChange={event => setJoinUrl(event.target.value)}
              placeholder="Paste a device invitation URL"
              aria-label="Device invitation URL to join with"
              style={{ flex: 1, minWidth: 0, fontSize: "0.72rem" }}
            />
            <button type="button" className="secondary sm" onClick={() => void joinWithInvite()}>
              Join
            </button>
          </label>
          {joinStatus && <div style={{ color: "var(--amway-muted)" }}>{joinStatus}</div>}
          {joined && (
            <div className="lab-column" style={{ marginTop: "0.25rem" }}>
              <header className="lab-column-header">
                <div className="lab-role-title">
                  <span>{TITLES[joined.key].icon}</span>
                  <span>{TITLES[joined.key].title} · second device</span>
                </div>
                <button type="button" className="secondary sm" onClick={() => void leaveJoined()}>
                  Leave
                </button>
              </header>
              <div style={{ fontSize: "0.72rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                  <span style={{ color: "var(--amway-muted)" }}>ID:</span>
                  <span>{joined.person.slice(0, 10)}…{joined.person.slice(-4)}</span>
                  <button
                    type="button"
                    className="secondary sm"
                    onClick={() => void navigator.clipboard?.writeText(joined.person)}
                  >
                    Copy
                  </button>
                </div>
                <div>
                  <span style={{ color: "var(--amway-muted)" }}>Roles: </span>
                  {joined.view.roles.length > 0
                    ? joined.view.roles.map(role => <RoleBadge key={role} role={role} />)
                    : "none yet — the department has not replicated"}
                </div>
                <div style={{ color: "var(--amway-muted)" }}>
                  {joined.view.contacts.length} contacts · {joined.view.offers.length} offers ·{" "}
                  {joined.view.orders.length} orders ·{" "}
                  {joined.view.availability ? `${joined.view.availability.available} units` : "no stock projection"}
                </div>
                {joined.feed.length > 0 && (
                  <div className="lab-feed-list">
                    {joined.feed.map((item, index) => (
                      <div key={`${item.hash}-${index}`} className={`lab-feed-item lab-feed-${item.type}`}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                          <span style={{ fontWeight: 600 }}>{item.label}</span>
                          <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>
                            #{item.hash.slice(0, 12)}…
                          </span>
                        </div>
                        <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>{item.at}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </details>

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

          const totalStock = view.availability?.gross ?? 10;
          const currentStock = view.availability?.available ?? totalStock;
          const stockPct = Math.max(0, Math.min(100, (currentStock / totalStock) * 100));
          const nameOf = (person: string) =>
            view.contacts.find(entry => entry.person === person)?.name
            ?? `${person.slice(0, 10)}…`;
          const fmtDate = (at: number) =>
            new Date(at).toLocaleString([], {
              month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit", hour12: false,
            });
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
            <section
              key={key}
              aria-label={meta.title}
              className={`lab-column lab-role-${meta.roleType} ${column.online ? "" : "lab-paused"}`}
            >
              {/* Column Header */}
              <header className="lab-column-header">
                <div className="lab-column-title-row">
                  <div className="lab-role-title">
                    <span>{meta.icon}</span>
                    <span>{meta.title}</span>
                  </div>
                  <button
                    type="button"
                    className="secondary sm"
                    onClick={() => void toggleNode(key)}
                    disabled={boot !== "live"}
                    style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem" }}
                  >
                    {boot === "booting" ? (
                      <>Starting…</>
                    ) : column.online ? (
                      <>
                        <span className="lab-pulse-online" /> Pause
                      </>
                    ) : (
                      <>
                        <span className="lab-pulse-paused" /> Resume
                      </>
                    )}
                  </button>
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
                    view.roles.map(r => <RoleBadge key={r} role={r} />)
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
                    <span className="lab-metric-mini-val">{view.orders.length}</span>
                    <span className="lab-metric-mini-lbl">Orders</span>
                  </div>
                  <div className="lab-metric-mini">
                    <span className="lab-metric-mini-val">{currentStock}</span>
                    <span className="lab-metric-mini-lbl">{key === "admin" ? "Avail." : "Stock"}</span>
                  </div>
                </div>

                {/* Role Actions Panel */}
                <div className="lab-actions-section">
                  <div className="lab-section-title">
                    <span>⚡ Quick Actions</span>
                  </div>
                  <div className="lab-action-buttons">
                    <button
                      type="button"
                      className="secondary"
                      disabled={!view.known || boot !== "live"}
                      onClick={() =>
                        void run(key, "publishContact", {
                          name: `${meta.title} Contact`,
                          role: view.roles[0] ?? "customer",
                        })
                      }
                    >
                      Publish Contact
                    </button>

                    {key === "admin" && (
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
                        Appoint Manager
                      </button>
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
                        Appoint Seller
                      </button>
                    )}

                    {key === "manager" && (
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={!staff || boot !== "live"}
                        onClick={() =>
                          void run(key, "assignRole", {
                            subject: lab.current?.persons.customer,
                            role: "customer",
                          })
                        }
                      >
                        Appoint Customer
                      </button>
                    )}

                    <button
                      type="button"
                      className="secondary"
                      disabled={boot !== "live"}
                      onClick={() => void inviteDevice(key)}
                    >
                      Invite device
                    </button>

                    {(staff || key === "manager") && (
                      <>
                        <button
                          type="button"
                          disabled={!staff || boot !== "live"}
                          onClick={() =>
                            void run(key, "publishOffer", {
                              offerId: `offer-glister-${view.offers.length + 1}`,
                              item: "GLISTER-100@1",
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

                    {seller && key === "seller" && (
                      <button
                        type="button"
                        disabled={!seller || view.offers.length === 0 || boot !== "live"}
                        onClick={() =>
                          void run(key, "admitOrder", {
                            customer: lab.current?.persons.customer,
                            offer: view.offers[0]?.offerId ?? "demo-offer",
                            quantity: 2,
                          })
                        }
                      >
                        Admit Order ×2
                      </button>
                    )}

                    {key === "customer" && (
                      <button
                        type="button"
                        disabled={view.offers.length === 0 || boot !== "live"}
                        onClick={() =>
                          void run(key, "admitOrder", {
                            customer: lab.current?.persons.customer,
                            offer: view.offers[0]?.offerId ?? "demo-offer",
                            quantity: 1,
                          })
                        }
                      >
                        Buy 1x ({view.offers[0]?.offerId ?? "Offer"})
                      </button>
                    )}
                  </div>
                  {iomInvites[key] && (iomInvites[key].url || iomInvites[key].status) && (
                    <div style={{ marginTop: "0.5rem", fontSize: "0.72rem" }}>
                      {iomInvites[key].url && (
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                          <input
                            readOnly
                            value={iomInvites[key].url}
                            aria-label="Device invitation URL"
                            style={{ flex: 1, minWidth: 0, fontSize: "0.68rem" }}
                            onFocus={event => event.target.select()}
                          />
                          <button
                            type="button"
                            className="secondary sm"
                            onClick={() => void navigator.clipboard?.writeText(iomInvites[key].url)}
                          >
                            Copy
                          </button>
                        </div>
                      )}
                      {iomInvites[key].url && (
                        <div style={{ display: "flex", justifyContent: "center", marginTop: "0.4rem" }}>
                          <QRCodeSVG
                            value={iomInvites[key].url}
                            size={112}
                            role="img"
                            aria-label={`Device invitation QR for ${key}`}
                          />
                        </div>
                      )}
                      <div style={{ color: "var(--amway-muted)", marginTop: "0.2rem" }}>{iomInvites[key].status}</div>
                    </div>
                  )}
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
                          <RoleBadge role={entry.role} />
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
                    Orders ({view.orders.length})
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
                          const isFresh = Boolean(column.fresh[`AmwayOffer:${entry.offerId}`]);
                          return (
                            <div
                              key={`${entry.offerId}:${column.fresh[`AmwayOffer:${entry.offerId}`] ?? ""}`}
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
                  <div className="lab-section">
                    <div className="lab-section-title">
                      <span>Orders & Reservations</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>{view.orders.length} orders</span>
                    </div>
                    <div className="lab-items-list">
                      {view.orders.length === 0 ? (
                        <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
                          No orders placed.
                        </div>
                      ) : (
                        view.orders.map(entry => {
                          const isFresh = Boolean(column.fresh[`AmwayOrder:${entry.idempotencyKey}`]);
                          return (
                            <div
                              key={`${entry.idempotencyKey}:${column.fresh[`AmwayOrder:${entry.idempotencyKey}`] ?? ""}`}
                              className={`lab-item-card ${isFresh ? "lab-fresh" : ""}`}
                            >
                              <div className="lab-item-main">
                                <span className="lab-item-title">📦 {entry.idempotencyKey}</span>
                                <span className="lab-item-sub">
                                  {entry.offer} · Qty: {entry.quantity}
                                </span>
                              </div>
                              <StatusBadge status="accepted" />
                            </div>
                          );
                        })
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
                          const isFresh = Boolean(column.fresh[`AmwayContact:${entry.person}`]);
                          return (
                            <div
                              key={`${entry.person}:${column.fresh[`AmwayContact:${entry.person}`] ?? ""}`}
                              className={`lab-item-card ${isFresh ? "lab-fresh" : ""}`}
                            >
                              <div className="lab-item-main">
                                <span className="lab-item-title">{entry.name}</span>
                                <span className="lab-item-sub">
                                  {entry.person.slice(0, 10)}…{entry.person.slice(-4)}
                                </span>
                              </div>
                              <RoleBadge role={entry.role} />
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
          );
        })}
      </div>
    </div>
  );
}
