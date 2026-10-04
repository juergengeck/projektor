// packages/projektor.browser/src/lane-app/screens/Directory.tsx
/** Directory contacts with per-contact chat icons and unread badges. */
import { RoleBadge } from "../../components/ui";
import type { Contact, LaneClient } from "../feed.ts";
import type { LaneContent } from "../content.ts";
import { ChatPanel } from "./Chat";

export function Directory({ contacts, fresh, chatPeer, chatUnread, personId, client, me, content, onOpenChat }: {
  contacts: Contact[];
  fresh: Record<string, string>;
  chatPeer: string | null;
  chatUnread: Record<string, number>;
  personId: string;
  client: LaneClient;
  me: string;
  content: LaneContent;
  onOpenChat: (peer: string | null) => void;
}) {
  return (
    <div className="lab-section">
      <div className="lab-section-title">
        <span>{content.directoryTitle}</span>
        <span style={{ fontSize: "0.7rem", color: "var(--amway-muted)" }}>{contacts.length}{content.verifiedSuffix}</span>
      </div>
      <div className="lab-items-list">
        {contacts.length === 0 ? (
          <div className="state-empty" style={{ padding: "0.8rem", fontSize: "0.75rem" }}>
            {content.empty.contacts}
          </div>
        ) : (
          contacts.map(entry => {
            const isFresh = Boolean(fresh[`contact:${entry.person}`]);
            const chatting = chatPeer === entry.person;
            const peerName = entry.name || `${entry.person.slice(0, 10)}…`;
            const unread = chatUnread[entry.person] ?? 0;
            return (
              <div key={`${entry.person}:${fresh[`contact:${entry.person}`] ?? ""}`}>
                <div
                  className={`lab-item-card ${isFresh ? "lab-fresh" : ""}`}
                  role="button"
                  tabIndex={0}
                  title={content.chat.openChat(peerName)}
                  aria-label={content.chat.openChat(peerName)}
                  style={{ cursor: "pointer" }}
                  onClick={() => onOpenChat(chatting ? null : entry.person)}
                  onKeyDown={event => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenChat(chatting ? null : entry.person);
                    }
                  }}
                >
                  <div className="lab-item-main">
                    <span className="lab-item-title">{entry.name}</span>
                    <span className="lab-item-sub">
                      {entry.person.slice(0, 10)}…{entry.person.slice(-4)}
                    </span>
                  </div>
                  <RoleBadge role={entry.role} label={content.roleTitles[entry.role] ?? entry.role} />
                  {entry.person !== personId && (
                    <button
                      type="button"
                      className="lab-copy-btn lab-chat-icon"
                      title={content.chat.openChat(peerName)}
                      aria-label={content.chat.openChat(peerName)}
                      onClick={event => {
                        event.stopPropagation();
                        onOpenChat(chatting ? null : entry.person);
                      }}
                    >
                      💬
                      {unread > 0 && (
                        <span className="lab-chat-badge" aria-label={`${unread} unread`}>
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </button>
                  )}
                </div>
                {chatting && (
                  <ChatPanel
                    client={client}
                    me={me}
                    peer={entry.person}
                    peerName={peerName}
                    content={content.chat}
                    onClose={() => onOpenChat(null)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
