// packages/amway.lab/chat-plan.ts
/**
 * 1:1 chat over the commserver channel stack (TopicModel/TopicRoom) — the
 * same mechanism every ONE app chats with, not department objects. Opening
 * a chat with a contact resolves the deterministic P2P topic for the two
 * persons; either side may create it, and messages sync over the mesh
 * connections. Nothing here knows about the department projection.
 */
import type TopicModel from "../../../one/packages/one.models/lib/models/Chat/TopicModel.js";
import type TopicRoom from "../../../one/packages/one.models/lib/models/Chat/TopicRoom.js";
import type ChannelManager from "../../../one/packages/one.models/lib/models/ChannelManager.js";
import type { Person } from "../../../one/packages/one.core/lib/recipes.js";
import type { SHA256IdHash } from "../../../one/packages/one.core/lib/util/type-checks.js";
import { getObject } from "../../../one/packages/one.core/lib/storage-unversioned-objects.js";
import { createChatNotifications } from "./chat-notifications.ts";
import type { ChatNotification } from "./chat-notifications.ts";

const HASH = /^[0-9a-f]{64}$/;

export interface ChatMessageView {
  text: string;
  sender: string;
  sentAt: number;
}

export function createChatPlan({ topicModel, channelManager, self, notify }: {
  topicModel: TopicModel;
  channelManager: ChannelManager;
  self: () => string;
  /** Called once for each distinct message entry in a known peer's channel. */
  notify: (peer: string, message: ChatNotification) => void;
}) {
  const me = (): SHA256IdHash<Person> => {
    const owner = self();
    if (!owner) throw new Error("Amway lab: instance has no owner.");
    return owner as SHA256IdHash<Person>;
  };

  const checkPeer = (peer: string): SHA256IdHash<Person> => {
    if (typeof peer !== "string" || !HASH.test(peer)) throw new Error("Amway lab: chat peer must be a SHA-256 hash.");
    if (peer === self()) throw new Error("Amway lab: cannot chat with yourself.");
    return peer as SHA256IdHash<Person>;
  };

  const checkText = (text: string): string => {
    if (typeof text !== "string" || text.trim() === "") throw new Error("Amway lab: message text is required.");
    if (text.length > 2000) throw new Error("Amway lab: message text must be at most 2000 characters.");
    return text;
  };

  const rooms = new Map<string, TopicRoom>();
  const peerByParticipants = new Map<string, string>();
  const notifyMessages = createChatNotifications({ self, readObject: getObject, notify });
  let subscribed = false;

  function ensureSubscription(): void {
    if (subscribed) return;
    subscribed = true;
    // TopicRoom's own live event never arms in this stack, so subscribe the
    // channel directly, using its changed entries rather than treating each
    // channel event as a message (empty updates and replay are normal).
    channelManager.onUpdated.listen((_channel, channelParticipants, _owner, _time, entries) => {
      const peer = peerByParticipants.get(channelParticipants);
      if (peer) void notifyMessages(peer, entries).catch(error => {
        console.error("Amway lab: chat notification failed.", error);
      });
    });
  }

  async function roomFor(peer: string): Promise<TopicRoom> {
    const hit = rooms.get(peer);
    if (hit) return hit;
    const other = checkPeer(peer);
    const topicId = await topicModel.computeP2PTopicIdHash(me(), other);
    const topic = await topicModel.findTopic(topicId)
      ?? await topicModel.createOneToOneTopic(me(), other, "lab-lane-chat");
    const room = await topicModel.enterTopicRoom(topicId);
    rooms.set(peer, room);
    peerByParticipants.set(topic.participants, peer);
    ensureSubscription();
    return room;
  }

  return {
    async openChat({ peer }: { peer: string }): Promise<{ topicId: string }> {
      const other = checkPeer(peer);
      const topicId = await topicModel.computeP2PTopicIdHash(me(), other);
      await roomFor(peer);
      return { topicId };
    },

    async sendChat({ peer, text }: { peer: string; text: string }): Promise<{ sent: true }> {
      const body = checkText(text);
      const room = await roomFor(peer);
      await room.sendMessage(body, me());
      return { sent: true as const };
    },

    async readChat({ peer, count }: { peer: string; count?: number }): Promise<{ messages: ChatMessageView[] }> {
      checkPeer(peer);
      const room = await roomFor(peer);
      const views: ChatMessageView[] = [];
      const batches = room.retrieveMessagesIterator(count ?? 200);
      for await (const batch of batches) {
        for (const entry of batch) {
          const data = entry.data as { text?: unknown; sender?: unknown } | undefined;
          if (typeof data?.text !== "string") continue;
          const at = entry.creationTime instanceof Date ? entry.creationTime.getTime() : 0;
          views.push({
            text: data.text,
            sender: typeof data.sender === "string" ? data.sender : String(entry.author ?? ""),
            sentAt: at,
          });
        }
      }
      views.sort((a, b) => a.sentAt - b.sentAt);
      return { messages: views };
    },
  };
}

export type ChatPlan = ReturnType<typeof createChatPlan>;
