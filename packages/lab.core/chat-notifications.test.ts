import assert from "node:assert/strict";
import { test } from "node:test";
import { createChatNotifications } from "./chat-notifications.ts";
import type { ChatNotification } from "./chat-notifications.ts";
import type { RawChannelEntry } from "../../../one/packages/one.models/lib/models/ChannelManager.js";

const entry = (id: string, dataHash = id): RawChannelEntry => ({
  channelInfoIdHash: "channel", channelEntryHash: id, dataHash,
} as unknown as RawChannelEntry);

test("counts distinct incoming messages, not empty, repeated or batched channel events", async () => {
  const received: ChatNotification[] = [];
  const update = createChatNotifications({
    self: () => "me",
    readObject: async hash => hash === "metadata"
      ? { $type$: "Profile" }
      : { $type$: "ChatMessage", sender: hash === "own" ? "me" : "peer" },
    notify: (_peer, message) => received.push(message),
  });
  await update("peer", []);
  await Promise.all([
    update("peer", [entry("one")]),
    update("peer", [entry("one")]),
  ]);
  assert.equal(received.filter(message => message.incoming).length, 1);

  // Same payload sent twice has distinct channel entries and counts twice.
  await update("peer", [entry("one"), entry("two", "one"), entry("three"), entry("metadata"), entry("own")]);
  assert.deepEqual(received, [
    { id: "channel_one", incoming: true },
    { id: "channel_two", incoming: true },
    { id: "channel_three", incoming: true },
    { id: "channel_own", incoming: false },
  ]);
  // Replaying history after the UI clears its badge must not revive it.
  await update("peer", [entry("one"), entry("two", "one"), entry("three")]);
  assert.equal(received.length, 4);
});

test("a failed read can retry without losing that message or blocking later ones", async () => {
  const received: string[] = [];
  let fail = true;
  const update = createChatNotifications({
    self: () => "me",
    readObject: async () => {
      if (fail) { fail = false; throw new Error("read failed"); }
      return { $type$: "ChatMessage", sender: "peer" };
    },
    notify: (_peer, message) => received.push(message.id),
  });
  await assert.rejects(update("peer", [entry("one")]), /read failed/);
  await update("peer", [entry("one"), entry("two")]);
  assert.deepEqual(received, ["channel_one", "channel_two"]);
});
