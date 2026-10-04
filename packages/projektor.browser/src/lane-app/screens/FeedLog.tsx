// packages/projektor.browser/src/lane-app/screens/FeedLog.tsx
/** Real-time CHUM activity feed and the access-control rejection audit. */
import type { FeedEntry, View } from "../feed.ts";
import { displayRoleText } from "../content.ts";
import type { LaneContent } from "../content.ts";

export function FeedLog({ feedLog, content }: {
  feedLog: FeedEntry[];
  content: LaneContent;
}) {
  return (
    <div className="lab-section">
      <div className="lab-section-title">
        <span>{content.feedTitle}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>{content.lastEvents(feedLog.length)}</span>
      </div>
      <div className="lab-feed-list">
        {feedLog.length === 0 ? (
          <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
            {content.empty.feed}
          </div>
        ) : (
          feedLog.map((item, idx) => (
            <div key={`${item.hash}-${idx}`} className={`lab-feed-item lab-feed-${item.type}`}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontWeight: 600 }}>{displayRoleText(item.label, content)}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>
                  #{item.hash.slice(0, 12)}…
                </span>
              </div>
              <span style={{ fontSize: "0.65rem", color: "var(--amway-muted)" }}>{item.at}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function RejectedAudit({ view, content }: {
  view: View;
  content: LaneContent;
}) {
  if (view.rejected.length === 0) return null;
  return (
    <details style={{ marginTop: "0.25rem" }}>
      <summary style={{ fontSize: "0.75rem", color: "var(--amway-danger)", cursor: "pointer", fontWeight: 600 }}>
        {content.auditTitle(view.rejected.length)}
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.5rem" }}>
        {view.rejected.map(rej => (
          <div
            key={`${rej.type}:${rej.id}`}
            className="state-denied"
            style={{ padding: "0.4rem 0.6rem", fontSize: "0.72rem" }}
          >
            <strong>{rej.type}</strong> ({rej.id}): {displayRoleText(rej.reason, content)}
          </div>
        ))}
      </div>
    </details>
  );
}
