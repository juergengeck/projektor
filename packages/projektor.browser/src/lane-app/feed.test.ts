// packages/projektor.browser/src/lane-app/feed.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import { applyFeedRow, emptyColumn } from "./feed.ts";
import type { FeedRow } from "@projektor/lab.core/port-ipc.ts";

const chatRow = (over: Partial<FeedRow> = {}): FeedRow => ({
  type: "AmwayChat",
  kind: "chat",
  id: "peer",
  hash: "h1",
  obj: { incoming: true },
  ...over,
});

test("an incoming chat row for a closed peer increments", () => {
  const next = applyFeedRow(emptyColumn(), chatRow(), "10:00:00");
  assert.equal(next.chatUnread.peer, 1);
});

test("an own (incoming: false) row does not increment", () => {
  const next = applyFeedRow(emptyColumn(), chatRow({ obj: { incoming: false } }), "10:00:00");
  assert.deepEqual(next.chatUnread, {});
});

test("the open peer does not increment", () => {
  const column = { ...emptyColumn(), chatPeer: "peer" };
  const next = applyFeedRow(column, chatRow(), "10:00:00");
  assert.deepEqual(next.chatUnread, {});
});

test("the same hash twice counts once", () => {
  const once = applyFeedRow(emptyColumn(), chatRow(), "10:00:00");
  const twice = applyFeedRow(once, chatRow(), "10:00:01");
  assert.equal(twice.chatUnread.peer, 1);
});

test("offer rows upsert by offer id", () => {
  const row: FeedRow = {
    type: "AmwayOffer", kind: "offer", id: "o1", hash: "h2",
    obj: { offerId: "o1", item: "x", unitAmount: 100, currency: "EUR", publishedBy: "p" },
  };
  const once = applyFeedRow(emptyColumn(), row, "10:00:00");
  assert.equal(once.view.offers.length, 1);
  const twice = applyFeedRow(once, { ...row, hash: "h3" }, "10:00:01");
  assert.equal(twice.view.offers.length, 1);
  assert.equal(twice.feedLog.length, 2);
});

test("order rows split admitted and pending by admission", () => {
  const placed: FeedRow = {
    type: "AmwayOrder", kind: "order", id: "k1", hash: "h4",
    obj: { idempotencyKey: "k1", customer: "c", seller: "s", offer: "o1", quantity: 2, admittedAt: 0 },
  };
  const afterPlace = applyFeedRow(emptyColumn(), placed, "10:00:00");
  assert.deepEqual(afterPlace.view.pendingOrders.map(entry => entry.idempotencyKey), ["k1"]);
  assert.deepEqual(afterPlace.view.orders, []);
  const admitted = applyFeedRow(afterPlace, {
    ...placed, hash: "h5", obj: { ...(placed.obj as object), admittedAt: 9 },
  }, "10:00:01");
  assert.deepEqual(admitted.view.orders.map(entry => entry.idempotencyKey), ["k1"]);
  assert.deepEqual(admitted.view.pendingOrders, []);
});
