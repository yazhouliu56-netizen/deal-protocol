/**
 * 阶段划分纯核（P7 · 用户裁决 2026-09-18）。
 *
 * 护栏：阶段数 ≤5；权重为整数且和≡100；标题/验收标准非空。
 * 不满足 → 调用方打回重生（×3）→ 兜底单阶段 100%。
 * 阶段金额 = 总额 × 权重；定制溢价挂钩到具体阶段（调用方按含溢价重算归一）。
 *
 * Pure + unit-testable.
 */

export const STAGE_MAX_COUNT = 5;

export interface StagePlanItem {
  title: string;
  weightPct: number;
  acceptance: string;
}

export function defaultSingleStage(): StagePlanItem[] {
  return [{ title: "整单一次交付", weightPct: 100, acceptance: "按订单要求整体验收" }];
}

/** 校验（返回错误列表，空=通过）。 */
export function validateStagePlan(plan: StagePlanItem[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(plan) || plan.length === 0) {
    return ["阶段计划为空"];
  }
  if (plan.length > STAGE_MAX_COUNT) {
    errors.push(`阶段数 ${plan.length} 超上限 ${STAGE_MAX_COUNT}（单没拆对，请拆单）`);
  }
  let sum = 0;
  plan.forEach((s, i) => {
    if (!s || typeof s.title !== "string" || s.title.trim() === "") {
      errors.push(`第 ${i + 1} 阶段标题缺失`);
    }
    if (!s || typeof s.acceptance !== "string" || s.acceptance.trim() === "") {
      errors.push(`第 ${i + 1} 阶段验收标准缺失`);
    }
    if (!s || !Number.isInteger(s.weightPct) || s.weightPct <= 0) {
      errors.push(`第 ${i + 1} 阶段权重须为正整数`);
    } else {
      sum += s.weightPct;
    }
  });
  if (sum !== 100) {
    errors.push(`权重和=${sum}≠100，拒绝生效`);
  }
  return errors;
}

/** 阶段金额（元，2 位；最大余数法守恒，调用方按总额切分）。 */
export function stageAmounts(total: number, plan: StagePlanItem[]): number[] {
  const cents = Math.round(total * 100);
  const out = new Array(plan.length).fill(0) as number[];
  let assigned = 0;
  const remainders: { i: number; rem: number }[] = [];
  plan.forEach((s, i) => {
    const exact = (cents * s.weightPct) / 100;
    const base = Math.floor(exact);
    out[i] = base;
    assigned += base;
    remainders.push({ i, rem: exact - base });
  });
  let left = cents - assigned;
  remainders.sort((a, b) => b.rem - a.rem);
  for (const r of remainders) {
    if (left <= 0) break;
    out[r.i] += 1;
    left -= 1;
  }
  return out.map((c) => c / 100);
}
