/**
 * Supabase Realtime transport — cross-device shared broadcast space.
 *
 * Storage model: single row in `p2p_broadcast` (id=oto, state jsonb).
 *   CREATE TABLE public.p2p_broadcast (
 *     id text primary key,
 *     state jsonb not null,
 *     updated_at timestamptz default now()
 *   );
 *   alter table public.p2p_broadcast enable row level security;
 *   create policy "anon read" on public.p2p_broadcast for select using (true);
 *   create policy "anon write" on public.p2p_broadcast for insert with check (true);
 *   create policy "anon update" on public.p2p_broadcast for update using (true);
 *   -- Realtime must be enabled on the table in the dashboard (Realtime > tables).
 *
 * Reads are cached in memory (sync `read()` for zustand persist); the cache is
 * primed by an initial fetch and kept fresh by postgres_changes. Writes upsert
 * asynchronously; self-echoes are dropped via signature comparison.
 *
 * Degradation (宪法 #10 降级是设计的一部分 / 红线 5 确定性降级)：
 * 云端尚未建立 `p2p_broadcast` 表（PGRST205 / HTTP 404）时，本通道静默切换
 * 到本地通道（localStorage + storage 事件，见 createLocalTransport），
 * 全程不向控制台抛红：write/pull 的错误一律吞掉，仅触发一次降级迁移。
 */

import { createClient } from "@supabase/supabase-js";
import type { P2pTransport } from "./transport";
import { createLocalTransport, DEFAULT_P2P_NS } from "./transport";
import type { WaveBundle } from "@/types/wave-bundle";

const TABLE = "p2p_broadcast";

interface P2pErrorLike {
  code?: string;
  message?: string;
  status?: number;
  hint?: string;
}

/** 判定是否为「云端表/视图未建立」类错误（对齐 Supabase PostgrestError）。 */
function isMissingTable(err: P2pErrorLike | null | undefined): boolean {
  if (!err) return false;
  if (err.code === "PGRST205") return true;
  if (err.status === 404) return true;
  const msg = (err.message ?? "") + " " + (err.hint ?? "");
  return (
    msg.includes("Could not find the table") ||
    msg.includes("doesn't exist") ||
    msg.includes("does not exist") ||
    msg.includes("relation") ||
    msg.includes(TABLE)
  );
}

export function createSupabaseTransport(
  url: string,
  key: string,
  /** 命名空间 = 本通道专属行 id（默认「oto」与生产行字节兼容；E2E 注入专属行物理隔离）。 */
  ns: string = DEFAULT_P2P_NS
): P2pTransport {
  const ROW_ID = ns;
  // 8s 上限：云端不可达（墙/超时/域名解析挂起）时快速走失败路径 → degrade，
  // 避免 pull() 长时间悬挂导致「第一帧读空 → 降级迟迟不来」的窗口期（E2E flaky）。
  const client = createClient(url, key, {
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(8_000) }),
    },
  });
  let cache: WaveBundle | null = null;
  let sig = "";
  const listeners = new Set<() => void>();
  // 降级分支与主通道同命名空间：云端不可达切本地时仍保持物理隔离。
  const localFallback = createLocalTransport(ns);
  let degraded = false;

  function notify(): void {
    listeners.forEach((cb) => cb());
  }

  /**
   * 静默降级迁移：云端表缺失（或无法联通）时切到本地通道。
   * 幂等（degraded 守卫）；迁移后 Realtime 订阅立即退订，杜绝后续 404 噪音。
   * 降级完成即刻 notify：读方（zustand persist rehydrate）在 cache 转移后
   * 立即重新拉取，杜绝「rehydrate 读空 → 降级后无人唤醒」的窗口期空态。
   */
  function degrade(): void {
    if (degraded) return;
    degraded = true;
    try {
      channel?.unsubscribe();
    } catch {
      // unsubscribe 失败可忽略（通道可能已断）
    }
    // 本地通道接盘：既有缓存数据转移，后续读写全走 localStorage
    cache = localFallback.read() ?? cache;
    localFallback.subscribe(notify);
    notify();
  }

  let channel: ReturnType<typeof client.channel> | null = null;

  async function pull(): Promise<void> {
    if (degraded) return;
    try {
      const { data, error } = await client
        .from(TABLE)
        .select("state")
        .eq("id", ROW_ID)
        .maybeSingle();
      if (error) {
        // 表缺失 → 确定性降级本地；其它错误（RLS/网络）静默保缓存
        if (isMissingTable(error)) degrade();
        return;
      }
      if (!data) return;
      const s = JSON.stringify(data.state as WaveBundle);
      if (s === sig) return;
      sig = s;
      cache = data.state as WaveBundle;
      notify();
    } catch {
      // network offline — keep the cache
    }
  }

  // prime the cache (cross-device pull on boot)
  void pull();

  channel = client
    .channel("p2p-broadcast")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLE,
        filter: `id=eq.${ROW_ID}`,
      },
      () => void pull()
    )
    .subscribe((status, err) => {
      // Realtime 订阅失败（如表未开 Realtime / 表不存在）→ 静默降级本地，
      // 不向控制台抛错；其余通道错误继续保留 supabase 通道（自动重试）。
      if (status === "CHANNEL_ERROR" && err && isMissingTable(err)) {
        degrade();
      }
    });

  return {
    kind: "supabase",
    read: () => cache,
    write: (state) => {
      const s = JSON.stringify(state);
      if (s === sig) {
        cache = state;
        return;
      }
      sig = s;
      cache = state;
      notify();
      if (degraded) {
        localFallback.write(state);
        return;
      }
      void client
        .from(TABLE)
        .upsert({ id: ROW_ID, state, updated_at: new Date().toISOString() })
        .then(({ error }) => {
          if (!error) return;
          if (isMissingTable(error)) {
            // 云端表缺失：落本地并完成降级（幂等），此后再无云端写请求
            degrade();
            localFallback.write(state);
            return;
          }
          // 其它写入错误（RLS 拒绝 / 网络抖动）：静默保缓存（红线 5 确定性降级）
        });
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}