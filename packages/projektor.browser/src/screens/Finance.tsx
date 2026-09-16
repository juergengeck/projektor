import { Badge, Card, DataTable, Empty, StatusBadge } from "../components/ui";
import { useOp } from "../hooks";
import { t, useLang } from "../i18n";

interface Earnings { sales: { transaction: string; total: string; recognized: string; receivable: string; cash: string }[] }
interface Returns { cases: { id: string; transaction: string; status: string; resolution?: { decision?: string } }[] }

export function Earnings({ department, refresh }: { department: string; refresh: number }) {
  useLang();
  const { data } = useOp<Earnings>("getEarnings", { department }, [department, refresh]);
  if (!data) return null;
  if (!data.sales.length) return <Empty />;
  return (
    <Card title={t("section.salesLedger")}>
      <DataTable headers={[t("table.transaction"), t("table.total"), t("table.recognized"), t("table.receivable"), t("table.cash")]}
        rows={data.sales.map(entry => [
          <span key="t" className="code-cell">{entry.transaction}</span>,
          <strong key="to">{entry.total}</strong>,
          entry.recognized,
          entry.receivable,
          <span key="c" className="num-col">{entry.cash}</span>,
        ])} />
    </Card>
  );
}

export function Returns({ refresh }: { refresh: number }) {
  useLang();
  const { data } = useOp<Returns>("getReturns", {}, [refresh]);
  if (!data) return null;
  if (!data.cases.length) return <Empty />;
  return (
    <Card title={t("section.returnCases")}>
      <DataTable headers={[t("table.id"), t("table.transaction"), t("table.status"), t("table.decision")]}
        rows={data.cases.map(entry => [
          <span key="i" className="code-cell">{entry.id}</span>,
          <span key="t" className="code-cell">{entry.transaction}</span>,
          <StatusBadge key="s" status={entry.status} />,
          <Badge key="d" text={entry.resolution?.decision || "In Bearbeitung"} variant="warning" />,
        ])} />
    </Card>
  );
}
