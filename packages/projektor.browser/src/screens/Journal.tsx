import { useState } from "react";
import { Badge, DataTable, Empty } from "../components/ui";
import { useOp } from "../hooks";
import { formatJournalTime, journalTitle, personLabel, t, useLang } from "../i18n";

interface Names { [id: string]: { name?: string; organization?: boolean } }
interface Occurrence { type: string; atTime: number; subject?: string; holder?: string; issuer?: string; person?: string; manager?: string; [key: string]: unknown }
interface Journal { occurrences: Occurrence[]; cut: { complete: boolean }; names: Names }

export default function Journal({ department, refresh }: { department: string; refresh: number }) {
  useLang();
  const { data } = useOp<Journal>("getJournal", { department, limit: 50 }, [department, refresh]);
  const [selected, setSelected] = useState<number>(0);
  if (!data) return null;
  const entry = data.occurrences[selected];
  return (
    <div>
      <div className="card-header">
        <h2>{t("section.auditTimeline")}</h2>
        {data.cut.complete
          ? <Badge text={t("service.connected")} variant="success" dot />
          : <Badge text={t("service.unavailable")} variant="warning" />}
      </div>
      {!data.occurrences.length ? <Empty /> : (
        <div className="journal-layout">
          <ol className="journal-timeline">
            {data.occurrences.map((occurrence, idx) => {
              const actor = occurrence.subject ?? occurrence.holder ?? occurrence.issuer ?? occurrence.person ?? occurrence.manager ?? "";
              const actorLabel = personLabel(data.names, String(actor));
              const when = formatJournalTime(occurrence.atTime);
              return (
                <li key={idx} className="journal-timeline-item">
                  <button type="button" onClick={() => setSelected(idx)}
                    className={`journal-event-button${idx === selected ? " is-active" : ""}`}>
                    <span className="journal-event-title">{journalTitle(data.names, occurrence)}</span>
                    <span className="journal-event-meta">{actorLabel ? `${actorLabel} · ${when}` : when}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="journal-inspector">
            {entry ? (
              <>
                <div className="card-header">
                  <h3>{t("section.eventDetail")}</h3>
                  <Badge text={String(entry.type)} variant="accent" />
                </div>
                <DataTable headers={[t("table.field"), t("table.value")]}
                  rows={Object.entries(entry).map(([field, value]) => [
                    <strong key="f">{field}</strong>,
                    <span key="v" className="code-cell">{String(value ?? "")}</span>,
                  ])} />
              </>
            ) : <p className="state-empty">{t("section.selectEventPrompt")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
