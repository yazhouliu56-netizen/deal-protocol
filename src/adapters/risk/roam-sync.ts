/**
 * Roam 同步适配器（P8 多端风控 I/O 薄层，宪法 #1 底座纯核外置）。
 * 仅做 fetch 薄封装，800ms 超时 + 离线 0ms 回落 localStorage，绝不抛异常（红线 5）。
 * 自持 roamOfflineQueue（oto-roam-queue-v1）+ online 自愈 + (user,device) 去重 + 300ms 节流 + 429 退避。
 */

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
export async function replayRoamQueue(): Promise<void> {
  if (replaying) return;
  if (!isOnline()) return;
  const q = loadQueue();
  if (q.length === 0) return;
  replaying = true;
  try {
    for (let i = 0; i < q.length; i++) {
      const t = q[i];
      if (i > 0) await new Promise((r) => setTimeout(r, 300));
      // 直接 fetch 避免递归入队（replay 失败则保留剩余）
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
        if (!res.ok) {
          // 429 退避：保留剩余（含当前）并中断
          const remaining = q.slice(i);
          saveQueue(remaining);
          return;
        }
        // 成功：从持久化队列移除该条
        const cur = loadQueue();
        saveQueue(cur.filter((x) => !(x.deviceId === t.deviceId && x.ts === t.ts)));
      } catch {
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

if (typeof window !== "undefined") {
  try {
    window.addEventListener("online", () => {
      void replayRoamQueue().catch(() => {});
    });
  } catch {}
}
