import type { ReactNode } from "react";
import { t } from "../i18n";

export function Badge({ text, variant = "neutral", dot = false }: { text: string; variant?: string; dot?: boolean }) {
  return (
    <span className={`badge badge-${variant}`}>
      {dot ? <span className="badge-dot" /> : null}
      {text}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const stat = String(status || "").toLowerCase();
  let variant = "neutral";
  let label: string = status;
  if (["fulfilled", "settled", "active", "certified", "complete", "consumed"].includes(stat)) {
    variant = "success";
    if (stat === "fulfilled") label = t("badge.fulfilled");
    else if (stat === "active") label = t("badge.active");
    else if (stat === "consumed") label = t("badge.consumed");
  } else if (stat === "accepted" || stat === "held") {
    variant = "info";
    if (stat === "accepted") label = t("badge.accepted");
    else if (stat === "held") label = t("badge.held");
  } else if (stat === "pending" || stat === "unverified") {
    variant = "warning";
    if (stat === "pending") label = t("badge.pending");
  } else if (["revoked", "denied", "cancelled"].includes(stat)) {
    variant = "danger";
    if (stat === "revoked") label = t("badge.revoked");
  }
  return <Badge text={label} variant={variant} dot={variant === "success"} />;
}

export function RoleBadge({ role, label = role }: { role: string; label?: string }) {
  let variant = "neutral";
  if (role === "manager") variant = "accent";
  else if (role === "seller") variant = "info";
  else if (role === "admin") variant = "neutral";
  else if (role === "customer") variant = "success";
  return <Badge text={label} variant={variant} />;
}

export function CategoryBadge({ category }: { category?: string | null }) {
  const cat = String(category || "").toLowerCase();
  let variant = "neutral";
  if (cat.includes("ernährung") || cat.includes("nutri")) variant = "category-nutrition";
  else if (cat.includes("schönheit") || cat.includes("beauty") || cat.includes("artistry")) variant = "category-beauty";
  else if (cat.includes("haushalt") || cat.includes("home") || cat.includes("spring") || cat.includes("atmosphere")) variant = "category-home";
  return <Badge text={category || "—"} variant={variant} />;
}

export function MetricCard({ label, value, sub = "", accent = "" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className={`metric-card ${accent ? `accent-${accent}` : ""}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {sub ? <div className="metric-sub">{sub}</div> : null}
    </div>
  );
}

export function DataTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <table>
      <tbody>
        <tr>{headers.map(header => <th key={header}>{header}</th>)}</tr>
        {rows.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
}

export function Empty() {
  return <div className="state-empty">{t("list.empty")}</div>;
}

export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="card">
      {title ? <h2>{title}</h2> : null}
      {children}
    </div>
  );
}
