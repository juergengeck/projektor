// packages/projektor.browser/src/lane-app/RoleApp.tsx
/**
 * One role's lane app: boots its own ONE instance lazily (the host drives
 * `session.*` through the registry), renders the role screens with live
 * data, and runs every lab/chat operation through the registry facade.
 */
import { useCallback, useEffect, useState } from "react";
import type { LabBrand } from "@projektor/lab.core/brand.ts";
import type { LaneUiState } from "@projektor/lab.core/session-plan.ts";
import type { FeedRow } from "@projektor/lab.core/port-ipc.ts";
import { LabDeviceInvite } from "../components/LabDeviceInvite";
import {
  EMPTY_FEED_VIEW,
  SNAPSHOT_TRIGGER_KINDS,
  applyFeedRow,
  timeNow,
} from "./feed.ts";
import type { FeedColumn, LaneClient, View } from "./feed.ts";
import type { CatalogItem, LaneContent } from "./content.ts";
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
  role: string;
  disabled: boolean;
  onSave: (name: string, role: string) => void;
  content: LaneContent["contactField"];
}) {
  const [name, setName] = useState(currentName);
  const [roleValue, setRoleValue] = useState(role);
  return (
    <form
      className="lab-inline-form"
      title={content.title}
      onSubmit={event => {
        event.preventDefault();
        if (!name.trim() || !roleValue.trim()) return;
        onSave(name.trim(), roleValue.trim());
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
      <input
        type="text"
        value={roleValue}
        onChange={event => setRoleValue(event.target.value)}
        placeholder={content.rolePlaceholder}
        aria-label={content.rolePlaceholder}
        disabled={disabled}
      />
      <button type="submit" className="secondary" disabled={disabled || !name.trim() || !roleValue.trim()}>
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

export function RoleApp({ brand, content, role, client, persons }: {
  brand: LabBrand;
  content: LaneContent;
  role: string;
  client: LaneClient;
  persons: Record<string, string>;
}) {
  const department = brand.department.id;
  const me = persons[role] ?? "";
  const [boot, setBoot] = useState<"booting" | "live" | string>("booting");
  const [buying, setBuying] = useState(false);
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

  const snapshot = useCallback(async () => {
    try {
      const raw = await client.call<View & { known: boolean }>("lab", "getDepartment", { department });
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
  const staff = view.roles.includes("admin") || view.roles.includes("manager");
  const seller = staff || view.roles.includes("seller");
  const isCustomer = role === "customer";
  const orderHistory = [...view.pendingOrders, ...view.orders];
  const purchaseCount = isCustomer ? view.orders.length : orderHistory.length;
  const activeTab = column.tab;

  const run = async (method: string, params: Record<string, unknown> = {}) => {
    try {
      await client.call("lab", method, { department, ...params });
    } catch (error) {
      setColumn(current => ({ ...current, notice: error instanceof Error ? error.message : String(error) }));
    }
  };

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
            {boot === "booting" ? content.waitingForHost : `Boot Failure: ${boot}`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={content.laneClass}>
      <section aria-label={content.roleTitles[role] ?? role} className="lab-column">
        <div className="lab-column-body">
          {column.notice && (
            <div className="state-denied" style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ userSelect: "text", flex: 1, minWidth: 0 }}>{column.notice}</span>
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
                <button
                  type="button"
                  className="btn-accent"
                  disabled={!view.known || !live}
                  onClick={() => void run("assignRole", { subject: persons.manager, role: "manager" })}
                >
                  {content.appoint.manager}
                </button>
              )}
              {role === "manager" && (
                <button
                  type="button"
                  className="btn-accent"
                  disabled={!staff || !live}
                  onClick={() => void run("assignRole", { subject: persons.seller, role: "seller" })}
                >
                  {content.appoint.seller}
                </button>
              )}
              {role === "seller" && (
                <button
                  type="button"
                  className="btn-accent"
                  disabled={!seller || !live}
                  onClick={() => void run("assignRole", { subject: persons.customer, role: "customer" })}
                >
                  {content.appoint.customer}
                </button>
              )}
            </div>
            <div className="lab-action-buttons">
              <ContactNameField
                key={view.contacts.find(entry => entry.person === me)?.name ?? ""}
                currentName={view.contacts.find(entry => entry.person === me)?.name ?? ""}
                role={view.roles[0] ?? ""}
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
              {role === "seller" && view.offers.map(offer => (
                <button
                  key={offer.offerId}
                  type="button"
                  className="secondary"
                  disabled={!seller || !live || !view.assignments.some(a => a.role === "customer")}
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
                  disabled={!staff || !live || !view.assignments.some(a => a.role === "seller")}
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
              orders={view.orders}
              pendingOrders={view.pendingOrders}
              failures={view.purchaseFailures}
              balances={view.balances}
              contacts={view.contacts}
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
      <LabDeviceInvite
        client={live ? client : undefined}
        plan="lab"
        deviceKey={role}
      />
    </div>
  );
}
