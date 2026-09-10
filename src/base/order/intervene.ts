/**
 * 需求方干预规则（P2-T1＋补丁 B1）。
 * 改期/加项/无责撤回三动作的纯守卫；催单因无送达路径不设按钮（假按钮禁令），
 * 待推送 infra 落地再议。
 * Pure + unit-testable; no runtime imports.
 */
import type { AtomicFiveState } from "../../types/ammo-schema.ts";

/** 无责撤回窗（B1）：5 分钟。 */
export const FREE_CANCEL_MS = 5 * 60_000;

/** B1：窗内无责（边界含 300s 整）。 */
export function canFreeCancel(createdAt: number, now = Date.now()): boolean {
  if (!Number.isFinite(createdAt) || !Number.isFinite(now)) return false;
  const dt = now - createdAt;
  return dt >= 0 && dt <= FREE_CANCEL_MS;
}

/** 改期：仅未开工（PUBLISHED/MATCHED）；开工后时间锁死。 */
export function canReschedule(state: AtomicFiveState): boolean {
  return state === "PUBLISHED" || state === "MATCHED";
}

/** 加项：仅未开工；开工后加项走重新磋商（counterOffer 链）。 */
export function canAddItem(state: AtomicFiveState): boolean {
  return state === "PUBLISHED" || state === "MATCHED";
}

/** 改期时间合法性：非空＋120 字内（与 TalkDraft 同口径）。 */
export function sanitizeNewTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 120);
  return t ? t : null;
}

/** 加项定制合法性：非空＋60 字内＋去重（调用方传已有 customs 比对）。 */
export function sanitizeNewCustom(v: unknown, existing: string[]): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 60);
  if (!t || existing.includes(t)) return null;
  return t;
}
