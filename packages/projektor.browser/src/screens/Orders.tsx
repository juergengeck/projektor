import { Badge, Card, DataTable, Empty, StatusBadge } from "../components/ui";
import { useOp } from "../hooks";
import { personLabel, t, useLang } from "../i18n";

interface Orders {
  transactions: { id: string; channel: string; seller: string; total: string; ledger: { status: string } }[];
  subscriptions: { id: string; customer: string; status: string }[];
  names: Record<string, { name?: string; organization?: boolean }>;
}

export default function Orders({ department, refresh }: { department: string; refresh: number }) {
  useLang();
  const { data } = useOp<Orders>("getOrders", { department }, [department, refresh]);
  if (!data) return null;
  return (
    <div>
      <Card title={t("section.orderHistory")}>
        {data.transactions.length ? (
          <DataTable headers={[t("table.id"), t("table.channel"), t("table.seller"), t("table.total"), t("table.status")]}
            rows={data.transactions.map(entry => [
              <span key="i" className="code-cell">{entry.id}</span>,
              <Badge key="c" text={entry.channel} variant="neutral" />,
              personLabel(data.names, entry.seller),
              <strong key="t">{entry.total}</strong>,
              <StatusBadge key="s" status={entry.ledger.status} />,
            ])} />
        ) : <Empty />}
      </Card>
      <Card title={t("section.activeSubscriptions")}>
        {data.subscriptions.length ? (
          <DataTable headers={[t("table.id"), t("table.customer"), t("table.status")]}
            rows={data.subscriptions.map(entry => [
              <span key="i" className="code-cell">{entry.id}</span>,
              personLabel(data.names, entry.customer),
              <StatusBadge key="s" status={entry.status} />,
            ])} />
        ) : <Empty />}
      </Card>
    </div>
  );
}
