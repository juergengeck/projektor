// packages/projektor.browser/src/lane-app/screens/Orders.tsx
/** Order/purchase history, failures and balances. */
import { Badge, RoleBadge } from "../../components/ui";
import type { Order, OfferAcceptance } from "../feed.ts";
import type { LaneContent } from "../content.ts";
import { fmtDate, fmtMoney, nameOf } from "../format.ts";
import type { Contact } from "../feed.ts";

export function Orders({ offerAcceptances, orders, pendingOrders, failures, balances, contacts, assignments, fresh, isCustomer, content }: {
  offerAcceptances: OfferAcceptance[];
  orders: Order[];
  pendingOrders: Order[];
  failures: { idempotencyKey: string; offer: string; quantity: number; reason: string; decidedAt: number }[];
  balances: { party: string; role: string; receivable: number; payable: number; currency: string }[];
  contacts: Contact[];
  assignments: { subject: string; role: string; issuer: string }[];
  fresh: Record<string, string>;
  isCustomer: boolean;
  content: LaneContent;
}) {
  // Both stages belong to the history. Confirmation replaces the
  // pending version under the same idempotency key in the projection.
  const partyLabel = (person: string) => {
    const contact = contacts.find(entry => entry.person === person);
    const role = contact?.role ?? assignments.find(entry => entry.subject === person)?.role
      ?? (assignments.some(entry => entry.issuer === person) ? "admin" : undefined);
    const title = role ? content.roleTitles[role] : undefined;
    return title ? `${title} · ${nameOf(contacts, person)}` : nameOf(contacts, person);
  };
  const orderHistory = [...pendingOrders, ...orders];
  const purchaseCount = isCustomer ? orders.length : orderHistory.length + offerAcceptances.length;
  return (
    <>
      <section className="lab-section" aria-label={isCustomer ? content.purchaseHistoryTitle : content.ordersTitle}>
        <div className="lab-section-title">
          <span>{isCustomer ? content.purchaseHistoryTitle : content.ordersTitle}</span>
          <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>
            {content.orderCount(purchaseCount, isCustomer)}
          </span>
        </div>
        <div className="lab-items-list">
          {orderHistory.length === 0 && offerAcceptances.length === 0 && failures.length === 0 ? (
            <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
              {isCustomer ? content.empty.purchases : content.empty.orders}
            </div>
          ) : (
            orderHistory.map(entry => {
              const isFresh = Boolean(fresh[`order:${entry.idempotencyKey}`]);
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
                    {confirmed && <span className="lab-item-sub">{content.transaction.confirmed} {fmtDate(entry.admittedAt)}</span>}
                  </div>
                  <Badge text={confirmed ? content.transaction.confirmed : content.transaction.pending} variant={confirmed ? "success" : "warning"} />
                </div>
              );
            })
          )}
          {offerAcceptances.map(entry => (
            <div key={entry.idempotencyKey} data-acceptance-id={entry.idempotencyKey} className={`lab-item-card lab-handoff-card ${fresh[`offer-acceptance:${entry.idempotencyKey}`] ? "lab-fresh" : ""}`}>
              <div className="lab-item-main">
                <span className="lab-item-title">{entry.offer}</span>
                <span className="lab-item-sub">Qty: {entry.quantity}</span>
                <span className="lab-item-sub">{partyLabel(entry.acceptedBy)} accepted from {partyLabel(entry.acceptedFrom)}</span>
                <span className="lab-item-sub">Accepted {fmtDate(entry.acceptedAt)}</span>
              </div>
              <Badge text="Accepted" variant="success" />
            </div>
          ))}
          {failures.map(failure => (
            <div key={failure.idempotencyKey} className="state-denied lab-purchase-failure" role="status">
              <strong>{failure.reason === "out-of-stock" ? "Out of stock" : content.transaction.failed}</strong>
              <div>{failure.offer} · Qty: {failure.quantity}</div>
              <div>{content.transaction.noneConfirmed}</div>
            </div>
          ))}
        </div>
      </section>
      <div className="lab-section">
        <div className="lab-section-title">
          <span>{content.balancesTitle}</span>
          <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>{balances.length}{content.partiesSuffix}</span>
        </div>
        <div className="lab-items-list">
          {balances.length === 0 ? (
            <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
              {content.empty.balances}
            </div>
          ) : (
            balances.map(entry => (
              <div key={`${entry.party}:${entry.currency}`} className="lab-item-card">
                <div className="lab-item-main">
                  <span className="lab-item-title">{nameOf(contacts, entry.party)}</span>
                  <span className="lab-item-sub">
                    Receivable {fmtMoney(entry.receivable, entry.currency)} · Payable {fmtMoney(entry.payable, entry.currency)}
                  </span>
                </div>
                <RoleBadge role={entry.role} label={content.roleTitles[entry.role] ?? entry.role} />
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
