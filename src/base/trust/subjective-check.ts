/**
 * Type1 主观轨三勾真相源（P0 治本收敛 · 用户裁决 2026-09-16）。
 *
 * 六圈定位：第 2 圈业务核心（信任评价）。宪法 #2 接口保守
 *（新增文件，旧 ReviewDimensions 零触碰，客观轨继续用它）/ #6 信用累积
 *（本模块输出 feeding 信用引擎的唯一主观信号口径）。
 *
 * 用户拍板锁死（v1）：
 * - 三项等权：态度 / 仪容 / 复原（金额权重在 type1-settlement，不在这里）。
 * - 着装 = 进门时干净板正（衣/手/发/鞋/味），不查制服，不看干完后出汗
 *   （出汗等不可控因素免责，写进 rubric， UI 配正反例图）。
 * - Tag 不强制、原因不强制（默认三项全勾，好人 1 秒点完；取消勾选才弹
 *   Tag 三选一＋可填）。tagRequired() 恒 false 就是这条裁决的代码化，
 *   后续谁想加强制必须先过用户拍板。
 * - 复原项举证门：无 after 图该项自动不通过（effectivePass 执行，
 *   防“超过来之前”各说各话）。
 * - 犯罪（盗窃/骚扰/危险操作）不走这里，走 dispute/violation 红道。
 *
 * Pure + unit-testable; no runtime imports.
 */

export type SubjectiveItem = "attitude" | "appearance" | "restoration";

export interface SubjectiveChecks {
  attitude: boolean;
  appearance: boolean;
  restoration: boolean;
}

/** 可选 Tag（取消勾选才弹；三选一＋可填，数据稀 v1 认了）。 */
export interface SubjectiveTags {
  attitude?: string[];
  appearance?: string[];
  restoration?: string[];
}

export interface SubjectiveReviewInput {
  checks: SubjectiveChecks;
  /** 有 after 图才有资格谈复原（completion.requiredEvidence 侧落盘）。 */
  hasAfterPhoto: boolean;
  tags?: SubjectiveTags;
  comment?: string;
}

/** UI 一句话 rubric（配正反例图，不只写“友好热情”四字）。 */
export const SUBJECTIVE_RUBRICS: Record<SubjectiveItem, string> = {
  attitude: "进门有招呼、不顶嘴、不甩脸、不全程玩手机",
  appearance: "进门时衣/手/发/鞋/味干净板正；不查制服，不看干完后出汗",
  restoration: "把干活搞乱的地方顺手收回，after 图为准",
};

/** UI 建议 Tag（仅建议，用户可填任意文案；强制恒关）。 */
export const SUBJECTIVE_SUGGESTED_TAGS: Record<SubjectiveItem, readonly string[]> = {
  attitude: ["冷漠", "顶撞", "玩手机"],
  appearance: ["衣着不洁", "异味", "手部不洁"],
  restoration: ["垃圾未带走", "家具未归位", "污渍未清理"],
};

/** 默认全勾（好人 1 秒点完）。 */
export function defaultSubjectiveChecks(): SubjectiveChecks {
  return { attitude: true, appearance: true, restoration: true };
}

/** 落库回读守卫：防脏 JSON 进结算（三键布尔，缺一不可）。 */
export function isSubjectiveChecks(v: unknown): v is SubjectiveChecks {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.attitude === "boolean" &&
    typeof o.appearance === "boolean" &&
    typeof o.restoration === "boolean"
  );
}

/** Tag/原因强制开关：v1 恒 false（用户裁决，用户体验优先）。 */
export function tagRequired(): boolean {
  return false;
}

export function subjectivePassedCount(checks: SubjectiveChecks): number {
  return (
    (checks.attitude ? 1 : 0) +
    (checks.appearance ? 1 : 0) +
    (checks.restoration ? 1 : 0)
  );
}

export function subjectivePassRate(checks: SubjectiveChecks): number {
  return subjectivePassedCount(checks) / 3;
}

/**
 * 有效判定（含举证门）：无 after 图 → restoration 恒不通过，
 * 其余两项按用户原勾。返回有效三勾（供结算 + 信用双消费）。
 */
export function effectiveSubjectivePass(input: SubjectiveReviewInput): SubjectiveChecks {
  const { checks, hasAfterPhoto } = input;
  return {
    attitude: checks.attitude,
    appearance: checks.appearance,
    restoration: hasAfterPhoto ? checks.restoration : false,
  };
}

/** 喂信用的唯一主观信号口径（P4 消费；滑动平均＋衰减在信用侧做）。 */
export function subjectiveCreditSignal(checks: SubjectiveChecks): {
  passRate: number;
  failedItems: SubjectiveItem[];
} {
  const failedItems = (Object.keys(checks) as SubjectiveItem[]).filter(
    (k) => !checks[k],
  );
  return { passRate: subjectivePassRate(checks), failedItems };
}
