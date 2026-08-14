/**
 * 推送免打扰（quiet hours）— 纯函数层。
 *
 * 用户自主设置静音窗口（宪法 #9 玩家旅程：复访钩子由用户自己掌控；宪法 #10 降级：
 * 打扰密度是体验的「过载」，需可显式降级）。**不绑付费** —— 免打扰是基础权利，
 * 不是会员权益。
 *
 * Pure + 无 IO/随机，now 注入，SSR/测试安全。
 */

/** 免打扰偏好：时段开关（每周可配多段）+ 全局总开关。 */
export interface QuietPref {
  enabled: boolean;
  /** 一个或多个静音窗口（同一周内按分钟计）。 */
  windows: { start: number; end: number }[];
}

/** 通知事件类型 —— 与 systemNotify 五类对齐。 */
export type NotifKind = "assembled" | "offer" | "joined" | "accepted" | "friend";

/** 紧急类不被免打扰（危机干预/资金到账等必须提醒）。 */
export type NotifClass = "normal" | "urgent";

/**
 * 分钟内取模到一周（仅取周内位置：0..10079）。纯函数，无 Date 依赖。
 * 调用方负责把 Date 拆成 minute-of-week 注入。
 */
export function minuteOfWeek(ms: number, weekStartMs: number): number {
  const diff = Math.floor((ms - weekStartMs) / 60_000);
  return ((diff % 10080) + 10080) % 10080;
}

/** 单窗口内（处理跨日：start>end 覆盖午夜）。 */
export function inWindow(m: number, w: { start: number; end: number }): boolean {
  if (w.start <= w.end) return m >= w.start && m < w.end;
  return m >= w.start || m < w.end; // 跨午夜
}

/** 一个时间点是否被任一窗口覆盖。 */
export function inAnyWindow(m: number, windows: { start: number; end: number }[]): boolean {
  return windows.some((w) => inWindow(m, w));
}

/**
 * 是否应推送：
 *  - urgent（危机/资金）→ 永远推送，不受免打扰影响（宪法 #9 危机链不止步）；
 *  - normal → enabled && 在窗口内 则静音，否则推送。
 */
export function shouldNotify(
  cls: NotifClass,
  pref: QuietPref,
  nowMinute: number
): boolean {
  if (cls === "urgent") return true;
  if (!pref.enabled) return true;
  return !inAnyWindow(nowMinute, pref.windows);
}

/** 追加一个静音窗口（合并重叠/相邻，防碎片化）。 */
export function addWindow(
  pref: QuietPref,
  w: { start: number; end: number }
): QuietPref {
  const next = [...pref.windows, { start: w.start, end: w.end }].sort(
    (a, b) => a.start - b.start
  );
  const merged: { start: number; end: number }[] = [];
  for (const cur of next) {
    const last = merged[merged.length - 1];
    if (!last) {
      merged.push(cur);
      continue;
    }
    // start ≤ last.end → 相接（end 取长）；否则独立。
    if ((cur.start <= last.end && cur.end >= last.start) || cur.start === last.end) {
      merged[merged.length - 1] = {
        start: Math.min(last.start, cur.start),
        end: Math.max(last.end, cur.end),
      };
    } else {
      merged.push(cur);
    }
  }
  // 归一：若整体覆盖全周，退化为 enabled=false（更简单）。
  const totalCover = merged.reduce((s, m) => s + (m.end - m.start), 0);
  return {
    enabled: totalCover >= 10080 ? false : pref.enabled,
    windows: merged,
  };
}

/** 移除：把窗口切成不被覆盖的 gap。 */
export function removeWindow(
  pref: QuietPref,
  w: { start: number; end: number }
): QuietPref {
  const parts: { start: number; end: number }[] = [];
  for (const cur of pref.windows) {
    if (w.start <= cur.start && w.end >= cur.end) continue; // 全吞
    if (w.end <= cur.start || w.start >= cur.end) {
      parts.push(cur); // 无交集
      continue;
    }
    if (cur.start < w.start) parts.push({ start: cur.start, end: w.start });
    if (cur.end > w.end) parts.push({ start: w.end, end: cur.end });
  }
  return { enabled: pref.enabled, windows: parts };
}