import { Badge, Card, DataTable, Empty, MetricCard, StatusBadge, RoleBadge } from "../components/ui";
import { useOp, withDepartment } from "../hooks";
import { t, useLang } from "../i18n";

interface Summary {
  name: string; cash: string; receivable: string; orders: number;
  ordersByStatus: Record<string, number>; subscriptions: number;
  items: number; offers: number; members: Record<string, number>;
  reservations: { held: number; consumed: number };
}

interface Status {
  departments: number; transactions: number; journalComplete: boolean;
  owner: string; summary?: Summary;
}

export default function Overview() {
  useLang();
  const { data: status } = useOp<Status>("getStatus", withDepartment({}));
  if (!status) return null;
  const summary = status.summary;
  return (
    <div>
      <div className="metrics-grid">
        <MetricCard label={t("table.departments")} value={String(status.departments)} sub="Organisations-Bereiche" accent="accent" />
        <MetricCard label={t("table.transactions")} value={String(status.transactions)} sub="Handels-Vorgänge" accent="success" />
        <MetricCard label={t("table.journalComplete")} value={status.journalComplete ? "✓ Aktiv" : "Unvollständig"}
          sub="Ereigniskette integer" accent={status.journalComplete ? "success" : "warning"} />
        <MetricCard label={t("table.owner")} value={(status.owner || "—").slice(0, 12)} sub="Identitäts-Hash" accent="home" />
      </div>
      {!summary ? <div className="state-empty">{t("scope.required")}</div> : (
        <>
          <div className="metrics-grid">
            <MetricCard label={t("overview.kpi.revenue")} value={summary.cash} sub="Eingegangene Zahlungen" accent="success" />
            <MetricCard label={t("overview.kpi.receivable")} value={summary.receivable} sub="Ausstehende Zahlungen" accent="warning" />
            <MetricCard label={t("overview.kpi.orders")} value={String(summary.orders)}
              sub={`${Object.values(summary.ordersByStatus).reduce((a, b) => a + b, 0)} gebucht`} accent="accent" />
            <MetricCard label={t("overview.kpi.subscriptions")} value={String(summary.subscriptions)} sub="Dauerhafte Abos" accent="nutrition" />
            <MetricCard label={t("overview.kpi.products")} value={String(summary.items)} sub={`${summary.offers} aktive Angebote`} accent="beauty" />
            <MetricCard label={t("overview.kpi.members")} value={String(Object.values(summary.members).reduce((a, b) => a + b, 0))}
              sub="Aktive Rollen" accent="home" />
          </div>
          <div className="dashboard-grid">
            <div className="card">
              <h3>{t("overview.card.orders")}</h3>
              <DataTable headers={[t("table.status"), t("table.orders")]}
                rows={Object.entries(summary.ordersByStatus).map(([state, count]) => [<StatusBadge key={state} status={state} />, String(count)])} />
            </div>
            <div className="card">
              <h3>{t("overview.card.roles")}</h3>
              <DataTable headers={[t("table.role"), t("table.members")]}
                rows={Object.entries(summary.members).map(([role, count]) => [<RoleBadge key={role} role={role} />, String(count)])} />
            </div>
            <div className="card">
              <h3>{t("overview.card.inventory")}</h3>
              <DataTable headers={[t("table.status"), t("table.lot")]} rows={[
                [<Badge key="h" text={t("badge.held")} variant="info" />, String(summary.reservations.held)],
                [<Badge key="c" text={t("badge.consumed")} variant="success" />, String(summary.reservations.consumed)],
              ]} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function ScopedEmpty() {
  return <Empty />;
}
