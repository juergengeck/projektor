// packages/projektor.browser/src/lane-app/screens/Offers.tsx
/** Catalog offer list. Publish and share controls live in the role actions panel. */
import { Badge } from "../../components/ui";
import type { Offer } from "../feed.ts";
import type { LaneContent } from "../content.ts";

export function Offers({ offers, fresh, content }: {
  offers: Offer[];
  fresh: Record<string, string>;
  content: LaneContent;
}) {
  return (
    <div className="lab-section">
      <div className="lab-section-title">
        <span>{content.catalogTitle}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>{offers.length}{content.activeSuffix}</span>
      </div>
      <div className="lab-items-list">
        {offers.length === 0 ? (
          <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
            {content.empty.offers}
          </div>
        ) : (
          offers.map(entry => {
            const isFresh = Boolean(fresh[`offer:${entry.offerId}`]);
            return (
              <div
                key={`${entry.offerId}:${fresh[`offer:${entry.offerId}`] ?? ""}`}
                className={`lab-item-card ${isFresh ? "lab-fresh" : ""}`}
              >
                <div className="lab-item-main">
                  <span className="lab-item-title">🏷️ {entry.offerId}</span>
                  <span className="lab-item-sub">Item: {entry.item}</span>
                </div>
                <Badge
                  text={`${(entry.unitAmount / 100).toFixed(2)} ${entry.currency}`}
                  variant="nutrition"
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
