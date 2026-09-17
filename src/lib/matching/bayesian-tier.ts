import { getServiceClient } from "@/lib/supabase-client";
import {
  subjectiveTierScore,
  tierFromBayesianWindow,
  BAYES_FALLBACK_PRIOR,
} from "@/base/trust/bayesian-rating";
import type { CreditSample } from "@/base/trust/credit-window";
import { selectCreditWindow } from "@/base/trust/credit-window";

export interface BayesianTier {
  /** 定档 1–5；null = 样本不足（保护/无窗内单），调用方放行。 */
  tier: number | null;
  /** 终身样本数（审计用）。 */
  n: number;
}

/**
 * 批量贝叶斯定档（B · 用户裁决 2026-09-18，R7 objective-rate 镜像）。
 *
 * 样本口径：完工单（COMPLETED/SATISFACTION_HELD/SETTLED）逐单一样本；
 * 客观轨＝准时 flag（sla_breach 记 0）；主观轨＝客户评价勾数/3，
 * 无评价行主观＝客观（单轨，无评不罚，R5 对齐）；atMs＝updated_at。
 * 先验＝同类目 category_score 滚动均值，无类目数据回落 0.8（R1 锁死）。
 * 保护（终身<3/窗空）→ tier null，调用方放行。
 *
 * 鉴权：service 直读聚合；出境只有 tier＋n，无逐单明细（宪法 #8）。
 * 任一步失败回空 Map（宪法 #10）。
 */
export async function getBayesianTiers(
  providerIds: string[],
  opts: { category?: string; nowMs?: number } = {},
): Promise<Map<string, BayesianTier>> {
  const out = new Map<string, BayesianTier>();
  const ids = [...new Set(providerIds)].filter(Boolean);
  if (ids.length === 0) return out;
  const nowMs = opts.nowMs ?? Date.now();
  try {
    const supabase = getServiceClient();
    const done = await supabase
      .from("contracts")
      .select("id, provider_id, customer_id, updated_at")
      .in("provider_id", ids)
      .in("fund_status", ["COMPLETED", "SATISFACTION_HELD", "SETTLED"]);
    if (done.error) throw done.error;
    const rows = (done.data ?? []) as {
      id: string;
      provider_id: string;
      customer_id: string;
      updated_at: string;
    }[];
    if (rows.length === 0) return out;

    const breached = await supabase
      .from("contract_events")
      .select("contract_id")
      .in("contract_id", rows.map((c) => c.id))
      .eq("action", "sla_breach");
    if (breached.error) throw breached.error;
    const breachedIds = new Set(
      ((breached.data ?? []) as { contract_id: string }[]).map((e) => e.contract_id),
    );

    const byContract = new Map(rows.map((c) => [c.id, c]));
    const reviews = await supabase
      .from("order_reviews")
      .select("contract_id, reviewer_id, passed_count")
      .in("contract_id", rows.map((c) => c.id));
    if (reviews.error) throw reviews.error;
    const subjByContract = new Map<string, number>();
    for (const r of (reviews.data ?? []) as {
      contract_id: string;
      reviewer_id: string;
      passed_count: number | null;
    }[]) {
      const c = byContract.get(r.contract_id);
      if (!c || r.reviewer_id !== c.customer_id) continue;
      if (!Number.isInteger(r.passed_count)) continue;
      try {
        subjByContract.set(r.contract_id, subjectiveTierScore(r.passed_count as number));
      } catch {
        /* 非法勾数行丢弃 */
      }
    }

    const byProvider = new Map<string, CreditSample[]>();
    for (const c of rows) {
      const atMs = Date.parse(c.updated_at);
      if (!Number.isFinite(atMs)) continue;
      const objective01 = breachedIds.has(c.id) ? 0 : 1;
      const arr = byProvider.get(c.provider_id) ?? [];
      arr.push({
        atMs,
        objective01,
        subjective01: subjByContract.get(c.id) ?? objective01,
      });
      byProvider.set(c.provider_id, arr);
    }

    let prior = BAYES_FALLBACK_PRIOR;
    if (opts.category) {
      const avg = await supabase
        .from("credit_records")
        .select("category_score")
        .eq("category", opts.category);
      if (!avg.error) {
        const scores = ((avg.data ?? []) as { category_score: number | null }[])
          .map((r) => Number(r.category_score))
          .filter((s) => Number.isFinite(s));
        if (scores.length > 0) {
          prior = Math.min(1, Math.max(0, scores.reduce((a, b) => a + b, 0) / scores.length / 100));
        }
      }
    }

    for (const [pid, samples] of byProvider) {
      // 保护（终身<3/窗空）→ tier null 放行；prevTier 传中性 3（保护已短路，
      // 非保护分支恒有伪样本，prevTier 实质无用——显式注释防误读）。
      if (selectCreditWindow(samples, nowMs).protected) {
        out.set(pid, { tier: null, n: samples.length });
        continue;
      }
      out.set(pid, { tier: tierFromBayesianWindow(samples, nowMs, prior, 3), n: samples.length });
    }
  } catch (e) {
    console.warn("[bayesian-tier] batch skipped:", e instanceof Error ? e.message : e);
  }
  return out;
}
