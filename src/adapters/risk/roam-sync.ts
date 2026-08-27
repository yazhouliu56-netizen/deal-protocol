/**
 * Roam 同步适配器（P8 多端风控 I/O 薄层，宪法 #1 底座纯核外置）。
 * 仅做 fetch 薄封装，800ms 超时 + 离线 0ms 回落 localStorage，绝不抛异常（红线 5）。
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
 * 同步本设备指纹到云端（幂等 upsert）。离线/超时 0ms 回落，返回 { ok:false, fallback:true }。
 * 服务端以 auth.uid() 为准，客户端不传 userId（防伪造）。
 */
export async function syncDevice(opts: {
  deviceId: string;
  fingerprint?: Record<string, unknown>;
  userAgent?: string;
  ipHash?: string;
}): Promise<{ ok: boolean; fallback?: boolean; devices?: RoamDeviceDTO[] }> {
  if (!isOnline()) return { ok: false, fallback: true };
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
    if (!res.ok) return { ok: false, fallback: true };
    const data = (await res.json().catch(() => ({}))) as { devices?: RoamDeviceDTO[] };
    return { ok: true, devices: data.devices };
  } catch {
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
