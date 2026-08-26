/**
 * Transport merge semantics — union for collections with no delete semantics,
 * tombstone-filtered for friendRequests (the one collection that does delete).
 *
 * Regression: an accepted/ignored/expired friend request must not resurface
 * from an older base snapshot when the next tab writes (S3 E2E found the
 * friendship forming while the request lingered in localStorage).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeByIdLevel } from "./transport.ts";
import type { FriendRequest } from "@/adapters/social/friends";

const req = (id: string): FriendRequest => ({
  id,
  fromId: "me-a",
  toId: "me-b",
  claimId: "c1",
  at: Date.now(),
});

function bundle(over: Partial<Parameters<typeof mergeByIdLevel>[0]> = {}) {
  return {
    waves: [],
    claims: [],
    payOrders: [],
    responders: [],
    reviews: [],
    pushes: [],
    reports: [],
    bans: {},
    favorites: [],
    initiatorBuffs: {},
    disputes: [],
    friendRequests: [],
    friendships: [],
    friendRequestRemovals: [],
    sentinelEvents: [],
    privacySessions: [],
    imThreads: [],
    imMessages: [],
    crisisRecords: [],
    forgetRequests: [],
    circuitBreaker: { state: "closed", failures: 0, probes: 0, openedAt: 0 } as const,
    offlineQueue: [],
    lake: [],
    signedDocs: [],
    policies: [],
    ...over,
  };
}

test("union keeps ids from both base and next", () => {
  const base = bundle({ friendRequests: [req("fr-1")] });
  const next = bundle({ friendRequests: [req("fr-2")] });
  const merged = mergeByIdLevel(base, next);
  assert.equal(merged.friendRequests.length, 2);
});

test("accepted request stays removed across later base-snapshot merges", () => {
  // state after accept: request consumed + tombstone recorded
  const accepted = bundle({
    friendRequests: [],
    friendRequestRemovals: ["fr-1"],
  });
  // an older snapshot (still carrying the request) writes back later
  const stale = bundle({ friendRequests: [req("fr-1")] });
  const merged = mergeByIdLevel(stale, accepted);
  assert.deepEqual(
    merged.friendRequests.map((r) => r.id),
    []
  );
});

test("stale incoming snapshot cannot resurrect a tombstoned request", () => {
  const current = bundle({
    friendRequests: [],
    friendRequestRemovals: ["fr-1"],
  });
  const stale = bundle({ friendRequests: [req("fr-1")] });
  const merged = mergeByIdLevel(current, stale, true);
  assert.deepEqual(
    merged.friendRequests.map((r) => r.id),
    []
  );
});

test("tombstone survives and union still adds fresh requests", () => {
  const base = bundle({
    friendRequests: [req("fr-1")],
    friendRequestRemovals: ["fr-1"],
  });
  const next = bundle({ friendRequests: [req("fr-2")] });
  const merged = mergeByIdLevel(base, next);
  assert.deepEqual(
    merged.friendRequests.map((r) => r.id),
    ["fr-2"]
  );
  assert.ok(merged.friendRequestRemovals.includes("fr-1"));
});
