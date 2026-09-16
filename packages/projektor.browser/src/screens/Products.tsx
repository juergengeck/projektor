import { useMemo, useState } from "react";
import { Badge, CategoryBadge, DataTable, Empty } from "../components/ui";
import { useOp } from "../hooks";
import { t, useLang } from "../i18n";

interface Item { key: string; itemNumber: string; name?: string; brand?: string; category?: string; pv?: number | null; bv?: number | null }
interface Offer { id: string; item: string; unitPrice: string; channel: string }
interface Catalog { items: Item[]; offers: Offer[] }

export default function Products({ refresh }: { refresh: number }) {
  useLang();
  const { data } = useOp<Catalog>("getCatalog", {}, [refresh]);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("all");
  const byKey = useMemo(() => new Map((data?.items ?? []).map(entry => [entry.key, entry])), [data]);
  if (!data) return null;
  if (!data.offers.length) return <Empty />;
  const categories = ["all", "Ernährung", "Schönheit", "Haushalt"];
  const q = query.trim().toLowerCase();
  const filtered = data.offers.filter(entry => {
    const item = byKey.get(entry.item);
    const nameMatch = !q || (item?.name || entry.item).toLowerCase().includes(q) || (item?.brand || "").toLowerCase().includes(q);
    const catMatch = activeCat === "all" || (item?.category || "").toLowerCase() === activeCat.toLowerCase();
    return nameMatch && catMatch;
  });
  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="search" placeholder={t("filter.searchPlaceholder")} value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="filter-chips">
          {categories.map(cat => (
            <button key={cat} type="button" className={`filter-chip ${cat === activeCat ? "active" : ""}`}
              onClick={() => setActiveCat(cat)}>{cat === "all" ? t("filter.all") : cat}</button>
          ))}
        </div>
      </div>
      <DataTable headers={[t("table.name"), t("table.brand"), t("table.category"), t("table.price"), t("table.pvbv"), t("table.channel")]}
        rows={filtered.map(entry => {
          const item = byKey.get(entry.item);
          return [
            <strong key="n">{item?.name ?? entry.item}</strong>,
            item?.brand ?? "—",
            <CategoryBadge key="c" category={item?.category} />,
            <span key="p" className="num-col">{entry.unitPrice}</span>,
            item && item.pv !== null && item.pv !== undefined
              ? <Badge key="v" text={`${item.pv} PV / ${item.bv} BV`} variant="accent" /> : "—",
            <Badge key="ch" text={entry.channel} variant="neutral" />,
          ];
        })} />
    </div>
  );
}
