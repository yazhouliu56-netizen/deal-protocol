/**
 * 语音留证（IndexedDB 纯本地存储）— 证据链的音频支点。
 * 纯函数层（node 可单测）：clipMeta / queryClips / summarizeEvidence。
 * 薄封装（浏览器）：saveClip / listClips / loadClipBlob —— window/IDB 不可用时静默 no-op。
 * 设计约束：语音只在本地留存（ASR/TTS 服务端转发后不留缓存），纠纷取证时按 waveId 检索回放。
 */

import type { VoiceClip, VoiceSide } from "./types";

export type { VoiceClip } from "./types";

/** 构建留证元数据（纯函数）。 */
export function clipMeta(input: {
  side: VoiceSide;
  text: string;
  ts: number;
  msgId?: string;
  waveId?: string;
  durationMs?: number;
}): VoiceClip {
  return {
    id: crypto.randomUUID(),
    side: input.side,
    text: input.text,
    ts: input.ts,
    msgId: input.msgId,
    waveId: input.waveId,
    durationMs: input.durationMs,
  };
}

/** 按 waveId / msgId 过滤 + 时间升序（纯函数，取证检索用）。 */
export function queryClips(
  clips: VoiceClip[],
  filter: { waveId?: string; msgId?: string; side?: VoiceSide }
): VoiceClip[] {
  return clips
    .filter(
      (c) =>
        (!filter.waveId || c.waveId === filter.waveId) &&
        (!filter.msgId || c.msgId === filter.msgId) &&
        (!filter.side || c.side === filter.side)
    )
    .sort((a, b) => a.ts - b.ts);
}

/** 取证摘要：一段可贴进 dispute.evidence 的文本（纯函数）。 */
export function summarizeEvidence(clips: VoiceClip[]): string {
  if (clips.length === 0) return "";
  const parts = clips.map(
    (c, i) =>
      `${i + 1}. [${new Date(c.ts).toLocaleString("zh-CN")}] ${
        c.side === "user" ? "需求方语音" : "平台播报"
      }：${c.text.slice(0, 80)}${c.text.length > 80 ? "…" : ""}`
  );
  return `语音凭证（${clips.length} 条）：\n${parts.join("\n")}`;
}

/* ---------------- IndexedDB 薄封装（浏览器） ---------------- */

const DB_NAME = "oto-voice-evidence";
const DB_VERSION = 1;
const STORE_CLIPS = "clips";
const STORE_BLOBS = "blobs";

function dbOpen(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_CLIPS)) {
          const s = db.createObjectStore(STORE_CLIPS, { keyPath: "id" });
          s.createIndex("waveId", "waveId", { unique: false });
          s.createIndex("ts", "ts", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_BLOBS)) {
          db.createObjectStore(STORE_BLOBS, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** 保存留证（元数据 + blob）。node/无 IDB → false。 */
export async function saveClip(clip: VoiceClip): Promise<boolean> {
  const db = await dbOpen();
  if (!db) return false;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_CLIPS, STORE_BLOBS], "readwrite");
      tx.objectStore(STORE_CLIPS).put({ ...clip, blob: undefined });
      if (clip.blob) {
        tx.objectStore(STORE_BLOBS).put({ id: clip.id, blob: clip.blob });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  } finally {
    db.close();
  }
}

/** 列出全部留证元数据（时间倒序，取证面板用）。 */
export async function listClips(): Promise<VoiceClip[]> {
  const db = await dbOpen();
  if (!db) return [];
  try {
    return await new Promise<VoiceClip[]>((resolve) => {
      const tx = db.transaction(STORE_CLIPS, "readonly");
      const req = tx.objectStore(STORE_CLIPS).getAll();
      req.onsuccess = () =>
        resolve((req.result as VoiceClip[]).sort((a, b) => b.ts - a.ts));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

/** 按 waveId 检索留证（纠纷取证）。 */
export async function listClipsByWave(waveId: string): Promise<VoiceClip[]> {
  const db = await dbOpen();
  if (!db) return [];
  try {
    return await new Promise<VoiceClip[]>((resolve) => {
      const tx = db.transaction(STORE_CLIPS, "readonly");
      const idx = tx.objectStore(STORE_CLIPS).index("waveId");
      const req = idx.getAll(waveId);
      req.onsuccess = () =>
        resolve((req.result as VoiceClip[]).sort((a, b) => a.ts - b.ts));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  } finally {
    db.close();
  }
}

/** 读取某条留证的音频 blob（回放/取证导出）。 */
export async function loadClipBlob(id: string): Promise<Blob | null> {
  const db = await dbOpen();
  if (!db) return null;
  try {
    return await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_BLOBS, "readonly");
      const req = tx.objectStore(STORE_BLOBS).get(id);
      req.onsuccess = () => resolve((req.result as { blob: Blob } | undefined)?.blob ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  } finally {
    db.close();
  }
}