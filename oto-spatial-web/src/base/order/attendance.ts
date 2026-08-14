/**
 * 组织者出勤档案（Meetup 吸收项 ④）
 *
 * 出勤历史是「信任数据是瞄准镜」（宪法 #6）的沉淀：组织者在自己的开放局
 * 里查看每位成员的出勤档案 —— 到场 / no-show / 中途退出 / 候补。
 * 数据完全从现有 claim 状态机 + wave.waitlist 派生（宪法 #2：不扩状态机，
 * 不新增写路径，纯只读聚合）。
 */

import type { Claim, Wave } from "./wave.ts";

export interface AttendanceStat {
  responderId: string;
  /** 加入过的局数（占过位：joined/accepted/breached/withdrawn 均算）。 */
  joinedWaves: number;
  /** 到场履约（serviceDoneAt 已申报 = 到场）— Meetup "Yes"。 */
  shown: number;
  /** no-show（breached，付了钱没来）— Meetup "No"。 */
  noShows: number;
  /** 中途退出 / 让位（withdrawn）。 */
  withdrawn: number;
  /** 当前仍在候补队列的局数（历史已转正的候补不可追溯，如实降级）。 */
  waitlisted: number;
  /** 最近一次参与时间戳。 */
  lastAt?: number;
}

export interface AttendanceEntry extends AttendanceStat {
  /** 出勤率 0-1（到场 ÷ 加入局数；加入为 0 时视为 1）。 */
  showRate: number;
}

/**
 * 聚合某（些）响应者的出勤档案。跨局统计：以 claims 全局为准，
 * waitlist 在队状态叠加 waves 数据。
 */
export function attendanceLedger(
  claims: Claim[],
  waves: Wave[],
  responderIds: string[]
): Record<string, AttendanceEntry> {
  const out: Record<string, AttendanceStat> = {};
  for (const rid of responderIds) {
    const mine = claims.filter((c) => c.responderId === rid);
    const joinedWaves = mine.length;
    const shown = mine.filter((c) => c.serviceDoneAt != null).length;
    const noShows = mine.filter((c) => c.status === "breached").length;
    const withdrawn = mine.filter((c) => c.status === "withdrawn").length;
    const waitlisted = waves.filter(
      (w) => (w.waitlist ?? []).some((r) => r.responderId === rid)
    ).length;
    const lastAt = mine.reduce(
      (acc, c) => Math.max(acc, c.createdAt),
      0
    );
    out[rid] = {
      responderId: rid,
      joinedWaves,
      shown,
      noShows,
      withdrawn,
      waitlisted,
      lastAt: lastAt > 0 ? lastAt : undefined,
    };
  }
  return finish(out);
}

/** 单个响应者的出勤档案（便捷入口）。 */
export function attendanceFor(
  claims: Claim[],
  waves: Wave[],
  responderId: string
): AttendanceEntry | undefined {
  return attendanceLedger(claims, waves, [responderId])[responderId];
}

function finish(
  stats: Record<string, AttendanceStat>
): Record<string, AttendanceEntry> {
  const out: Record<string, AttendanceEntry> = {};
  for (const [rid, s] of Object.entries(stats)) {
    // 无任何参与记录（没占过位、没候补过）的人不出现在档案里。
    if (s.joinedWaves === 0 && s.waitlisted === 0) continue;
    out[rid] = {
      ...s,
      showRate: s.joinedWaves > 0 ? s.shown / s.joinedWaves : 1,
    };
  }
  return out;
}
