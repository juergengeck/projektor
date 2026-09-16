import { Card, DataTable, Empty, MetricCard, StatusBadge } from "../components/ui";
import { useOp } from "../hooks";
import { t, useLang } from "../i18n";

interface Inventory { reservations: { id: string; transactionId: string; lot: string; quantity: number; status: string }[] }

export default function Inventory({ department, refresh }: { department: string; refresh: number }) {
  useLang();
  const { data } = useOp<Inventory>("getInventory", { department }, [department, refresh]);
  if (!data) return null;
  if (!data.reservations.length) return <Empty />;
  const held = data.reservations.filter(r => r.status === "held").length;
  const consumed = data.reservations.filter(r => r.status === "consumed").length;
  return (
    <div>
      <div className="metrics-grid">
        <MetricCard label={t("table.heldLots")} value={String(held)} sub="Lagerbestand blockiert" accent="warning" />
        <MetricCard label={t("table.consumedLots")} value={String(consumed)} sub="Ausgeliefert / Eingelöst" accent="success" />
        <MetricCard label={t("table.lot")} value={String(data.reservations.length)} sub="Gesamtposten" accent="accent" />
      </div>
      <Card title={t("section.inventoryReservations")}>
        <DataTable headers={[t("table.id"), t("table.transaction"), t("table.lot"), t("table.quantity"), t("table.status")]}
          rows={data.reservations.map(entry => [
            <span key="i" className="code-cell">{entry.id}</span>,
            <span key="t" className="code-cell">{entry.transactionId}</span>,
            <strong key="l">{entry.lot}</strong>,
            <span key="q" className="num-col">{String(entry.quantity)}</span>,
            <StatusBadge key="s" status={entry.status} />,
          ])} />
      </Card>
    </div>
  );
}
