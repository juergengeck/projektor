import type { RawChannelEntry } from "../../../one/packages/one.models/lib/models/ChannelManager.js";

export interface ChatNotification {
  id: string;
  incoming: boolean;
}

/** Channel events can replay entries or contain several messages. Count the
 * actual message entries once, retaining identity even after a chat is read. */
export function createChatNotifications({ self, readObject, notify }: {
  self: () => string;
  readObject: (hash: RawChannelEntry["dataHash"]) => Promise<{ $type$: string; sender?: unknown }>;
  notify: (peer: string, message: ChatNotification) => void;
}) {
  const seen = new Set<string>();
  let pending = Promise.resolve();
  return (peer: string, entries: RawChannelEntry[]): Promise<void> => {
    const next = pending.then(async () => {
      for (const entry of entries) {
        const id = `${entry.channelInfoIdHash}_${entry.channelEntryHash}`;
        if (seen.has(id)) continue;
        const data = await readObject(entry.dataHash);
        if (data.$type$ !== "ChatMessage") continue;
        seen.add(id);
        notify(peer, { id, incoming: data.sender !== self() });
      }
    });
    // A failed read must not prevent later channel events from being handled.
    pending = next.catch(() => {});
    return next;
  };
}
