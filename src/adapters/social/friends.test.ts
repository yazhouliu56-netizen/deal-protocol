import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FRIEND_REQUEST_TTL_MS,
  acceptFriendRequest,
  areFriends,
  expireFriendRequests,
  ignoreFriendRequest,
  pairKey,
  requestTtlLeft,
  sendFriendRequest,
  type FriendRequest,
  type Friendship,
} from "./friends.ts";

const NOW = 1_800_000_000_000;
const alice = "me-user-a";
const bob = "me-user-b";

test("pairKey normalizes both directions", () => {
  assert.equal(pairKey(alice, bob), pairKey(bob, alice));
  assert.equal(pairKey(alice, bob), `${alice}|${bob}`);
});

test("self-friend is rejected", () => {
  const out = sendFriendRequest([], [], {
    id: "fr-1",
    fromId: alice,
    toId: alice,
    claimId: "c-1",
  }, NOW);
  assert.equal(out.error, "friend.self");
  assert.ok(!out.request);
});

test("already friends → rejected", () => {
  const friendships: Friendship[] = [{ aId: alice, bId: bob, since: NOW }];
  const out = sendFriendRequest([], friendships, {
    id: "fr-1",
    fromId: alice,
    toId: bob,
    claimId: "c-1",
  }, NOW);
  assert.equal(out.error, "friend.already");
});

test("live pending request in either direction → rejected (idempotent)", () => {
  const requests: FriendRequest[] = [{
    id: "fr-0", fromId: alice, toId: bob, claimId: "c-0", at: NOW - 1000,
  }];
  // alice → bob again
  let out = sendFriendRequest(requests, [], {
    id: "fr-1", fromId: alice, toId: bob, claimId: "c-1",
  }, NOW);
  assert.equal(out.error, "friend.pending");
  // reverse direction also blocked
  out = sendFriendRequest(requests, [], {
    id: "fr-2", fromId: bob, toId: alice, claimId: "c-2",
  }, NOW);
  assert.equal(out.error, "friend.pending");
});

test("expired pending request no longer blocks a new one", () => {
  const requests: FriendRequest[] = [{
    id: "fr-0", fromId: alice, toId: bob, claimId: "c-0",
    at: NOW - FRIEND_REQUEST_TTL_MS - 1,
  }];
  const out = sendFriendRequest(requests, [], {
    id: "fr-1", fromId: bob, toId: alice, claimId: "c-2",
  }, NOW);
  assert.ok(out.request);
});

test("accept forms pair-normalized friendship and consumes the request", () => {
  const requests: FriendRequest[] = [{
    id: "fr-1", fromId: bob, toId: alice, claimId: "c-1", at: NOW - 1000,
  }];
  const out = acceptFriendRequest(requests, [], "fr-1", NOW);
  assert.equal(out.accepted, true);
  assert.equal(out.requests.length, 0);
  assert.ok(out.friendships.some((f) => pairKey(f.aId, f.bId) === pairKey(alice, bob)));
  assert.ok(areFriends(out.friendships, alice, bob));
  assert.ok(areFriends(out.friendships, bob, alice));
});

test("accept is idempotent on replay", () => {
  const requests: FriendRequest[] = [{
    id: "fr-1", fromId: alice, toId: bob, claimId: "c-1", at: NOW - 1000,
  }];
  const first = acceptFriendRequest(requests, [], "fr-1", NOW);
  const replay = acceptFriendRequest(
    first.requests, first.friendships, "fr-1", NOW
  );
  // Replay must never corrupt state or duplicate the friendship.
  assert.equal(replay.friendships.length, 1);
  assert.equal(replay.requests.length, 0);
  assert.equal(areFriends(replay.friendships, alice, bob), true);
});

test("expired request accepted → dropped without friendship", () => {
  const requests: FriendRequest[] = [{
    id: "fr-1", fromId: alice, toId: bob, claimId: "c-1",
    at: NOW - FRIEND_REQUEST_TTL_MS - 1,
  }];
  const out = acceptFriendRequest(requests, [], "fr-1", NOW);
  assert.equal(out.accepted, false);
  assert.equal(out.friendships.length, 0);
  assert.equal(out.requests.length, 0);
});

test("ignore removes the request silently", () => {
  const requests: FriendRequest[] = [{
    id: "fr-1", fromId: alice, toId: bob, claimId: "c-1", at: NOW - 1000,
  }];
  assert.equal(ignoreFriendRequest(requests, "fr-1").length, 0);
});

test("expiry sweep drops 72h-completed requests only", () => {
  const live: FriendRequest = {
    id: "fr-1", fromId: alice, toId: bob, claimId: "c-1", at: NOW - 1000,
  };
  const stale: FriendRequest = {
    id: "fr-2", fromId: bob, toId: alice, claimId: "c-2",
    at: NOW - FRIEND_REQUEST_TTL_MS - 1,
  };
  const out = expireFriendRequests([live, stale], NOW);
  assert.deepEqual(out.map((r) => r.id), ["fr-1"]);
});

test("requestTtlLeft counts down to zero", () => {
  const r: FriendRequest = {
    id: "fr-1", fromId: alice, toId: bob, claimId: "c-1",
    at: NOW - 10_000,
  };
  assert.equal(requestTtlLeft(r, NOW), FRIEND_REQUEST_TTL_MS - 10_000);
  assert.equal(requestTtlLeft(r, NOW + FRIEND_REQUEST_TTL_MS), 0);
});