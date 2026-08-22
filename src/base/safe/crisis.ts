/**
 * 极端危机干预协议（ADR-0013，缺口 N8）。
 * 平台侧 SOS 链路：一键报警升级（紧急联系人 + 平台值班 + 位置留档）。
 * 纯函数：状态机 + 通知事件，SSR/测试安全。
 */

export type CrisisLevel = 0 | 1 | 2 | 3;
// 0 无 / 1 轻微不适 / 2 明显危险信号 / 3 极端紧急

export interface CrisisRecord {
  id: string;
  userId: string;
  waveId?: string;
  level: CrisisLevel;
  note: string;
  at: number;
  /** 已通知对象（去重）。 */
  notified: string[];
  /** 位置留档（爬坡点位，UTC 字符串）。 */
  location?: string;
  resolved: boolean;
}

export function raiseCrisis(
  records: CrisisRecord[],
  userId: string,
  level: CrisisLevel,
  note: string,
  now: number,
  waveId?: string
): { records: CrisisRecord[]; record: CrisisRecord } {
  const record: CrisisRecord = {
    id: `crisis-${now.toString(36)}-${records.length}`,
    userId,
    ...(waveId ? { waveId } : {}),
    level,
    note,
    at: now,
    notified: [],
    resolved: false,
  };
  return { records: [...records, record], record };
}

/** EPA：谁要通知（紧急联系人/平台值班/110 通道），按级别递增。 */
export const EPA_BY_LEVEL: Record<CrisisLevel, string[]> = {
  0: [],
  1: ["紧急联系人"],
  2: ["紧急联系人", "平台值班"],
  3: ["紧急联系人", "平台值班", "警方通道"],
};

export function notifyFor(
  record: CrisisRecord,
  // 预留：用户登记的紧急联系人定向通知（当前 EPA_BY_LEVEL 为通用目标，宪法 #2 签名保守保留）
  _contacts: string[]
): { record: CrisisRecord; targets: string[]; fresh: boolean } {
  const targets = (EPA_BY_LEVEL[record.level] ?? []).filter(
    (t) => !record.notified.includes(t)
  );
  if (targets.length === 0) return { record, targets: [], fresh: false };
  return {
    record: { ...record, notified: [...record.notified, ...targets] },
    targets,
    fresh: true,
  };
}

/** 处理闭环：平台确认处置 → resolved。 */
export function resolveCrisis(
  records: CrisisRecord[],
  id: string,
  now: number
): CrisisRecord[] {
  return records.map((r) => (r.id === id && !r.resolved ? { ...r, resolved: true, resolvedAt: now } : r));
}

/** Slack/短信模板（UI 展示用）。 */
export function crisisSms(record: CrisisRecord, contactName: string): string {
  const lv = record.level === 3 ? "⚠️ 紧急" : record.level === 2 ? "提醒" : "请注意";
  return `[OTO 安全] ${contactName}：您的联系人发起了${lv}求助（${record.note}）${record.location ? `，最后位置 ${record.location}` : ""}。请尽快联系。`;
}

/* ═══ L4-M4 危机干预协议增强门面（P2 战役第一波攻坚，crisis-tracker 内聚闭环） ═══ */
export * from "./crisis-tracker.ts";