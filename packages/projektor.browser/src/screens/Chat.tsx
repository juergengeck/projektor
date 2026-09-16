import { Badge, Card, DataTable, Empty } from "../components/ui";
import { useOp } from "../hooks";
import { personLabel, t, useLang } from "../i18n";

interface Contracts {
  contracts: { holder: string; contact: string; purpose: string; revokedAt: number | null }[];
  names: Record<string, { name?: string; organization?: boolean }>;
}

export default function Chat({ department, refresh }: { department: string; refresh: number }) {
  useLang();
  const { data } = useOp<Contracts>("getContracts", { department }, [department, refresh]);
  if (!data) return null;
  if (!data.contracts.length) return <Empty />;
  return (
    <Card title={t("section.advisoryContracts")}>
      <DataTable headers={[t("table.holder"), t("table.contact"), t("table.purpose"), t("table.status")]}
        rows={data.contracts.map(entry => [
          personLabel(data.names, entry.holder),
          personLabel(data.names, entry.contact),
          entry.purpose,
          entry.revokedAt === null
            ? <Badge key="a" text={t("badge.active")} variant="success" />
            : <Badge key="x" text={t("badge.revoked")} variant="danger" />,
        ])} />
    </Card>
  );
}
