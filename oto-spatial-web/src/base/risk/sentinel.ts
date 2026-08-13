/**
 * 多因子反欺诈探针（ADR-0009）。
 * 四路信号 → 统一风险分 0-100 + 等级 + 事件流。
 * 设备（roamGuard）/ 信用（新号+大额）/ 行为（高频+低完成）/ 图（同设备身份裂变）。
 * 纯函数：所有信号注入，SSR/测试安全；缺数据因子自动剔除重归一（宪法 #10）。
 */

import type { RiskLevel } from "./roamGuard.ts";

export type SentinelLevel = RiskLevel; // safe | watch | high

export interface SentinelFactor {
  name: "device" | "credit" | "behavior" | "graph";
  label: string;
  /** 0-100 单独因子分（0 = 无信号）。 */
  score: number;
  weight: number;
  note?: string;
}

export interface SentinelInput {
  /** roamGuard 设备因子等级（多开信号）。 */
  deviceRisk?: RiskLevel;
  /** 需求方信用分（0-1000）。 */
  creditScore?: number;
  /** 争议金额（¥）。 */
  amountYuan: number;
  /** 近 N 天发布次数。 */
  publishCount: number;
  /** 历史完成率 0-1。 */
  completionRate?: number;
  /** 同设备关联身份数（图因子）。 */
  graphIdentityCount?: number;
  /** 该身份近 N 天是否有裂变活动（图因子）。 */
  graphFission?: boolean;
  /** 服务类目（引信联动：进家类目探针加权 ×1.2）。 */
  category?: string;
}

export interface SentinelResult {
  score: number;
  level: SentinelLevel;
  factors: SentinelFactor[];
  triggeredBy: string[];
}

export interface SentinelEvent {
  at: number;
  identityId: string;
  score: number;
  level: SentinelLevel;
  note: string;
}

/** 引信：进家/上门类目关键词 → 探针整体加权（只读 ammo 语义，不新增弹药字段）。 */
const HOME_ACCESS_KEYWORDS = ["家政", "保洁", "厨师", "上门", "陪诊", "按摩", "遛狗"];

function deviceScore(risk: RiskLevel | undefined): number {
  if (risk === "high") return 80;
  if (risk === "watch") return 50;
  return 0;
}

function creditScoreFactor(credit: number | undefined, amountYuan: number): number {
  if (credit === undefined) return 0;
  if (credit < 600) return amountYuan >= 500 ? 60 : 30;
  return 0;
}

function behaviorScore(publishCount: number, completionRate: number | undefined): number {
  if (publishCount >= 5 && (completionRate ?? 1) < 0.3) return 70;
  if (publishCount >= 5) return 40;
  return 0;
}

function graphScore(identityCount: number | undefined, fission: boolean | undefined): number {
  if ((identityCount ?? 0) >= 3 && fission) return 75;
  if ((identityCount ?? 0) >= 3 || fission) return 40;
  return 0;
}

/** 进家类目判定（引信联动，语义与 ammo/risk-rule home-access 一致）。 */
export function isHomeAccess(category: string | undefined): boolean {
  if (!category) return false;
  return HOME_ACCESS_KEYWORDS.some((k) => category.includes(k));
}

/**
 * 聚合甄检：因子加权 → 归一 → 引信加权（进家 ×1.2）→ 等级。
 * 缺数据因子剔除后按剩余权重重归一（数据缺失不误伤，也不放行）。
 */
export function sentinelCheck(input: SentinelInput): SentinelResult {
  const factors: SentinelFactor[] = [
    {
      name: "device",
      label: "设备多开",
      score: deviceScore(input.deviceRisk),
      weight: 30,
      note:
        input.deviceRisk === "high"
          ? "同设备多身份疑似刷号"
          : input.deviceRisk === "watch"
            ? "家庭共机需留意行为一致性"
            : undefined,
    },
    {
      name: "credit",
      label: "信用与金额",
      score: creditScoreFactor(input.creditScore, input.amountYuan),
      weight: 25,
      note:
        input.creditScore !== undefined && input.creditScore < 600
          ? input.amountYuan >= 500
            ? "新号 + 大额，典型冲单模式"
            : "新号小额，留意观察"
          : undefined,
    },
    {
      name: "behavior",
      label: "发布行为",
      score: behaviorScore(input.publishCount, input.completionRate),
      weight: 25,
      note:
        input.publishCount >= 5 && (input.completionRate ?? 1) < 0.3
          ? "高频发单但极少完成"
          : input.publishCount >= 5
            ? "发布频率偏高"
            : undefined,
    },
    {
      name: "graph",
      label: "关联图谱",
      score: graphScore(input.graphIdentityCount, input.graphFission),
      weight: 20,
      note:
        (input.graphIdentityCount ?? 0) >= 3 && input.graphFission
          ? "多身份互相裂变引流"
          : input.graphFission
            ? "近期有裂变活动"
            : undefined,
    },
  ];

  const active = factors.filter((f) => f.score > 0 || f.note);
  const pool = active.length > 0 ? active : factors;
  const weightSum = pool.reduce((s, f) => s + f.weight, 0);
  const raw = pool.reduce((s, f) => s + f.score * f.weight, 0) / Math.max(1, weightSum);

  const boost = isHomeAccess(input.category) ? 1.2 : 1;
  // 宪法 #9：高危单因子信号不得被其它低危因子稀释——
  // 取「加权分」与「最高单因子分」的大者。
  const maxFactor = Math.max(...factors.map((f) => f.score));
  const score = Math.round(Math.min(100, Math.max(raw, maxFactor) * boost));

  const level: SentinelLevel = score >= 70 ? "high" : score >= 40 ? "watch" : "safe";
  const triggeredBy = factors
    .filter((f) => f.score > 0)
    .map((f) => f.label);

  return { score, level, factors, triggeredBy };
}

/** 甄检事件流（每次发布前甄检 push 一条；纯函数返回追加后的列表）。 */
export function recordSentinel(
  events: SentinelEvent[],
  r: SentinelResult,
  identityId: string,
  now: number
): SentinelEvent[] {
  const note =
    r.level === "high"
      ? `拒绝发布：${r.triggeredBy.join("、")}`
      : r.level === "watch"
        ? `降权观察：${r.triggeredBy.join("、") || "低危信号"}`
        : "通过甄检";
  return [...events, { at: now, identityId, score: r.score, level: r.level, note }];
}