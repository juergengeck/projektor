// packages/projektor.browser/src/lane-app/screens/Stock.tsx
/** Inventory: network telemetry for the admin, the facility meter for the team. */
import { RoleBadge } from "../../components/ui";
import type { Order, View } from "../feed.ts";
import type { LaneContent } from "../content.ts";
import { fmtDate, nameOf } from "../format.ts";

export function Stock({ view, isAdmin, content }: {
  view: View;
  isAdmin: boolean;
  content: LaneContent;
}) {
  const totalStock = view.availability?.stocked ?? 0;
  const currentStock = view.availability?.available ?? 0;
  const stockPct = totalStock > 0 ? Math.max(0, Math.min(100, (currentStock / totalStock) * 100)) : 0;
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
  const orderHistory: Order[] = [...view.pendingOrders, ...view.orders];

  // Admin holds no inventory of its own: network telemetry instead
  if (isAdmin) {
    return (
      <div className="lab-stock-meter">
        <div className="lab-stock-header">
          <span>{content.telemetryTitle}</span>
          <span>{content.ordersMembers(orderHistory.length + view.offerAcceptances.length, view.assignments.length)}</span>
        </div>
        {view.assignments.length === 0 ? (
          <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
            {content.empty.team}
          </div>
        ) : (
          view.assignments.map(entry => (
            <div key={entry.subject} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", padding: "2px 0", gap: "0.5rem" }}>
              <span>{nameOf(view.contacts, entry.subject)}<br />
                <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>
                  authorized by {nameOf(view.contacts, entry.issuer)} · since {fmtDate(entry.validFrom)}
                </span>
              </span>
              <RoleBadge role={entry.role} label={content.roleTitles[entry.role] ?? entry.role} />
            </div>
          ))
        )}
        {[...unitsByCustomer.entries()].map(([customer, agg]) => (
          <div key={customer} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", padding: "2px 0", gap: "0.5rem" }}>
            <span>{nameOf(view.contacts, customer)}<br />
              <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>
                last {fmtDate(agg.lastAt)} · admitted by {nameOf(view.contacts, agg.seller)}
              </span>
            </span>
            <span>{content.customerOrders(agg.orders, agg.units)}</span>
          </div>
        ))}
        {view.availability && (
          <>
            <div className="lab-stock-header" style={{ marginTop: "0.4rem" }}>
              <span>{content.networkAvailability} ({view.availability.lot})</span>
              <span>{content.stockUnits(currentStock, totalStock)}</span>
            </div>
            <div className="lab-stock-bar">
              <div className="lab-stock-fill" style={{ width: `${stockPct}%` }} />
            </div>
          </>
        )}
      </div>
    );
  }

  if (!view.availability) return null;
  return (
    <div className="lab-stock-meter">
      <div className="lab-stock-header">
        <span>{content.facilityStock} ({view.availability.lot})</span>
        <span>
          {content.stockUnits(currentStock, totalStock)}
        </span>
      </div>
      <div className="lab-stock-bar">
        <div className="lab-stock-fill" style={{ width: `${stockPct}%` }} />
      </div>
    </div>
  );
}
