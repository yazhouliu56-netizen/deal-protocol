import { getServiceClient } from "@/lib/supabase-client";
import {
  objectiveGoodRate,
  toPunctualFlags,
  type DualRate,
} from "@/base/trust/bayesian-rating";

/**
 * 批量客观率（R7 · 用户裁决 2026-09-18）。
 *
 * 派生口径（R6 口径复用）：完工单（COMPLETED/SATISFACTION_HELD/SETTLED）计入，
 * 有 sla_breach 事件记迟到；纠纷/取消/退款不计入。
 *
 * 鉴权说明：contracts SELECT 限当事方/管理员（RLS），服务端派单与聚合展示
 * 必须走 service client；出境的只有聚合（rate＋n），无逐单明细（宪法 #8）。
 * 任一步失败回空 Map，调用方乘子回落 1.0（宪法 #10）。
 */
export async function getObjectiveRates(
  providerIds: string[],
): Promise<Map<string, DualRate>> {
  const out = new Map<string, DualRate>();
  const ids = [...new Set(providerIds)].filter(Boolean);
  if (ids.length === 0) return out;
  try {
    const supabase = getServiceClient();
    const done = await supabase
      .from("contracts")
      .select("id, provider_id")
      .in("provider_id", ids)
      .in("fund_status", ["COMPLETED", "SATISFACTION_HELD", "SETTLED"]);
    if (done.error) throw done.error;
    const rows = (done.data ?? []) as { id: string; provider_id: string }[];
    if (rows.length === 0) return out;

    const breached = await supabase
      .from("contract_events")
      .select("contract_id")
      .in(
        "contract_id",
        rows.map((c) => c.id),
      )
      .eq("action", "sla_breach");
    if (breached.error) throw breached.error;
    const breachedIds = new Set(
      ((breached.data ?? []) as { contract_id: string }[]).map((e) => e.contract_id),
    );

    const byProvider = new Map<string, { completed: boolean; breached: boolean }[]>();
    for (const c of rows) {
      const arr = byProvider.get(c.provider_id) ?? [];
      arr.push({ completed: true, breached: breachedIds.has(c.id) });
      byProvider.set(c.provider_id, arr);
    }
    for (const [pid, flags] of byProvider) {
      out.set(pid, objectiveGoodRate(toPunctualFlags(flags)));
    }
  } catch (e) {
    console.warn("[objective-rate] batch skipped:", e instanceof Error ? e.message : e);
  }
  return out;
}
