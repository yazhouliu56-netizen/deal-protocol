/**
 * L4-M3 物理履约闭环 · Web NFC 碰一碰 / 动态码核销适配层（无头适配器）。
 *
 * 红线 3：纯函数/无头适配层，零 UI 依赖（NDEFReader 检测仅反射环境能力）；
 * 红线 5 确定性降级：不支持 Web NFC 的浏览器/设备优雅降级为动态二维码
 * 扫描通道（generateDynamicVerificationQr），全程不抛未捕获异常。
 *
 * 碰碰核销载荷契约（防重放 + 验签）：
 *   payload = `${VERSION}:${waveId}:${ts}:${exp}:${sig}`
 *   sig = HMAC-SHA256(waveId + "|" + ts + "|" + exp, secretToken) 前 32 hex
 * 接收方验签 + 时间窗（±REPLAY_WINDOW_MS）校验，防离线重放与越权伪造。
 */

import { createHmac, randomUUID } from "node:crypto";

/** 载荷协议版本。 */
const PAYLOAD_VERSION = "v1";
/** 防重放时间窗（毫秒，±5 分钟）。 */
export const REPLAY_WINDOW_MS = 5 * 60_000;
/** 动态码默认有效期（毫秒，5 分钟）。 */
export const DYNAMIC_QR_EXPIRES_MS = 5 * 60_000;

function sign(waveId: string, ts: number, exp: number, secretToken: string): string {
  return createHmac("sha256", secretToken)
    .update(`${waveId}|${ts}|${exp}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Web NFC 环境检测：浏览器存在 NDEFReader 全局即视为支持
 * （jsdom / Node / 旧浏览器 → false，调用方走动态码降级）。
 */
export function isWebNfcSupported(): boolean {
  try {
    return typeof globalThis !== "undefined" && "NDEFReader" in globalThis;
  } catch {
    return false;
  }
}

/** 生成碰碰核销载荷（waveId + 服务端 secretToken 签名，含时间戳防重放）。 */
export function createNfcVerificationPayload(waveId: string, secretToken: string): string {
  const ts = Date.now();
  const exp = ts + DYNAMIC_QR_EXPIRES_MS;
  const sig = sign(waveId, ts, exp, secretToken);
  return `${PAYLOAD_VERSION}:${waveId}:${ts}:${exp}:${sig}`;
}

/**
 * 碰碰载荷弱校验（无密钥快速预览：结构 + waveId + 时间窗）。
 * - 结构/协议版本/waveId 不匹配 → { isValid: false, timestamp: 0 }；
 * - 已过期或时间戳越窗（±REPLAY_WINDOW_MS）→ 重放拒绝；
 * - 通过 → { isValid: true, timestamp: ts }。
 * 注意：本函数不验 HMAC 签名（无密钥），仅作展示层快速判定；
 * 正式核销必须走 verifyBumpPayloadWithSecret（带 secretToken 强验签）。
 */
export function verifyBumpPayload(
  payload: string,
  expectedWaveId: string,
  now: number = Date.now(),
): { isValid: boolean; timestamp: number } {
  if (typeof payload !== "string" || payload.length === 0) {
    return { isValid: false, timestamp: 0 };
  }
  const parts = payload.split(":");
  if (parts.length !== 5) return { isValid: false, timestamp: 0 };
  const [version, waveId, tsRaw, expRaw] = parts;
  if (version !== PAYLOAD_VERSION) return { isValid: false, timestamp: 0 };
  if (waveId !== expectedWaveId) return { isValid: false, timestamp: 0 };
  const ts = Number(tsRaw);
  const exp = Number(expRaw);
  if (!Number.isFinite(ts) || !Number.isFinite(exp)) {
    return { isValid: false, timestamp: 0 };
  }
  if (exp <= now) return { isValid: false, timestamp: 0 };
  if (Math.abs(now - ts) > REPLAY_WINDOW_MS) return { isValid: false, timestamp: 0 };
  return { isValid: true, timestamp: ts };
}

/** 带密钥验签版：与 createNfcVerificationPayload 配对使用的正式验签入口。 */
export function verifyBumpPayloadWithSecret(
  payload: string,
  expectedWaveId: string,
  secretToken: string,
  now: number = Date.now(),
): { isValid: boolean; timestamp: number } {
  if (typeof payload !== "string" || payload.length === 0) {
    return { isValid: false, timestamp: 0 };
  }
  const parts = payload.split(":");
  if (parts.length !== 5) return { isValid: false, timestamp: 0 };
  const [version, waveId, tsRaw, expRaw, sig] = parts;
  if (version !== PAYLOAD_VERSION) return { isValid: false, timestamp: 0 };
  if (waveId !== expectedWaveId) return { isValid: false, timestamp: 0 };
  const ts = Number(tsRaw);
  const exp = Number(expRaw);
  if (!Number.isFinite(ts) || !Number.isFinite(exp)) {
    return { isValid: false, timestamp: 0 };
  }
  if (exp <= now) return { isValid: false, timestamp: 0 };
  if (Math.abs(now - ts) > REPLAY_WINDOW_MS) return { isValid: false, timestamp: 0 };
  if (sig !== sign(waveId, ts, exp, secretToken)) {
    return { isValid: false, timestamp: 0 };
  }
  return { isValid: true, timestamp: ts };
}

/**
 * 动态二维码核销降级通道（红线 5：NFC 不支持 → 扫码碰碰）。
 * 与 NFC 载荷同构同验签（接收方按 verifyBumpPayloadWithSecret 校验），
 * 只多出 expiresAt 供 UI 倒计时展示；纯函数返回数据，渲染由调用方负责。
 */
export function generateDynamicVerificationQr(
  waveId: string,
  secretToken: string,
  expiresInMs: number = DYNAMIC_QR_EXPIRES_MS,
): { qrData: string; waveId: string; expiresAt: number; nonce: string } {
  return {
    qrData: createNfcVerificationPayload(waveId, secretToken),
    waveId,
    expiresAt: Date.now() + expiresInMs,
    nonce: randomUUID(),
  };
}
