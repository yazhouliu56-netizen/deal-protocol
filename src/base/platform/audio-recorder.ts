/**
 * 离线录音切片采集器（P1-3 一键 SOS 联动链 · L1-M2 硬件感知适配层）。
 * 平台硬件层：MediaRecorder 定时切片（默认 5s/片）→ Base64 载荷 →
 * SHA-256 指纹（base/ai/forgery 纯 TS 实现，双端同步可用）→
 * base/safe/crisis-tracker.AudioChunkBuffer FIFO 缓冲（64 片 / 4MiB 上限）。
 * 条文 #3/#5：由弹药 fuzePolicy.sos.autoEvidenceAppend 声明式开关驱动；
 * 条文 #10：无麦克风 / 权限拒绝 / Headless 环境 100% 静默降级，绝不抛异常。
 */

import { sha256Hex } from "../ai/forgery";
import { AudioChunkBuffer, type AudioChunkMeta } from "../safe/crisis-tracker";

const SLICE_MS = 5000;

const buffer = new AudioChunkBuffer();

let recorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;

function toArrayBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * 启动录音切片采集（仅当弹药 sos 引信 autoEvidenceAppend=true 时调用）。
 * 返回是否真实启动；无 MediaRecorder / 授权失败 / 无输入设备时 false（静默降级）。
 */
export async function startAudioVault(
  waveId: string,
  autoEvidenceAppend: boolean
): Promise<boolean> {
  if (!autoEvidenceAppend || recorder !== null) return false;
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return false;
  if (!navigator?.mediaDevices?.getUserMedia) return false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (ev: BlobEvent) => {
      if (!ev.data || ev.data.size === 0) return;
      void ev.data
        .arrayBuffer()
        .then((raw) => {
          const encoded = toArrayBase64(raw);
          buffer.pushAudioChunk({
            waveId,
            durationSec: SLICE_MS / 1000,
            sha256: sha256Hex(encoded),
            encryptedBase64: encoded,
            recordedAt: Date.now(),
          });
        })
        .catch(() => {
          // 单片失败静默丢弃，采集继续（降级是设计的一部分）。
        });
    };
    mr.start(SLICE_MS);
    recorder = mr;
    return true;
  } catch {
    stopAudioVault();
    return false;
  }
}

export function stopAudioVault(): void {
  try {
    if (recorder && recorder.state !== "inactive") recorder.stop();
  } catch {
    // 停止失败不影响主流程
  }
  recorder = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

/** 一键上抛：清空缓冲并取出全部切片（供快照封装）。 */
export function drainAudioVault(): AudioChunkMeta[] {
  return buffer.drainAudioChunks();
}

/** 当前缓冲切片数（徽标呈现用）。 */
export function audioVaultCount(): number {
  return buffer.count();
}

/** 是否正在录音。 */
export function isAudioRecording(): boolean {
  return recorder !== null;
}

/** 测试隔离位：复位模块级状态。 */
export function resetAudioVaultForTest(): void {
  stopAudioVault();
}
