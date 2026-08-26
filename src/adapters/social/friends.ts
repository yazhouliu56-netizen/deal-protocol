/**
 * S3 关系沉淀 (friendships) — voluntary "转友" between two real identities.
 *
 * Blueprint rules (user-approved, 2026-08):
 *   - 默认隐私: everything stays anonymous/soft-archived unless both sides
 *     opt in by exchanging a friend request.
 *   - 自愿互转好友: either side may request after a fulfilled claim.
 *   - 72h 未处理自动撤回: pending requests expire silently — no refusal
 *     notice, no pressure (转友请 72h 未处理自动撤回、不收到拒绝提示).
 *
 * Friendship = explicit + mutual: a request becomes a friendship only when
 * the receiver accepts. Storage is pair-normalized (aId < bId) so both
 * directions live in one record; idempotent on replay.
 *
 * Pure + unit-testable; no runtime imports.
 */

export const FRIEND_REQUEST_TTL_MS = 72 * 60 * 60 * 1000;

export interface FriendRequest {
  id: string;
  fromId: string;
  toId: string;
  /** Claim that the friendship is grounded in (one fulfilled deal). */
  claimId: string;
  at: number;
}

export interface Friendship {
  aId: string;
  bId: string;
  since: number;
}

/** Pair key — always normalized so (A,B) and (B,A) are the same friendship. */
export function pairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}

export function areFriends(
  friendships: Friendship[],
  aId: string,
  bId: string
): boolean {
  const key = pairKey(aId, bId);
  return friendships.some((f) => pairKey(f.aId, f.bId) === key);
}

/**
 * 发起转友. Returns the new request, or an { error } when it must not go
 * through: self-friend, already friends, or a live pending request already
 * exists in either direction.
 */
export function sendFriendRequest(
  requests: FriendRequest[],
  friendships: Friendship[],
  input: { id: string; fromId: string; toId: string; claimId: string },
  now = Date.now()
): { request?: FriendRequest; error?: string } {
  if (input.fromId === input.toId) {
    return { error: "friend.self" };
  }
  if (areFriends(friendships, input.fromId, input.toId)) {
    return { error: "friend.already" };
  }
  const pending = requests.some(
    (r) =>
      r.at + FRIEND_REQUEST_TTL_MS > now &&
      ((r.fromId === input.fromId && r.toId === input.toId) ||
        (r.fromId === input.toId && r.toId === input.fromId))
  );
  if (pending) {
    return { error: "friend.pending" };
  }
  return {
    request: {
      id: input.id,
      fromId: input.fromId,
      toId: input.toId,
      claimId: input.claimId,
      at: now,
    },
  };
}

/**
 * 收方接受 → friendship forms (idempotent: replay stays a no-op).
 * The request is consumed. If it already expired it is simply dropped.
 */
export function acceptFriendRequest(
  requests: FriendRequest[],
  friendships: Friendship[],
  requestId: string,
  now = Date.now()
): { requests: FriendRequest[]; friendships: Friendship[]; accepted: boolean } {
  const req = requests.find((r) => r.id === requestId);
  if (!req) {
    // Replay-safe: an unknown request can never create state. Consumers
    // decide what "unknown" means (already-consumed vs never-existed) by
    // checking the friendships list afterwards.
    return { requests, friendships, accepted: false };
  }
  if (req.at + FRIEND_REQUEST_TTL_MS <= now) {
    // Expired — silently dropped, no friendship forms.
    return {
      requests: requests.filter((r) => r.id !== requestId),
      friendships,
      accepted: false,
    };
  }
  const key = pairKey(req.fromId, req.toId);
  if (friendships.some((f) => pairKey(f.aId, f.bId) === key)) {
    return {
      requests: requests.filter((r) => r.id !== requestId),
      friendships,
      accepted: true,
    };
  }
  const friendship: Friendship =
    req.fromId < req.toId
      ? { aId: req.fromId, bId: req.toId, since: now }
      : { aId: req.toId, bId: req.fromId, since: now };
  return {
    requests: requests.filter((r) => r.id !== requestId),
    friendships: [...friendships, friendship],
    accepted: true,
  };
}

/** 收方忽略 → the request lingers with a 72h countdown, then auto-revokes. */
export function ignoreFriendRequest(
  requests: FriendRequest[],
  requestId: string
): FriendRequest[] {
  return requests.filter((r) => r.id !== requestId);
}

/** Expiry sweep — silently drop every request past its 72h window. */
export function expireFriendRequests(
  requests: FriendRequest[],
  now = Date.now()
): FriendRequest[] {
  return requests.filter((r) => r.at + FRIEND_REQUEST_TTL_MS > now);
}

/** Seconds left before a pending request auto-revokes (for the countdown). */
export function requestTtlLeft(request: FriendRequest, now = Date.now()): number {
  return Math.max(0, request.at + FRIEND_REQUEST_TTL_MS - now);
}