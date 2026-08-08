/**
 * P2P transport gate — where the shared broadcast space lives.
 *
 *   local    → browser localStorage + `storage` event (same device, tabs)
 *   supabase → single-row JSONB table + Realtime postgres_changes (cross-device)
 *
 * The store talks to `P2pTransport` only; production picks the transport at
 * boot from NEXT_PUBLIC_SUPABASE_URL/ANON_KEY (falls back to local when
 * missing, keeping all E2E suites green without credentials).
 */

import type { WaveBundle } from "@/store/useWaveStore";

export interface P2pTransport {
  kind: "local" | "supabase";
  /** Read the whole shared space (null = empty). */
  read(): WaveBundle | null;
  /** Persist a new version of the shared space. */
  write(state: WaveBundle): void;
  /** External updates (other tab / other device). Returns unsubscriber. */
  subscribe(cb: () => void): () => void;
}

export const BROADCAST_KEY = "oto-broadcast-v1";

/** Current transport — lazy singleton so tests can reset it. */
let active: P2pTransport | null = null;

export function setP2pTransport(t: P2pTransport | null): void {
  active = t;
}

export function getP2pTransport(): P2pTransport {
  if (!active) active = createTransport();
  return active;
}

function createTransport(): P2pTransport {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    // dynamic require keeps the bundle free of supabase on the local path
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require("@/lib/p2p/supabase");
      return mod.createSupabaseTransport(url, key);
    } catch {
      // supabase dependency not installed → local fallback
    }
  }
  return createLocalTransport();
}

/** Same-browser transport: localStorage + storage event (current behavior). */
export function createLocalTransport(): P2pTransport {
  const read = (): WaveBundle | null => {
    try {
      const raw = localStorage.getItem(BROADCAST_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const state = parsed?.state ?? parsed;
      if (!state || typeof state !== "object") return null;
      return state as WaveBundle;
    } catch {
      return null;
    }
  };
  return {
    kind: "local",
    read,
    write: (state) => {
      try {
        // 原子防护：写盘前与现存内容做 id 级合并（union）。任何 tab 的
        // 写回（含早态快照）都不会丢失别处已写入的数据；当前业务无删除
        // 语义，union 安全。早态写回的唯一来源（responders seed）已改为
        // store 初始值注入，不再产生写回，杜绝读-改-写可见性竞态。
        const existing = read();
        const merged = existing ? mergeByIdLevel(existing, state) : state;
        localStorage.setItem(
          BROADCAST_KEY,
          JSON.stringify({ state: merged, version: 0 })
        );
      } catch {
        // storage full / private mode — broadcast degrades gracefully
      }
    },
    subscribe: (cb) => {
      const handler = (e: StorageEvent) => {
        if (e.key === BROADCAST_KEY) cb();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}

/**
 * id 级合并：以 `base` 为底，`next` 的同 id 覆盖 base；`next` 的新 id 追加。
 * record 字段按 key 合并（next 优先，但保留 base 中 next 未涉及的 key）。
 * `stale=true`（incoming 是早态快照）时同 id 以 base 为准（不覆盖回退），
 * 仅追加 base 中没有的新 id。
 */
export function mergeByIdLevel(
  base: WaveBundle,
  next: WaveBundle,
  stale = false
): WaveBundle {
  const byId = <T extends { id: string }>(a: T[], b: T[]): T[] => {
    const map = new Map<string, T>();
    if (stale) {
      for (const item of b) map.set(item.id, item);
      for (const item of a) map.set(item.id, item); // base 优先，防回退
    } else {
      for (const item of a) map.set(item.id, item);
      for (const item of b) map.set(item.id, item); // next 优先
    }
    return [...map.values()];
  };
  const baseOver = stale ? { ...next, ...base } : { ...base, ...next };
  // friendships are keyed by the normalized pair, not by id
  const friendKey = (f: { aId: string; bId: string }) =>
    f.aId < f.bId ? `${f.aId}|${f.bId}` : `${f.bId}|${f.aId}`;
  const friendMap = new Map<string, { aId: string; bId: string; since: number }>();
  for (const f of [...(stale ? next.friendships ?? [] : base.friendships ?? []), ...(stale ? base.friendships ?? [] : next.friendships ?? [])]) {
    friendMap.set(friendKey(f), f);
  }
  // friendRequests have delete semantics: union is safe only for collections
  // that never remove items. tombstone the removed ids so a consumed/expired
  // request does not resurface from an older base snapshot on the next merge.
  const removedIds = new Set<string>([
    ...(base.friendRequestRemovals ?? []),
    ...(next.friendRequestRemovals ?? []),
  ]);
  return {
    waves: byId(base.waves ?? [], next.waves ?? []),
    claims: byId(base.claims ?? [], next.claims ?? []),
    payOrders: byId(base.payOrders ?? [], next.payOrders ?? []),
    responders: byId(base.responders ?? [], next.responders ?? []),
    reviews: byId(base.reviews ?? [], next.reviews ?? []),
    pushes: byId(base.pushes ?? [], next.pushes ?? []),
    reports: byId(base.reports ?? [], next.reports ?? []),
    disputes: byId(base.disputes ?? [], next.disputes ?? []),
    friendRequests: byId(base.friendRequests ?? [], next.friendRequests ?? []).filter(
      (r) => !removedIds.has(r.id)
    ),
    friendRequestRemovals: [...removedIds],
    friendships: [...friendMap.values()],
    bans: baseOver.bans,
    initiatorBuffs: baseOver.initiatorBuffs,
  };
}
