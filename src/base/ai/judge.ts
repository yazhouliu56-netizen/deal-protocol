/**
 * 智能争议小法官（judge）— ADR-0008。
 *
 * 证据链比对 → 定责偏移 → 赔付建议 + 话术。
 * 本模块是确定性兜底 + 共享模型：LLM 可用时给语义比对，
 * 不可用时（宪法 #10）此规则引擎永不裸奔。
 *
 * Pure + unit-testable; no runtime imports.
 */

import type { DisputeReason, Responsibility } from "../order/dispute.ts";
import { autoVerdict } from "../order/dispute.ts";

export type JudgeSource = "rules" | "llm";

export interface JudgeInput {
  reason: DisputeReason;
  /** 需求方举证（必填）。 */
  evidence: string;
  /** 响应者反驳（可空）。 */
  responderText?: string;
  /** 争议金额（¥）。 */
  amountYuan: number;
  /** 聊天记录中可量化的承诺关键词（如「含地毯」「全屋 2 小时」）。 */
  promiseHints?: string[];
}

export interface VerdictSuggestion {
  /** 穿透 dispute.ts Responsibility。 */
  stance: Responsibility;
  /** 建议退款比例 0-100（受原因档位上限约束）。 */
  refundPct: number;
  amountYuan: number;
  /** 一句话正反方摘要（给客服/用户看）。 */
  rationale: string;
  /** 话术：安抚 + 结论 + 下一步。 */
  replyScript: string;
  confidence: number;
  source: JudgeSource;
}

/** 硬伤关键词：证据中出现 → 责任升档（响应者更该赔）。 */
const HARD_HINT = ["没来", "坏了", "丢了", "少了", "没做", "损坏", "缺失", "没到"];
/** 反驳关键词：响应者反驳中出现 → 责任降档（瑕疵但积极补救）。 */
const SOFT_DEFENSE = ["晾干", "二次", "约定", "提前告知", "已补救", "免费返工", "重新"];
/** 承诺破坏关键词：承诺存在且证据含此类词 → 承诺落空，升档。 */
const BROKEN_PROMISE = ["没", "不", "未", "缺", "就走", "提前走", "只干了"];

/** 升档映射：次重责任 → 更重。 */
const ESCALATE: Record<Responsibility, Responsibility> = {
  "responder-partial": "responder-full",
  shared: "responder-partial",
  "responder-full": "responder-full",
  demander: "shared",
};
/** 降档映射：仅全责可降为部分责任（partial 以下由 reason 决定，不继续下探）。 */
const DEESCALATE_ONCE: Record<Responsibility, Responsibility> = {
  "responder-full": "responder-partial",
  "responder-partial": "responder-partial",
  shared: "shared",
  demander: "demander",
};

/** 各责任档位的退款上限。stance 特判优先，部分责任受 reason 档位约束。 */
function capFor(stance: Responsibility, reason: DisputeReason): number {
  if (stance === "responder-full") return 100;
  if (stance === "demander") return 0;
  const v = autoVerdict(reason);
  if (v.money.type === "fullrefund") return v.money.pct;
  if (v.money.type === "keep-to-responder") return 0;
  return v.money.type === "negotiate" ? v.money.maxPct : 0; // partial/shared
}

function hitAny(text: string, keys: string[]): boolean {
  return keys.some((k) => text.includes(k));
}

/**
 * 确定性裁判（mock/兜底路径）：
 * 1. 原因档位先行（autoVerdict）；
 * 2. 反驳/硬伤/承诺被否 → 责任升降档；
 * 3. 退款比例按下限 0 到档位上限按责任取整。
 */
export function ruleJudge(input: JudgeInput): VerdictSuggestion {
  const base = autoVerdict(input.reason);
  let stance: Responsibility = base.responsibility;

  const evidence = input.evidence.trim();
  const defense = (input.responderText ?? "").trim();
  const hints = input.promiseHints ?? [];

  if (hitAny(evidence, HARD_HINT)) stance = ESCALATE[stance];
  if (hitAny(defense, SOFT_DEFENSE)) stance = DEESCALATE_ONCE[stance];
  // 承诺存在但证据/反驳含否定词 → 承诺落空，升档。
  if (hints.length > 0 && hitAny(evidence + defense, BROKEN_PROMISE)) {
    if (stance !== "responder-full") stance = ESCALATE[stance];
  }

  const cap = capFor(stance, input.reason);
  let refundPct: number;
  switch (stance) {
    case "responder-full":
      refundPct = 100;
      break;
    case "responder-partial":
      refundPct = Math.round(cap * 0.6);
      break;
    case "shared":
      refundPct = Math.round(cap * 0.5);
      break;
    case "demander":
      refundPct = 0;
      break;
  }
  refundPct = Math.min(refundPct, Math.max(0, cap));

  const amountYuan = Math.round((input.amountYuan * refundPct) / 100);
  const stanceLabel: Record<Responsibility, string> = {
    "responder-full": "响应者全责",
    "responder-partial": "响应者部分责任",
    shared: "双方共担",
    demander: "需求方责任",
  };

  const rationale =
    `${stanceLabel[stance]}：证据「${evidence.slice(0, 24)}…」` +
    (defense ? `；响应者辩称「${defense.slice(0, 18)}…」` : "；响应者未回应");

  const replyScript =
    stance === "demander"
      ? `已核对双方陈述，本次责任在需求方（${input.reason}）。订单款项按约定归服务方。如仍有异议可在证据补充后复议。`
      : `经小法官比对：${stanceLabel[stance]}，建议赔付 ¥${amountYuan}（${refundPct}%）。` +
        (refundPct > 0 ? `款项将优先从争议金/鸽金中划扣。` : "本次无需赔付。") +
        `如对裁定有异议，可在 48 小时内申诉复议。`;

  return {
    stance,
    refundPct,
    amountYuan,
    rationale,
    replyScript,
    confidence: 0.9,
    source: "rules",
  };
}

/** 解析 LLM 响应（毒丸围栏）：非法字段丢弃 → 回落档位。 */
export function normalizeLlmSuggestion(
  raw: string,
  input: JudgeInput
): VerdictSuggestion | null {
  let data: {
    stance?: unknown;
    refundPct?: unknown;
    rationale?: unknown;
    replyScript?: unknown;
    confidence?: unknown;
  };
  try {
    data = JSON.parse(raw) as typeof data;
  } catch {
    return null;
  }
  const stances: Responsibility[] = [
    "responder-full",
    "responder-partial",
    "demander",
    "shared",
  ];
  if (typeof data.stance !== "string" || !stances.includes(data.stance as Responsibility))
    return null;
  if (typeof data.refundPct !== "number" || Number.isNaN(data.refundPct)) return null;

  const base = ruleJudge(input);
  const stance = data.stance as Responsibility;
  const cap = capFor(stance, input.reason);
  const refundPct = Math.min(100, Math.max(0, Math.round(data.refundPct)));
  const clamped = Math.min(refundPct, cap);
  const amountYuan = Math.round((input.amountYuan * clamped) / 100);

  return {
    stance,
    refundPct: clamped,
    amountYuan,
    rationale:
      typeof data.rationale === "string" && data.rationale.length > 0
        ? data.rationale.slice(0, 160)
        : base.rationale,
    replyScript:
      typeof data.replyScript === "string" && data.replyScript.length > 0
        ? data.replyScript.slice(0, 220)
        : base.replyScript,
    confidence:
      typeof data.confidence === "number"
        ? Math.min(1, Math.max(0, data.confidence))
        : 0.8,
    source: "llm",
  };
}