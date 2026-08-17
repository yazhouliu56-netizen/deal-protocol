/**
 * 漏洞二闭环 · 三维解耦信用雷达引擎（BCS / PQS / ESF 纯函数评定）。
 *
 * 与单维 trustScore 解耦并存：三维分独立评定、垂直技能分按类目隔离，
 * 信用飞轮兑换（押金折抵）仅允许弹药 creditWaiverRule 声明的单一维度——
 * 杜绝「BCS 满分跨类目通兑」「守时分冒充技能分」两类信用错位套利。
 *
 * 红线 1：全部判定为确定性纯函数（阈值比较 + 类目精确匹配 + 乘法折抵），
 * 严禁任何概率性 LLM 判断介入准入或免押计算；红线 3：零 UI / Store 依赖。
 */

import type {
  IAmmoDefinition,
  ITriDimensionalCredit,
  ICustomRequirements,
} from "../../types/ammo-schema.ts";

/** 入户/密闭空间类目安全分一票否决阈值（ESF 0-100 分制；弹药可经
 *  workerRequirement.minSafetyScore 收紧，缺省 70）。 */
export const DEFAULT_ESF_GATE = 70;

const isFiniteScore = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 100;
const clampScore = (n: number): number => Math.min(100, Math.max(0, n));

/**
 * 三维信用准入评定（强合规隔离 + 垂直技能隔离）。
 *
 * 判定顺序（一票熔断优先）：
 * 1. **强合规隔离**：弹药挂载 IMPACT（碰炸：入户/高财产）或 PROXIMITY
 *    （近炸：密闭空间/人身风险）引信时，强制核验公安核验 + ESF 安全分；
 *    任一不达标 → 一票熔断（BCS 满分、PQS 满分也拒绝），reason 明确标注；
 * 2. **垂直技能隔离**：目标类目必须存在对应 PQS（pqsScores[ammo.category]），
 *    且 ≥ 弹药准入线（workerRequirement?.minSafetyScore ?? 60）——技能分
 *    按类目精确匹配，绝不跨类目通兑（组局守时分不能当作家政技能分）；
 * 3. **通用底线**：BCS ≥ 50（全类目通用履约底线，低于底线连移动轻履约也拒绝）。
 */
export function evaluateTriCreditAdmission(
  credit: ITriDimensionalCredit,
  ammo: IAmmoDefinition,
  custom?: ICustomRequirements,
): { isAdmitted: boolean; reason?: string } {
  /**
   * 阶段3 定制年龄硬门禁（一票熔断，置于信用校验之前）：
   * 需求方声明 customRequirements.ageRange 且服务者画像带 age 时，
   * 实龄不在 [minAge, maxAge] 内 → 直接拒绝（AGE_MISMATCH）。
   * 年龄未知（age 缺省）或未声明 ageRange → 跳过（零误杀兼容既有调用）。
   */
  if (custom?.ageRange && typeof credit.age === "number") {
    const [lo, hi] = custom.ageRange;
    if (credit.age < lo || credit.age > hi) {
      return {
        isAdmitted: false,
        reason: `tri-credit-blocked: age ${credit.age} not in [${lo}, ${hi}] (AGE_MISMATCH 定制年龄硬门禁)`,
      };
    }
  }
  if (
    !isFiniteScore(credit.bcsScore) ||
    !isFiniteScore(credit.esfScore)
  ) {
    return { isAdmitted: false, reason: "tri-credit-invalid: score out of 0-100" };
  }
  const fuzeTypes = ammo.fuzePolicy?.fuzeTypes ?? [];
  const requiresStrongGate =
    fuzeTypes.includes("IMPACT") || fuzeTypes.includes("PROXIMITY");
  if (requiresStrongGate) {
    const esfGate = ammo.workerRequirement?.minSafetyScore ?? DEFAULT_ESF_GATE;
    if (!credit.isPoliceVerified) {
      return {
        isAdmitted: false,
        reason: `tri-credit-blocked: police-verification-required (${ammo.ammoId} 挂载 ${fuzeTypes.join("/")} 引信，公安无犯罪核验一票否决)`,
      };
    }
    if (credit.esfScore < esfGate) {
      return {
        isAdmitted: false,
        reason: `tri-credit-blocked: esf-score ${credit.esfScore} < gate ${esfGate} (强合规类目 ESF 一票熔断)`,
      };
    }
  }
  if (credit.bcsScore < 50) {
    return {
      isAdmitted: false,
      reason: `tri-credit-blocked: bcs-score ${credit.bcsScore} < 50 (通用履约底线)`,
    };
  }
  const pqs = credit.pqsScores[ammo.category];
  const pqsGate = ammo.workerRequirement?.minSafetyScore ?? 60;
  if (pqs === undefined || !Number.isFinite(pqs) || pqs < pqsGate) {
    return {
      isAdmitted: false,
      reason: `tri-credit-blocked: pqs[${ammo.category}] ${
        pqs === undefined ? "missing" : pqs
      } < gate ${pqsGate} (垂直技能按类目隔离，禁止跨类目通兑)`,
    };
  }
  return { isAdmitted: true };
}

/**
 * 定向押金折抵计算（合规定向 · 防跨维度滥用）。
 *
 * 仅按弹药 creditWaiverRule 声明的**单一信用维度**折抵押金：
 * - allowedCreditDimension = 'SAFETY_BACKGROUND' → 按 esfScore（安全分）
 *   在 maxWaiverPercentage 上限内折抵；
 * - allowedCreditDimension = 'PUNCTUALITY' → 按 bcsScore（通用履约分，
 *   守时履约是 BCS 的主成分）折抵；
 * - 其余维度（SKILL_LEVEL / ASSET_REPUTATION）或未声明规则 → 零折抵
 *   （保守兜底，绝不允许跨维度通兑）。
 *
 * 折抵线性映射：折抵比例 = 对应维度分 / 100 × maxWaiverPercentage（取整到分）。
 * 守恒：requiredDeposit + waivedDeposit ≡ baseDeposit（不含第三方补偿）。
 */
export function evaluateDepositWaiver(
  credit: ITriDimensionalCredit,
  ammo: IAmmoDefinition,
  baseDepositYuan: number,
): { waivedDepositYuan: number; requiredDepositYuan: number } {
  const base = Number.isFinite(baseDepositYuan) && baseDepositYuan > 0
    ? Math.round(baseDepositYuan * 100) / 100
    : 0;
  if (base === 0) return { waivedDepositYuan: 0, requiredDepositYuan: 0 };
  const rule = ammo.creditWaiverRule;
  if (!rule || !Number.isFinite(rule.maxWaiverPercentage)) {
    return { waivedDepositYuan: 0, requiredDepositYuan: base };
  }
  let dimensionScore: number;
  switch (rule.allowedCreditDimension) {
    case "SAFETY_BACKGROUND":
      dimensionScore = clampScore(credit.esfScore);
      break;
    case "PUNCTUALITY":
      dimensionScore = clampScore(credit.bcsScore);
      break;
    default:
      // SKILL_LEVEL / ASSET_REPUTATION：本引擎不开放折抵（保守兜底）
      return { waivedDepositYuan: 0, requiredDepositYuan: base };
  }
  const ratio = Math.min(
    rule.maxWaiverPercentage,
    (dimensionScore / 100) * rule.maxWaiverPercentage,
  );
  const waived = Math.round(base * ratio * 100) / 100;
  return {
    waivedDepositYuan: waived,
    requiredDepositYuan: Math.round((base - waived) * 100) / 100,
  };
}
