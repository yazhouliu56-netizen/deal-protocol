/**
 * 网断草稿箱（补丁 A6）：无网发射 → localStorage 暂存，联网一键续发。
 * 幂等键＝traceId；IO 全 guarded，SSR 安全。
 */
import type { TalkDraft } from "@/base/order/publish-draft";

export interface IntentDraftRecord {
  draft: TalkDraft;
  traceId: string;
  savedAt: number;
}

const DRAFT_KEY = "intent:drafts:v1";
const MAX_DRAFTS = 5;

/** 纯构造（可单测）。 */
export function buildIntentDraftRecord(draft: TalkDraft, traceId: string, now = Date.now()): IntentDraftRecord {
  return { draft: { ...draft }, traceId, savedAt: now };
}

function readStore(): IntentDraftRecord[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (r): r is IntentDraftRecord =>
        !!r && typeof r === "object" && typeof (r as IntentDraftRecord).traceId === "string",
    );
  } catch {
    return [];
  }
}

function writeStore(recs: IntentDraftRecord[]): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(recs.slice(0, MAX_DRAFTS)));
  } catch {}
}

export function saveIntentDraft(rec: IntentDraftRecord): void {
  const recs = readStore().filter((r) => r.traceId !== rec.traceId);
  writeStore([rec, ...recs]);
}

export function loadIntentDrafts(): IntentDraftRecord[] {
  return readStore();
}

export function clearIntentDraft(traceId: string): void {
  writeStore(readStore().filter((r) => r.traceId !== traceId));
}
