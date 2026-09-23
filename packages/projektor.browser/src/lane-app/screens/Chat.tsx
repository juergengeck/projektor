// packages/projektor.browser/src/lane-app/screens/Chat.tsx
/** 1:1 chat window over topic channels. */
import { useCallback, useEffect, useRef, useState } from "react";
import type { LaneClient } from "../feed.ts";
import type { LaneContent } from "../content.ts";
import type { ChatMessageView } from "@projektor/lab.core/chat-plan.ts";

export interface ChatMsg {
  id: string;
  sender: string;
  text: string;
  at: number;
  incoming: boolean;
}

export function ChatPanel({ client, me, peer, peerName, content, onClose }: {
  client: LaneClient;
  me: string;
  peer: string;
  peerName: string;
  content: LaneContent["chat"];
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const fmtTime = useCallback((at: number) => {
    try {
      return new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    } catch {
      return "";
    }
  }, []);

  const read = useCallback(async () => {
    try {
      const result = await client.call<{ messages: ChatMessageView[] }>("chat", "readChat", { peer });
      setMessages(
        result.messages.map(entry => ({
          id: `${entry.sender}:${entry.sentAt}:${entry.text}`,
          sender: entry.sender,
          text: entry.text,
          at: entry.sentAt,
          incoming: entry.sender !== me,
        })),
      );
    } catch {
      // The chat opens optimistically; rows arrive on the next refresh.
    }
  }, [client, peer, me]);

  useEffect(() => {
    void read();
  }, [read]);

  useEffect(() => {
    const element = listRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages.length, peer]);

  useEffect(() => {
    return client.onFeed(row => {
      if (row.type.endsWith("Chat") && row.id === peer) void read();
    });
  }, [client, peer, read]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await client.call("chat", "sendChat", { peer, text });
      setDraft("");
      await read();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="lab-chat" role="dialog" aria-label={content.title(peerName)}>
      <div className="lab-chat-header">
        <strong>{peerName}</strong>
        <span className="lab-chat-peer">{peer.slice(0, 10)}…</span>
        <button type="button" className="lab-copy-btn" onClick={onClose} aria-label={content.close}>
          ✕
        </button>
      </div>
      <div className="lab-chat-list" ref={listRef}>
        {messages.length === 0 ? (
          <div className="state-empty" style={{ padding: "0.6rem", fontSize: "0.75rem" }}>
            {content.empty}
          </div>
        ) : (
          messages.map(message => (
            <div key={message.id} className={`lab-chat-msg ${message.incoming ? "in" : "out"}`}>
              <span className="lab-chat-author">{message.incoming ? peerName : content.you}</span>
              <span className="lab-chat-text">{message.text}</span>
              <span className="lab-chat-time">{fmtTime(message.at)}</span>
            </div>
          ))
        )}
      </div>
      <form
        className="lab-chat-form"
        onSubmit={event => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={event => setDraft(event.target.value)}
          placeholder={content.messageLabel(peerName)}
          aria-label={content.messageLabel(peerName)}
        />
        <button type="submit" disabled={!draft.trim() || sending}>
          {content.send}
        </button>
      </form>
    </div>
  );
}
