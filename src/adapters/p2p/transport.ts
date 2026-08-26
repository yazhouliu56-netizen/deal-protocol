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

import type { WaveBundle } from "@/types/wave-bundle";
import { createSupabaseTransport } from "@/adapters/p2p/supabase";

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

/** 默认命名空间：生产与既有测试的物理通道标识（行 id / 存储键字节兼容）。 */
export const DEFAULT_P2P_NS = "oto";

/** 命名空间净化：仅允许安全字符（Supabase 行 id + localStorage 键共用），超长截断。 */
export function sanitizeP2pNamespace(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9:_-]/g, "").slice(0, 80);
  return cleaned || DEFAULT_P2P_NS;
}

/**
 * 命名空间探针（E2E 物理隔离通道，2026-08-22 战役）：
 * 优先级 window.__OTO_CHANNEL_NS__ > URL ?channel_ns= > 默认「oto」。
 * SSR/Node 守卫：window 未定义时严格返回默认值——服务端渲染与客户端首帧
 * 锁定同一默认通道，杜绝通道分裂与水合不一致。
 */
export function resolveP2pNamespace(): string {
  if (typeof window === "undefined") return DEFAULT_P2P_NS;
  try {
    const w = window as { __OTO_CHANNEL_NS__?: unknown };
    if (typeof w.__OTO_CHANNEL_NS__ === "string" && w.__OTO_CHANNEL_NS__.trim()) {
      return sanitizeP2pNamespace(w.__OTO_CHANNEL_NS__);
    }
    const param = new URLSearchParams(window.location.search).get("channel_ns");
    if (param && param.trim()) return sanitizeP2pNamespace(param);
  } catch {
    // 探针失败不阻断启动——回退默认通道（宪法 #10）
  }
  return DEFAULT_P2P_NS;
}

/** 命名空间 → 本地存储键。默认通道保持原键字节兼容；测试通道派生隔离键。 */
export function broadcastKeyFor(ns: string): string {
  return ns === DEFAULT_P2P_NS ? BROADCAST_KEY : `${BROADCAST_KEY}::${ns}`;
}

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
  const ns = resolveP2pNamespace();
  // E2E 确定性探针（initScript 注入）：云表不可用场景下跳过 supabase 尝试，
  // 从第一帧即锁定本地通道——消除「boot-pull 悬挂窗口内发布→写云端悬空」
  // 的非确定延迟。生产环境无此标记，行为不变。
  if (
    typeof window !== "undefined" &&
    (window as { __OTO_P2P_FORCE_LOCAL__?: unknown }).__OTO_P2P_FORCE_LOCAL__ === true
  ) {
    return createLocalTransport(ns);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    // 静态 import（2026-08-25 缺陷修复）：原 CommonJS require 在 turbopack
    // 生产构建下产生不存在的 chunk 引用（r(93756)），运行时抛错被 catch 吞掉，
    // 导致跨设备同步永久静默降级本地。函数级 ESM 循环引用（supabase.ts ←→
    // transport.ts 双方顶层均无互调执行）运行时安全，正确性优先于 bundle 体积。
    try {
      return createSupabaseTransport(url, key, ns);
    } catch (err) {
      // 降级必须留痕：静默吞掉会让「跨设备同步失效」成为不可诊断的暗故障
      console.warn("[p2p] supabase transport init failed → local fallback:", err);
      // supabase client 构造异常（无效 URL 等）→ local fallback（宪法 #10）
    }
  }
  return createLocalTransport(ns);
}

/** Same-browser transport: localStorage + storage event (current behavior). */
export function createLocalTransport(ns: string = DEFAULT_P2P_NS): P2pTransport {
  const storageKey = broadcastKeyFor(ns);
  const read = (): WaveBundle | null => {
    try {
      const raw = localStorage.getItem(storageKey);
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
          storageKey,
          JSON.stringify({ state: merged, version: 0 })
        );
      } catch {
        // storage full / private mode — broadcast degrades gracefully
      }
    },
    subscribe: (cb) => {
      const handler = (e: StorageEvent) => {
        if (e.key === storageKey) cb();
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
  // 多端竞态仲裁已下沉至 Postgres p2p_merge_write RPC（行锁内状态进度定序，
  // 2026-08-25 双端 E2E 战役根治）；本地通道维持 next-wins 基线语义——
  // 客户端秩合并会改变多 page 协同考卷赖以生存的 storage 事件时序（实证回归），
  // 两端各归其位：云端原子合并、本地保持简单确定性。
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
    favorites: baseOver.favorites,
    initiatorBuffs: baseOver.initiatorBuffs,
    sentinelEvents: [
      ...(base.sentinelEvents ?? []),
      ...(next.sentinelEvents ?? []),
    ].sort((a, b) => a.at - b.at),
    privacySessions: [
      ...(base.privacySessions ?? []),
      ...(next.privacySessions ?? []),
    ].filter((s, i, arr) => arr.findIndex((x) => x.waveId === s.waveId) === i),
    imThreads: byId(base.imThreads ?? [], next.imThreads ?? []),
    imMessages: byId(base.imMessages ?? [], next.imMessages ?? []),
    crisisRecords: byId(base.crisisRecords ?? [], next.crisisRecords ?? []),
    forgetRequests: byId(base.forgetRequests ?? [], next.forgetRequests ?? []),
    // 以下为「本地缓冲/存证链」语义：next 优先，不跨 tab union（哈希链
    // 顺序敏感，并发 append 会破坏链完整性；弱网队列是本设备缓冲）。
    offlineQueue: baseOver.offlineQueue,
    lake: baseOver.lake,
    signedDocs: baseOver.signedDocs,
    // 保单键是 waveId+holderId（同 holder 可跨局各保一份）：按保单 id 去重合并且
    // 本地侧（base）最新状态优先（理赔标记 claimed 不可被 stale 快照回退）。
    policies: byId(
      [...(base.policies ?? [])],
      [...(next.policies ?? [])]
    ).sort((a, b) => a.issuedAt - b.issuedAt),
    circuitBreaker: baseOver.circuitBreaker,
    // W5 履约回写位：next 优先（同 wave 最新流转结果覆盖，跨 tab 共享）。
    fulfilment: baseOver.fulfilment,
  };
}
