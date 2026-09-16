/**
 * 阶段提醒槽位真相源（P4 · 用户裁决 2026-09-16）。
 *
 * 六圈定位：第 1 圈触达＋第 2 圈业务核心。宪法 #4 弹药可插拔——
 * 本模块只定义“何时（阶段）＋给谁（双侧）＋多重（强制/建议/告知）”，
 * 文案一律由调用方从弹药表注入（见 src/ammo/stage-copy.ts），
 * base 内零业务文案；缺文案显式报 copyMissing（UI 隐藏＋考卷锁覆盖率）。
 *
 * 阶段 =
 * contract-engine.CONTRACT_SERVICE_STAGES 六态（索引寻址，跨锁考卷）。
 * Pure + unit-testable; 同域导入 contract-engine。
 */

import { CONTRACT_SERVICE_STAGES } from "./contract-engine.ts";

export type ReminderSide = "provider" | "customer";
/** forced 安全强制 / suggestive 建议 / info 同步告知。 */
export type ReminderLevel = "forced" | "suggestive" | "info";

export type ServiceStageName = keyof typeof CONTRACT_SERVICE_STAGES;

export interface ReminderSlot {
  stage: ServiceStageName;
  side: ReminderSide;
  level: ReminderLevel;
  /** 弹药文案表键（`side.stage.slot`）。 */
  copyKey: string;
}

export interface ResolvedReminder extends ReminderSlot {
  copy: string | null;
  copyMissing: boolean;
}

/** 槽位表（阶段推进即触发，不定时乱推）。 */
export const STAGE_REMINDER_SLOTS: readonly ReminderSlot[] = [
  { stage: "ACCEPTED", side: "provider", level: "forced", copyKey: "provider.accepted.kit" },
  { stage: "ACCEPTED", side: "customer", level: "info", copyKey: "customer.accepted.wait" },
  { stage: "DEPARTED", side: "provider", level: "suggestive", copyKey: "provider.departed.enroute" },
  { stage: "DEPARTED", side: "customer", level: "info", copyKey: "customer.departed.door" },
  { stage: "ARRIVED", side: "provider", level: "forced", copyKey: "provider.arrived.checkin" },
  { stage: "ARRIVED", side: "customer", level: "info", copyKey: "customer.arrived.verify" },
  { stage: "IN_PROGRESS", side: "provider", level: "forced", copyKey: "provider.inprogress.safety" },
  { stage: "IN_PROGRESS", side: "customer", level: "suggestive", copyKey: "customer.inprogress.coop" },
  { stage: "DONE", side: "provider", level: "info", copyKey: "provider.done.wrap" },
  { stage: "DONE", side: "customer", level: "info", copyKey: "customer.done.rate" },
];

/** 取某阶段双侧提醒（NOT_ACCEPTED 无提醒）。缺文案不抛，标 missing。 */
export function remindersFor(
  stage: ServiceStageName,
  copyTable: Record<string, string>,
): ResolvedReminder[] {
  return STAGE_REMINDER_SLOTS.filter((s) => s.stage === stage).map((s) => {
    const copy = copyTable[s.copyKey];
    const ok = typeof copy === "string" && copy.trim().length > 0;
    return { ...s, copy: ok ? copy : null, copyMissing: !ok };
  });
}
