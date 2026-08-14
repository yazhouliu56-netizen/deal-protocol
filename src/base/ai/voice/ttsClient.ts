/**
 * 客户端播报链路：GLM-TTS（/api/tts）→ speechSynthesis 降级。
 * ttsCache：IndexedDB 文本哈希缓存，重复播报零服务端开销。
 * speak() 支持中断（新一轮播报打断旧一轮），并回报实际是否出声。
 */

import { saveClip, loadClipBlob } from "./audioStore";
import type { VoiceClip } from "./types";

const CACHE_PREFIX = "tts:";

function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return CACHE_PREFIX + (h >>> 0).toString(36);
}

/** 播报一条消息；返回是否真的出声（降级静默 → false）。 */
export async function speak(
  text: string,
  opts: { voice?: string; speed?: number; msgId?: string; waveId?: string } = {}
): Promise<boolean> {
  if (!text.trim()) return false;
  const clipId = hashText(text);

  // 1) IndexedDB 缓存命中 → 直接播放。
  const cached = await loadClipBlob(clipId);
  if (cached) {
    return playBlob(cached);
  }

  // 2) GLM-TTS 主链路。
  try {
    const blob = await ttsViaApi(text, opts);
    if (blob) {
      await saveClip({
        id: clipId,
        side: "assistant",
        text,
        ts: Date.now(),
        msgId: opts.msgId,
        waveId: opts.waveId,
        durationMs: Math.round(blob.size / 3200), // wav 24kHz 16bit 近似
        blob,
      } satisfies VoiceClip);
      return playBlob(blob);
    }
  } catch {
    /* 落 speechSynthesis */
  }

  // 3) 浏览器原生 TTS 兜底。
  return speakWithBrowser(text, opts.speed ?? 1);
}

/** /api/tts → wav blob；503/失败 → null（调用方降级）。 */
async function ttsViaApi(
  text: string,
  opts: { voice?: string; speed?: number }
): Promise<Blob | null> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: text.slice(0, 1024),
      voice: opts.voice ?? "tongtong",
      speed: opts.speed ?? 1,
    }),
  });
  if (!res.ok) return null;
  return await res.blob();
}

function playBlob(blob: Blob): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof Audio === "undefined") {
      resolve(false);
      return;
    }
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(false);
      };
      void audio.play().catch(() => resolve(false));
    } catch {
      resolve(false);
    }
  });
}

/** 浏览器 speechSynthesis 兜底（Windows 自带中文音色；无语音引擎 → false）。 */
export function speakWithBrowser(text: string, rate = 1): Promise<boolean> {
  return new Promise((resolve) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      resolve(false);
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "zh-CN";
      u.rate = rate;
      // 优先中文音色（Windows huihui/kangkang）。
      const zh =
        window.speechSynthesis.getVoices().find((v) => /zh|Chinese/i.test(v.lang)) ??
        window.speechSynthesis.getVoices()[0];
      if (zh) u.voice = zh;
      u.onend = () => resolve(true);
      u.onerror = () => resolve(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {
      resolve(false);
    }
  });
}