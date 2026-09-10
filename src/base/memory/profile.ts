/**
 * 脑记忆口（补丁 C1）：用户改 AI 行即写画像偏好。
 * 白名单三键：时间偏好 / 价格敏感 / 备注习惯。
 * 红线：位置/金额明细不进记忆（area/category/budget 数值永不存储）。
 * Pure（remember/apply/resolve）＋ localStorage IO（load/save/forget，SSR/测试安全）。
 */
export type PriceSense = "save" | "loose";
export type NoteHabit = "detailed" | "brief";

export interface UserProfile {
  timePref?: string;
  priceSense?: PriceSense;
  noteHabit?: NoteHabit;
  updatedAt: number;
}

export const PROFILE_KEY = "deal-profile-v1";

/**
 * 改即记：行键＋新值（＋预算旧值）→ 画像补丁；非白名单回落 null。
 * budget 只记敏感方向（save/loose），不记具体数。
 */
export function rememberEdit(
  lineKey: string,
  value: unknown,
  ctx?: { prevBudgetYuan?: number },
): Partial<UserProfile> | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (lineKey === "time") return { timePref: v.slice(0, 20) };
  if (lineKey === "budget") {
    const n = parseInt(v.replace(/[^\d]/g, ""), 10);
    const prev = ctx?.prevBudgetYuan;
    if (!Number.isFinite(n) || n <= 0 || !prev || !Number.isFinite(prev) || prev <= 0 || n === prev) {
      return null;
    }
    return { priceSense: n < prev ? "save" : "loose" };
  }
  if (lineKey === "note") return { noteHabit: v.length > 12 ? "detailed" : "brief" };
  return null;
}

/** 补丁合并（updatedAt 调用方注入，纯函数）。 */
export function applyRememberEdit(
  profile: UserProfile | null,
  patch: Partial<UserProfile>,
  now: number,
): UserProfile {
  return { ...(profile ?? { updatedAt: now }), ...patch, updatedAt: now };
}

/** 下次默认命中：空 time＋有画像→预填，返回被默认命中的键（供 C2 脑 why 配文）。 */
export function resolveDefaults(
  draft: { time: string },
  profile: UserProfile | null,
): { time: string; defaulted: ("time")[] } {
  if (!draft.time.trim() && profile?.timePref) {
    return { time: profile.timePref, defaulted: ["time"] };
  }
  return { time: draft.time, defaulted: [] };
}
