// packages/projektor.browser/src/lab/Lab.tsx
import { useEffect, useReducer, useRef, useState } from "react";
import { bootLab, LAB_KEYS, type LabHandle, type LabKey } from "./transport";

const TITLES: Record<LabKey, string> = { admin: "Org admin", manager: "Manager", seller: "Seller", customer: "Customer" };
const DEPARTMENT = "demo-de";

interface Offer { offerId: string; item: string; unitAmount: number; currency: string; publishedBy: string }
interface Contact { person: string; name: string; role: string; publishedBy: string }
interface Order { idempotencyKey: string; customer: string; seller: string; offer: string; quantity: number }
interface View {
  known: boolean; roles: string[]; contacts: Contact[]; offers: Offer[]; orders: Order[];
  availability: { lot: string; facility: string; gross: number; available: number } | null;
  rejected: { type: string; id: string; reason: string }[];
}
interface FeedRow { type: string; kind: string; id: string; hash: string; obj: Record<string, unknown> }

interface Column { online: boolean; view: View; fresh: Record<string, string>; notice: string }
type State = Record<LabKey, Column>;
type Action =
  | { kind: "snapshot"; key: LabKey; view: View }
  | { kind: "feed"; key: LabKey; row: FeedRow }
  | { kind: "online"; key: LabKey; online: boolean }
  | { kind: "notice"; key: LabKey; notice: string };

const EMPTY: View = { known: false, roles: [], contacts: [], offers: [], orders: [], availability: null, rejected: [] };

function upsert<T>(list: T[], item: T, same: (entry: T) => boolean): T[] {
  const index = list.findIndex(same);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function reduce(state: State, action: Action): State {
  const column = state[action.key];
  if (action.kind === "snapshot") return { ...state, [action.key]: { ...column, view: action.view, notice: "" } };
  if (action.kind === "online") return { ...state, [action.key]: { ...column, online: action.online } };
  if (action.kind === "notice") return { ...state, [action.key]: { ...column, notice: action.notice } };
  const { row } = action;
  const view = column.view;
  const fresh = { ...column.fresh, [`${row.type}:${row.id}`]: row.hash };
  if (row.type === "AmwayOffer") {
    const offer = row.obj as unknown as Offer;
    return { ...state, [action.key]: { ...column, fresh, view: { ...view, offers: upsert(view.offers, offer, entry => entry.offerId === offer.offerId) } } };
  }
  if (row.type === "AmwayContact") {
    const contact = row.obj as unknown as Contact;
    return { ...state, [action.key]: { ...column, fresh, view: { ...view, contacts: upsert(view.contacts, contact, entry => entry.person === contact.person) } } };
  }
  if (row.type === "AmwayOrder") {
    const order = row.obj as unknown as Order;
    const orders = upsert(view.orders, order, entry => entry.idempotencyKey === order.idempotencyKey);
    const availability = view.availability
      ? { ...view.availability, available: view.availability.gross - orders.reduce((sum, entry) => sum + entry.quantity, 0) }
      : null;
    return { ...state, [action.key]: { ...column, fresh, view: { ...view, orders, availability } } };
  }
  return { ...state, [action.key]: { ...column, fresh } };
}

function initial(): State {
  return Object.fromEntries(LAB_KEYS.map(key => [key, { online: true, view: EMPTY, fresh: {}, notice: "" }])) as State;
}

export default function Lab() {
  const [state, dispatch] = useReducer(reduce, undefined, initial);
  const [boot, setBoot] = useState<"booting" | "live" | string>("booting");
  const lab = useRef<LabHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    const offs: (() => void)[] = [];
    bootLab().then(async handle => {
      if (cancelled) { await handle.stop(); return; }
      lab.current = handle;
      for (const key of LAB_KEYS) {
        const client = handle.clients[key];
        const snapshot = async () => dispatch({ kind: "snapshot", key, view: await client.call("amwayLab", "getDepartment", { department: DEPARTMENT }) });
        offs.push(client.onFeed((row: FeedRow) => {
          dispatch({ kind: "feed", key, row });
          if (row.type === "AmwayRoleAssignment" || row.type === "AmwayDepartment") {
            snapshot().catch(error => dispatch({ kind: "notice", key, notice: error.message }));
          }
        }));
        await snapshot();
      }
      setBoot("live");
    }).catch(error => setBoot(error instanceof Error ? error.message : String(error)));
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

  async function toggle(key: LabKey) {
    const handle = lab.current;
    if (!handle) return;
    const online = !state[key].online;
    handle.setSwitch(key, online);
    await handle.clients[key].call("amwayLab", "setOnline", { online });
    dispatch({ kind: "online", key, online });
    if (online) dispatch({ kind: "snapshot", key, view: await handle.clients[key].call("amwayLab", "getDepartment", { department: DEPARTMENT }) });
  }

  return (
    <div style={{ padding: "0 16px 16px" }}>
      <style>{"@keyframes lab-arrive { from { background: #fff3bf } to { background: transparent } } .lab-fresh { animation: lab-arrive 2.4s ease-out }"}</style>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap", margin: "12px 0" }}>
        <h1 style={{ margin: 0 }}>Amway Lab</h1>
        <span style={{ opacity: 0.75 }}>four workers · one ONE instance each · CHUM between workers · host switches ports only</span>
        <a href="#/overview" style={{ marginLeft: "auto" }}>← single-instance UI</a>
      </div>
      {boot !== "live" ? <p className={boot === "booting" ? undefined : "state-denied"}>{boot === "booting" ? "Booting workers and pairing…" : boot}</p> : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        {LAB_KEYS.map(key => {
          const column = state[key];
          const { view } = column;
          const staff = view.roles.includes("admin") || view.roles.includes("manager");
          const seller = staff || view.roles.includes("seller");
          return (
            <section key={key} aria-label={TITLES[key]} style={{ border: "1px solid #ccc", borderRadius: 8, overflow: "hidden" }}>
              <header style={{ background: "#f4f4f4", padding: "8px 10px", borderBottom: "1px solid #ccc" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>{TITLES[key]}</strong>
                  <button type="button" className="secondary sm" onClick={() => void toggle(key)} disabled={boot !== "live"}>
                    {column.online ? "● online · pause" : "❚❚ paused · resume"}
                  </button>
                </div>
                <div className="code-cell" style={{ fontSize: 11, wordBreak: "break-all" }}>{lab.current?.persons[key] ?? "—"}</div>
                <div style={{ fontSize: 12 }}>roles: {view.roles.join(", ") || "—"}</div>
              </header>
              <div style={{ padding: "8px 10px" }}>
                {column.notice ? <p className="state-denied">{column.notice}</p> : null}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <button type="button" disabled={!view.known} onClick={() => void run(key, "publishContact", { name: `${TITLES[key]} Kontakt`, role: view.roles[0] ?? "customer" })}>Publish contact</button>
                  <button type="button" disabled={!staff} onClick={() => void run(key, "publishOffer", { offerId: `lab-offer-${key}-${view.offers.length + 1}`, item: "GLISTER-100@1", priceList: "demo-retail@2026-09", unitAmount: 10000, currency: "EUR" })}>Publish offer</button>
                  <button type="button" disabled={!seller || view.offers.length === 0} onClick={() => void run(key, "admitOrder", { customer: lab.current?.persons.customer, offer: view.offers[0]?.offerId, quantity: 2 })}>Admit order ×2</button>
                </div>
                <h4 style={{ margin: "8px 0 4px" }}>Contacts ({view.contacts.length})</h4>
                {view.contacts.map(entry => (
                  <div key={`${entry.person}:${column.fresh[`AmwayContact:${entry.person}`] ?? ""}`} className={column.fresh[`AmwayContact:${entry.person}`] ? "lab-fresh" : undefined} style={{ fontSize: 13 }}>
                    <strong>{entry.name}</strong> · {entry.role}
                  </div>
                ))}
                <h4 style={{ margin: "8px 0 4px" }}>Offers ({view.offers.length})</h4>
                {view.offers.map(entry => (
                  <div key={`${entry.offerId}:${column.fresh[`AmwayOffer:${entry.offerId}`] ?? ""}`} className={column.fresh[`AmwayOffer:${entry.offerId}`] ? "lab-fresh" : undefined} style={{ fontSize: 13 }}>
                    <strong>{entry.offerId}</strong> · {(entry.unitAmount / 100).toFixed(2)} {entry.currency}
                  </div>
                ))}
                <h4 style={{ margin: "8px 0 4px" }}>Orders ({view.orders.length})</h4>
                {view.orders.map(entry => (
                  <div key={`${entry.idempotencyKey}:${column.fresh[`AmwayOrder:${entry.idempotencyKey}`] ?? ""}`} className={column.fresh[`AmwayOrder:${entry.idempotencyKey}`] ? "lab-fresh" : undefined} style={{ fontSize: 13 }}>
                    <strong>{entry.idempotencyKey}</strong> · {entry.offer} ×{entry.quantity}
                  </div>
                ))}
                {view.availability ? <p style={{ fontSize: 13 }}>{view.availability.available} of {view.availability.gross} available · {view.availability.lot}</p> : null}
                {view.rejected.length > 0 ? (
                  <details><summary>{view.rejected.length} rejected</summary>
                    {view.rejected.map(entry => <div key={`${entry.type}:${entry.id}`} className="code-cell" style={{ fontSize: 11 }}>{entry.type} {entry.id}: {entry.reason}</div>)}
                  </details>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
