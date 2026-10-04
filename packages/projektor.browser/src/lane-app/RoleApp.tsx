// packages/projektor.browser/src/lane-app/RoleApp.tsx
/**
 * One role's lane app: boots its own ONE instance lazily (the host drives
 * `session.*` through the registry), renders the role screens with live
 * data, and runs every lab/chat operation through the registry facade.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LabBrand } from "@projektor/lab.core/brand.ts";
import type { LaneUiState } from "@projektor/lab.core/session-plan.ts";
import type { FeedRow } from "@projektor/lab.core/port-ipc.ts";
import {
  EMPTY_FEED_VIEW,
  SNAPSHOT_TRIGGER_KINDS,
  applyFeedRow,
  timeNow,
} from "./feed.ts";
import type { FeedColumn, LaneClient, View } from "./feed.ts";
import { displayRoleText } from "./content.ts";
import type { CatalogItem, LaneContent } from "./content.ts";
import amwayLogo from "../../../amway.app/assets/amway-logo-black.svg";
import ekLogo from "./assets/ek/elektro-klein-logo.jpg";
import igmLogo from "./assets/igm/igm-logo.svg";
import { Directory } from "./screens/Directory";
import { Offers } from "./screens/Offers";
import { Orders } from "./screens/Orders";
import { Stock } from "./screens/Stock";
import { FeedLog, RejectedAudit } from "./screens/FeedLog";

type TabKey = "overview" | "offers" | "orders" | "contacts" | "activity";

interface RoleColumn extends FeedColumn {
  notice: string | null;
  tab: TabKey;
}

function fallbackCopy(text: string): void {
  const area = document.createElement("textarea");
  area.value = text;
  document.body.appendChild(area);
  area.select();
  try {
    document.execCommand("copy");
  } finally {
    area.remove();
  }
}

function ContactNameField({ currentName, role, disabled, onSave, content }: {
  currentName: string;
  /** The lane's predetermined role: contacts never self-declare it. */
  role: string;
  disabled: boolean;
  onSave: (name: string, role: string) => void;
  content: LaneContent["contactField"];
}) {
  const [name, setName] = useState(currentName);
  return (
    <form
      className="lab-inline-form"
      title={content.title}
      onSubmit={event => {
        event.preventDefault();
        if (!name.trim()) return;
        onSave(name.trim(), role);
      }}
    >
      <input
        type="text"
        value={name}
        onChange={event => setName(event.target.value)}
        placeholder={content.namePlaceholder}
        aria-label={content.namePlaceholder}
        disabled={disabled}
      />
      <button type="submit" className="secondary" disabled={disabled || !name.trim()}>
        {currentName ? content.update : content.save}
      </button>
    </form>
  );
}

function StockUpField({ disabled, onSave, content }: {
  disabled: boolean;
  onSave: (receiptId: string, quantity: number) => void;
  content: LaneContent["stockField"];
}) {
  const [receiptId, setReceiptId] = useState("");
  const [quantity, setQuantity] = useState("40");
  return (
    <form
      className="lab-inline-form"
      title={content.title}
      onSubmit={event => {
        event.preventDefault();
        const count = Number.parseInt(quantity, 10);
        if (!receiptId.trim() || !Number.isSafeInteger(count) || count <= 0) return;
        onSave(receiptId.trim(), count);
        setReceiptId("");
      }}
    >
      <input
        type="text"
        value={receiptId}
        onChange={event => setReceiptId(event.target.value)}
        placeholder={content.receiptPlaceholder}
        aria-label={content.receiptPlaceholder}
        disabled={disabled}
      />
      <input
        type="number"
        min={1}
        step={1}
        value={quantity}
        onChange={event => setQuantity(event.target.value)}
        aria-label={content.quantityLabel}
        disabled={disabled}
      />
      <button type="submit" className="secondary" disabled={disabled || !receiptId.trim()}>
        {content.save}
      </button>
    </form>
  );
}

function OfferAcceptanceAction({ offerId, acceptedQuantity, disabled, onAccept }: {
  offerId: string; acceptedQuantity?: number; disabled: boolean; onAccept: (quantity: number) => Promise<void>;
}) {
  const [quantity, setQuantity] = useState("1");
  const accepted = acceptedQuantity !== undefined;
  const [accepting, setAccepting] = useState(false);
  const inFlight = useRef(false);
  return (
    <form className="lab-handoff-action" onSubmit={async event => {
      event.preventDefault();
      if (inFlight.current || accepted || disabled) return;
      const count = Number(quantity);
      if (!Number.isSafeInteger(count) || count <= 0) return;
      inFlight.current = true;
      setAccepting(true);
      try { await onAccept(count); } finally { inFlight.current = false; setAccepting(false); }
    }}>
      <input type="number" min="1" step="1" required value={acceptedQuantity ?? quantity}
        aria-label={`Acceptance quantity (${offerId})`}
        style={{ width: "5rem" }} disabled={disabled || accepting || accepted}
        onChange={event => setQuantity(event.target.value)} />
      <button type="submit" disabled={disabled || accepting || accepted}>
        {accepted ? `Accepted (${offerId})` : accepting ? `Accepting (${offerId})…` : `Accept (${offerId})`}
      </button>
    </form>
  );
}

export function RoleApp({ brand, content, role, client, persons: hostPersons }: {
  brand: LabBrand;
  content: LaneContent;
  role: string;
  client: LaneClient;
  persons: Record<string, string>;
}) {
  const department = brand.department.id;
  const [owner, setOwner] = useState("");
  const me = owner || hostPersons[role] || "";
  const [boot, setBoot] = useState<"booting" | "live" | string>("booting");
  const [buying, setBuying] = useState(false);
  const [appointing, setAppointing] = useState<string | null>(null);
  const [appointmentStatus, setAppointmentStatus] = useState("");
  const appointmentInFlight = useRef(false);
  const [column, setColumn] = useState<RoleColumn>(() => ({
    view: EMPTY_FEED_VIEW,
    fresh: {},
    feedLog: [],
    chatPeer: null,
    chatUnread: {},
    seenChatHashes: [],
    notice: null,
    tab: "overview",
  }));

  // A projection read can finish after a newer feed-triggered read. Only
  // the latest request may replace the live view.
  const snapshotSequence = useRef(0);
  const snapshot = useCallback(async () => {
    const sequence = ++snapshotSequence.current;
    try {
      const raw = await client.call<View & { known: boolean }>("lab", "getDepartment", { department });
      if (sequence !== snapshotSequence.current) return;
      const view = raw.known ? raw : { ...EMPTY_FEED_VIEW };
      setColumn(current => ({ ...current, view }));
    } catch {
      // Snapshots are best-effort refreshes; feed rows carry the live state.
    }
  }, [client, department]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (;;) {
        try {
          const state: LaneUiState = await client.call("session", "waitUntilReady", { timeoutMs: 5000 });
          if (cancelled) return;
          if (state.authState === "logged_in") {
            const identity = await client.call<{ person: string }>("lab", "whoAmI");
            if (cancelled) return;
            setOwner(identity.person);
            setBoot("live");
            await snapshot();
            return;
          }
        } catch (error) {
          if (cancelled) return;
          const message = error instanceof Error ? error.message : String(error);
          if (!/still booting|timed out/.test(message)) {
            setBoot(message);
            return;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, snapshot]);

  useEffect(() => {
    if (boot !== "live") return;
    return client.onFeed((row: FeedRow) => {
      setColumn(current => ({ ...applyFeedRow(current, row, timeNow()), notice: current.notice, tab: current.tab }));
      if (SNAPSHOT_TRIGGER_KINDS.includes(row.kind ?? "")) void snapshot();
    });
  }, [boot, client, snapshot]);

  const live = boot === "live";
  const { view } = column;
  // Joined devices have no host topology. Resolve their action recipients
  // from the replicated, authority-checked assignments instead.
  const persons = { ...hostPersons, [role]: me };
  for (const target of ["admin", "manager", "seller", "customer"]) {
    if (persons[target]) continue;
    const subjects = [...new Set(view.assignments.filter(entry => entry.role === target).map(entry => entry.subject))];
    if (subjects.length === 1) persons[target] = subjects[0];
  }

  // Arm one chat subscription per known contact (except self), exactly like
  // the old host shell did: without it, incoming messages never notify
  // until the chat is opened. Retried on failure via set membership.
  const openedChats = useRef(new Set<string>());
  useEffect(() => {
    if (!live || !me) return;
    for (const contact of view.contacts) {
      if (contact.person === me || openedChats.current.has(contact.person)) continue;
      openedChats.current.add(contact.person);
      client.call("chat", "openChat", { peer: contact.person }).catch(() => {
        openedChats.current.delete(contact.person);
      });
    }
  });
  const staff = view.roles.includes("admin") || view.roles.includes("manager");
  const seller = staff || view.roles.includes("seller");
  const isCustomer = role === "customer";
  const orderHistory = [...view.pendingOrders, ...view.orders];
  const purchaseCount = isCustomer ? view.orders.length : orderHistory.length + view.offerAcceptances.length;
  const activeTab = column.tab;

  const run = async (method: string, params: Record<string, unknown> = {}) => {
    try {
      await client.call("lab", method, { department, ...params });
    } catch (error) {
      setColumn(current => ({ ...current, notice: error instanceof Error ? error.message : String(error) }));
    }
  };

  const appointed = (target: string) => view.assignments.some(entry => entry.subject === persons[target] && entry.role === target);
  const appointRole = async (target: string) => {
    if (appointmentInFlight.current || appointed(target)) return;
    appointmentInFlight.current = true;
    setAppointing(target);
    setAppointmentStatus(content.appointment.pending(content.roleTitles[target] ?? target));
    setColumn(current => ({ ...current, notice: null }));
    try {
      await client.call("lab", "assignRole", { department, subject: persons[target], role: target });
      // Confirm against the saved projection, not an optimistic local role.
      await snapshot();
      setAppointmentStatus(content.appointment.success(content.roleTitles[target] ?? target));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAppointmentStatus("");
      setColumn(current => ({ ...current, notice: message }));
    } finally {
      appointmentInFlight.current = false;
      setAppointing(null);
    }
  };
  const appointmentLabel = (target: string) => appointing === target
    ? content.appointment.pending(content.roleTitles[target] ?? target)
    : appointed(target)
      ? content.appointment.assigned(content.roleTitles[target] ?? target)
      : content.appoint[target];

  const buy = async (offer: string) => {
    if (!offer || buying) return;
    setBuying(true);
    try {
      await run("buy", { offer, quantity: 1 });
    } finally {
      setBuying(false);
    }
  };

  const publishOffer = (item: CatalogItem) => {
    void run("publishOffer", {
      offerId: `${item.idPrefix}-${view.offers.length + 1}`,
      item: item.item,
      priceList: item.priceList,
      unitAmount: item.unitAmount,
      currency: item.currency,
    });
  };

  if (boot !== "live") {
    return (
      <div className={content.laneClass}>
        <div className="card" style={{ margin: "1.25rem", textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {boot === "booting" ? content.waitingForHost : `Boot Failure: ${displayRoleText(boot, content)}`}
          </p>
        </div>
      </div>
    );
  }

  const title = content.roleTitles[role] ?? role;
  const logo = brand.id === "igm" ? igmLogo : brand.id === "ek" ? ekLogo : amwayLogo;
  const logoAlt = brand.id === "igm" ? "IGM" : brand.id === "ek" ? "Elektro Klein AG" : "Amway";
  return (
    <div className={content.laneClass}>
      <section aria-label={title} className="lane-app">
        <div className="lane-app-body">
          <div className="lab-app-title">
            <img src={logo} alt={logoAlt} className="lab-app-logo" />
            <h2 className="lab-app-title-text">{title}</h2>
            <span className={`badge badge-${view.roles.includes(role) ? "success" : "neutral"}`}>{view.roles.includes(role) ? content.appointment.active : content.appointment.waiting}</span>
          </div>
          {appointmentStatus && <p role="status" className="lab-appointment-status">{appointmentStatus}</p>}
          {column.notice && (
            <div className="state-denied" style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ userSelect: "text", flex: 1, minWidth: 0 }}>{displayRoleText(column.notice, content)}</span>
              <button
                type="button"
                className="lab-copy-btn"
                title="Copy error text"
                onClick={() => {
                  const text = column.notice;
                  if (text && navigator.clipboard?.writeText) {
                    void navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
                  } else if (text) {
                    fallbackCopy(text);
                  }
                }}
              >
                ⧉
              </button>
              <button
                type="button"
                className="lab-copy-btn"
                onClick={() => setColumn(current => ({ ...current, notice: null }))}
              >
                ✕
              </button>
            </div>
          )}

          <div className="lab-metrics-strip">
            <div className="lab-metric-mini">
              <span className="lab-metric-mini-val">{view.contacts.length}</span>
              <span className="lab-metric-mini-lbl">{content.metrics.contacts}</span>
            </div>
            <div className="lab-metric-mini">
              <span className="lab-metric-mini-val">{view.offers.length}</span>
              <span className="lab-metric-mini-lbl">{content.metrics.offers}</span>
            </div>
            <div className="lab-metric-mini">
              <span className="lab-metric-mini-val">{purchaseCount}</span>
              <span className="lab-metric-mini-lbl">{isCustomer ? content.metrics.purchases : content.metrics.orders}</span>
            </div>
            <div className="lab-metric-mini">
              <span className="lab-metric-mini-val">{view.availability ? view.availability.available : "—"}</span>
              <span className="lab-metric-mini-lbl">{role === "admin" ? content.metrics.availAdmin : content.metrics.stock}</span>
            </div>
          </div>

          <div className="lab-actions-section">
            <div className="lab-section-title lab-actions-heading">
              <span>{content.actionsTitle}</span>
              {role === "admin" && (
                <>
                  {(["manager", ...(brand.appointmentAuthority === "admin" ? ["seller", "customer"] : [])] as const).map(target => (
                    <button
                      key={target}
                      type="button"
                      className="btn-accent"
                      disabled={!view.known || !live || !persons[target] || appointing !== null || appointed(target)}
                      onClick={() => void appointRole(target)}
                    >
                      {appointmentLabel(target)}
                    </button>
                  ))}
                </>
              )}
              {brand.appointmentAuthority === "chain" && role === "manager" && (
                <button
                  type="button"
                  className="btn-accent"
                  disabled={!staff || !live || !persons.seller || appointing !== null || appointed("seller")}
                  onClick={() => void appointRole("seller")}
                >
                  {appointmentLabel("seller")}
                </button>
              )}
              {brand.appointmentAuthority === "chain" && role === "seller" && (
                <button
                  type="button"
                  className="btn-accent"
                  disabled={!seller || !live || !persons.customer || appointing !== null || appointed("customer")}
                  onClick={() => void appointRole("customer")}
                >
                  {appointmentLabel("customer")}
                </button>
              )}
            </div>
            <div className="lab-action-buttons">
              <ContactNameField
                key={view.contacts.find(entry => entry.person === me)?.name ?? ""}
                currentName={view.contacts.find(entry => entry.person === me)?.name ?? ""}
                role={role}
                disabled={!view.known || view.roles.length === 0 || !live}
                onSave={(name, contactRole) => void run("publishContact", { name, role: contactRole })}
                content={content.contactField}
              />
              {role === "admin" && (
                <StockUpField
                  disabled={!view.known || !live}
                  onSave={(receiptId, quantity) => void run("stockUp", { receiptId, quantity })}
                  content={content.stockField}
                />
              )}
              {brand.id === "igm" && (role === "manager" || role === "seller") && view.offers
                .filter(offer => offer.publishedBy !== me)
                .map(offer => (
                  <OfferAcceptanceAction key={`accept:${offer.offerId}`} offerId={offer.offerId}
                    disabled={!live || !view.roles.includes(role) || !view.acceptableOffers.includes(offer.offerId)}
                    acceptedQuantity={view.offerAcceptances.find(entry => entry.offer === offer.offerId && entry.acceptedBy === me)?.quantity}
                    onAccept={async quantity => {
                      await run("acceptOffer", { offerId: offer.offerId, quantity });
                      await snapshot();
                    }} />
                ))}
              {role === "seller" && view.offers.map(offer => (
                <button
                  key={offer.offerId}
                  type="button"
                  className="secondary"
                  disabled={!seller || !live || !persons.customer || !view.assignments.some(a => a.role === "customer")}
                  onClick={() => void run("shareOffer", { offerId: offer.offerId, customer: persons.customer })}
                >
                  {content.shareDown(offer.offerId)}
                </button>
              ))}
              {role === "manager" && view.offers.map(offer => (
                <button
                  key={offer.offerId}
                  type="button"
                  className="secondary"
                  disabled={!staff || !live || !persons.seller || !view.assignments.some(a => a.role === "seller")}
                  onClick={() => void run("shareOfferWithSeller", { offerId: offer.offerId, seller: persons.seller })}
                >
                  {content.shareWithSeller(offer.offerId)}
                </button>
              ))}
              {(staff || role === "manager") && content.catalog.map(item => (
                <button
                  key={item.idPrefix}
                  type="button"
                  disabled={!staff || !live}
                  onClick={() => publishOffer(item)}
                >
                  {item.button}
                </button>
              ))}
              {role === "customer" && (
                <button
                  type="button"
                  disabled={!view.roles.includes("customer") || view.offers.length === 0 || !live || buying || view.pendingOrders.length > 0}
                  onClick={() => void buy(view.offers[0]?.offerId ?? "")}
                >
                  {buying || view.pendingOrders.length > 0 ? content.buying : content.buyOne(view.offers[0]?.offerId ?? "Offer")}
                </button>
              )}
            </div>
          </div>

          <Stock view={view} isAdmin={role === "admin"} content={content} />

          <div className="lab-tab-nav">
            {(["overview", "offers", "orders", "contacts", "activity"] as TabKey[]).map(tab => (
              <button
                key={tab}
                type="button"
                className={`lab-tab-btn ${activeTab === tab ? "active" : ""}`}
                onClick={() => setColumn(current => ({ ...current, tab }))}
              >
                {tab === "overview" ? content.tabs.overview
                  : tab === "offers" ? `${content.tabs.offers} (${view.offers.length})`
                  : tab === "orders" ? `${isCustomer ? content.tabs.purchases : content.tabs.orders} (${purchaseCount})`
                  : tab === "contacts" ? `${content.tabs.contacts} (${view.contacts.length})`
                  : `${content.tabs.activity} (${column.feedLog.length})`}
              </button>
            ))}
          </div>

          {(activeTab === "overview" || activeTab === "offers") && (
            <Offers offers={view.offers} fresh={column.fresh} content={content} />
          )}
          {(activeTab === "overview" || activeTab === "orders") && (
            <Orders
              offerAcceptances={view.offerAcceptances}
              orders={view.orders}
              pendingOrders={view.pendingOrders}
              failures={view.purchaseFailures}
              balances={view.balances}
              contacts={view.contacts}
              assignments={view.assignments}
              fresh={column.fresh}
              isCustomer={isCustomer}
              content={content}
            />
          )}
          {(activeTab === "overview" || activeTab === "contacts") && (
            <Directory
              contacts={view.contacts}
              fresh={column.fresh}
              chatPeer={column.chatPeer}
              chatUnread={column.chatUnread}
              personId={me}
              client={client}
              me={me}
              content={content}
              onOpenChat={peer => setColumn(current => ({
                ...current,
                chatPeer: peer,
                chatUnread: peer === null ? current.chatUnread : { ...current.chatUnread, [peer]: 0 },
              }))}
            />
          )}
          {activeTab === "activity" && (
            <FeedLog feedLog={column.feedLog} content={content} />
          )}
          <RejectedAudit view={view} content={content} />
        </div>
      </section>
    </div>
  );
}
