/**
 * Roam 同步适配器（P8 多端风控 I/O 薄层，宪法 #1 底座纯核外置）。
 * 仅做 fetch 薄封装，800ms 超时 + 离线 0ms 回落 localStorage，绝不抛异常（红线 5）。
 * 自持 roamOfflineQueue（oto-roam-queue-v1）+ online 自愈 + (user,device) 去重 + 300ms 节流 + 429 退避。
 */

import { syncBus } from "../platform/sync-bus.ts";

export interface RoamDeviceDTO {
  device_id: string;
  fingerprint: Record<string, unknown>;
  user_agent?: string;
  ip_hash?: string;
  last_seen_at: string;
  risk_level: string;
}

const SYNC_PATH = "/api/risk/roam/sync";
const TIMEOUT_MS = 800;
const QUEUE_KEY = "oto-roam-queue-v1";

/** 指数退避阶梯（P0-4）：300ms ➔ 1s ➔ 3s ➔ 5s 封顶。 */
export const BACKOFF_LADDER_MS = [300, 1000, 3000, 5000] as const;

/** 解析 Retry-After 响应头（秒数字符串，1..60）；非法（NaN/≤0/>60）返回 null 回落阶梯。 */
export function parseRetryAfterSeconds(header: string | null): number | null {
  if (!header) return null;
  const s = parseInt(header.trim(), 10);
  if (Number.isNaN(s) || s <= 0 || s > 60) return null;
  return s;
}

/** 重试时延：Retry-After 头优先（秒×1000）；无头回落指数阶梯（0→300 / 1→1000 / 2→3000 / 3+→5000 封顶）。 */
export function resolveRetryDelayMs(
  attempt: number,
  retryAfterHeader: string | null = null
): number {
  const ra = parseRetryAfterSeconds(retryAfterHeader);
  if (ra !== null) return ra * 1000;
  const idx = Math.min(Math.max(attempt, 0), BACKOFF_LADDER_MS.length - 1);
  return BACKOFF_LADDER_MS[idx];
}

/** 默认真实延时（测试注入 delayFn 以零真实休眠断言）。 */
function defaultDelay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface RoamQueueTask {
  deviceId: string;
  fingerprint?: Record<string, unknown>;
  userAgent?: string;
  ipHash?: string;
  ts: number;
}

function loadQueue(): RoamQueueTask[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(QUEUE_KEY) : null;
    return raw ? (JSON.parse(raw) as RoamQueueTask[]) : [];
  } catch {
    return [];
  }
}
function saveQueue(q: RoamQueueTask[]): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {}
}
export function enqueueRoam(task: Omit<RoamQueueTask, "ts">): void {
  try {
    const q = loadQueue();
    const filtered = q.filter((t) => t.deviceId !== task.deviceId);
    filtered.push({ ...task, ts: Date.now() });
    saveQueue(filtered);
  } catch {}
}
export function getRoamQueue(): RoamQueueTask[] {
  return loadQueue();
}
export function clearRoamQueue(): void {
  saveQueue([]);
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  ms = TIMEOUT_MS
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(input, { ...init, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function isOnline(): boolean {
  try {
    return typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  } catch {
    return true;
  }
}

/**
 * 同步本设备指纹到云端（幂等 upsert）。离线/超时 0ms 回落，失败自动入离线队列，返回 { ok:false, fallback:true }。
 * 服务端以 auth.uid() 为准，客户端不传 userId（防伪造）。
 */
export async function syncDevice(opts: {
  deviceId: string;
  fingerprint?: Record<string, unknown>;
  userAgent?: string;
  ipHash?: string;
}): Promise<{ ok: boolean; fallback?: boolean; devices?: RoamDeviceDTO[] }> {
  if (!isOnline()) {
    enqueueRoam(opts);
    return { ok: false, fallback: true };
  }
  try {
    const res = await fetchWithTimeout(SYNC_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        device_id: opts.deviceId,
        fingerprint: opts.fingerprint ?? {},
        user_agent: opts.userAgent,
        ip_hash: opts.ipHash,
      }),
    });
    if (!res.ok) {
      // 429 亦入队退避，避免限流期丢失
      enqueueRoam(opts);
      return { ok: false, fallback: true };
    }
    const data = (await res.json().catch(() => ({}))) as { devices?: RoamDeviceDTO[] };
    return { ok: true, devices: data.devices };
  } catch {
    enqueueRoam(opts);
    return { ok: false, fallback: true };
  }
}

/** 心跳上报（last_seen_at 刷新），复用 syncDevice。 */
export async function postHeartbeat(deviceId: string): Promise<{ ok: boolean; fallback?: boolean }> {
  return syncDevice({ deviceId });
}

/** 拉取云端设备列表（GET）。离线/超时回落为 null，由调用方走 localStorage。 */
export async function listDevices(): Promise<{ ok: boolean; devices: RoamDeviceDTO[] } | { ok: false; fallback: true }> {
  if (!isOnline()) return { ok: false, fallback: true };
  try {
    const res = await fetchWithTimeout(SYNC_PATH, { method: "GET" });
    if (!res.ok) return { ok: false, fallback: true };
    const data = (await res.json().catch(() => ({}))) as { devices?: RoamDeviceDTO[] };
    return { ok: true, devices: data.devices ?? [] };
  } catch {
    return { ok: false, fallback: true };
  }
}

let replaying = false;
export async function replayRoamQueue(
  delayFn: (ms: number) => Promise<void> = defaultDelay
): Promise<void> {
  if (replaying) return;
  if (!isOnline()) return;
  const q = loadQueue();
  if (q.length === 0) return;
  replaying = true;
  try {
    for (let i = 0; i < q.length; i++) {
      const t = q[i];
      // 节流：条目间 300ms（沿用存量语义）
      if (i > 0) await delayFn(300);
      let failures = 0;
      let delivered = false;
      // 逐条重试：失败按 300→1s→3s→5s 阶梯退避，Retry-After 头优先，封顶 4 次重试
      while (failures <= BACKOFF_LADDER_MS.length) {
        let ok = false;
        try {
          const res = await fetchWithTimeout(SYNC_PATH, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              device_id: t.deviceId,
              fingerprint: t.fingerprint ?? {},
              user_agent: t.userAgent,
              ip_hash: t.ipHash,
            }),
          });
          ok = res.ok;
          if (!ok) {
            const ra = res.headers?.get ? res.headers.get("Retry-After") : null;
            const delayMs = resolveRetryDelayMs(failures, ra);
            failures += 1;
            if (failures <= BACKOFF_LADDER_MS.length) await delayFn(delayMs);
          }
        } catch {
          const delayMs = resolveRetryDelayMs(failures, null);
          failures += 1;
          if (failures <= BACKOFF_LADDER_MS.length) await delayFn(delayMs);
        }
        if (ok) {
          delivered = true;
          break;
        }
      }
      if (delivered) {
        // 成功：从持久化队列移除该条（200 即 attempt 重置语义天然成立——逐条独立计数）
        const cur = loadQueue();
        saveQueue(cur.filter((x) => !(x.deviceId === t.deviceId && x.ts === t.ts)));
      } else {
        // 持续失败（429/网络）：安全保留剩余（含当前）并中断，等待下次 online 重放
        const remaining = q.slice(i);
        saveQueue(remaining);
        return;
      }
    }
  } catch {
    // 红线 5：不抛
  } finally {
    replaying = false;
  }
}

// P1-2 收敛：原生分散 window 监听 → 统一 syncBus（SSR 安全：无 window 时 registerSyncTrigger 返回 no-op）。
syncBus.registerSyncTrigger(() => replayRoamQueue());
