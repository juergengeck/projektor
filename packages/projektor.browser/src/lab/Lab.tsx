// packages/projektor.browser/src/lab/Lab.tsx
import { useEffect, useReducer, useRef, useState } from "react";
import { bootLab, LAB_KEYS, type LabHandle, type LabKey } from "./transport";
import { Badge, RoleBadge, StatusBadge } from "../components/ui";

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
}

export interface View {
  known: boolean;
  roles: string[];
  contacts: Contact[];
  offers: Offer[];
  orders: Order[];
  availability: { lot: string; facility: string; gross: number; available: number } | null;
  rejected: { type: string; id: string; reason: string }[];
}

export interface FeedRow {
  type: string;
  kind: string;
  id: string;
  hash: string;
  obj: Record<string, unknown>;
}

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
    return { ...state, [action.key]: { ...column, view: action.view, notice: "" } };
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
        online: true,
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
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const lab = useRef<LabHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    const offs: (() => void)[] = [];

    bootLab()
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
            <span className={onlineCount === 4 ? "lab-pulse-online" : "lab-pulse-paused"} />
            <span>Mesh: {onlineCount}/4 Nodes Online</span>
          </div>

          <button
            type="button"
            className="secondary sm"
            disabled={boot !== "live"}
            onClick={() => void toggleAll(!allOnline)}
          >
            {allOnline ? "❚❚ Pause Entire Mesh" : "● Resume Entire Mesh"}
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
              <span className="lab-pulse-online" /> Booting isolated Web Workers and establishing CHUM connections…
            </p>
          ) : (
            <p style={{ margin: 0, fontWeight: 600 }}>Boot Failure: {boot}</p>
          )}
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

          const totalStock = view.availability?.gross ?? 10;
          const currentStock = view.availability?.available ?? totalStock;
          const stockPct = Math.max(0, Math.min(100, (currentStock / totalStock) * 100));

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
                    {column.online ? (
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
                    <span className="lab-metric-mini-lbl">Stock</span>
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
                </div>

                {/* Stock Level Bar */}
                {view.availability && (
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
