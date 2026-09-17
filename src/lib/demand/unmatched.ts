import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * P5b 匹配失败作废（用户裁决 2026-09-18）。
 * 适用：未匹配取消 / 24h 无人接超时。语义：
 * - 定制行项 → refunded（定制溢价与平台 1 元/项未收则作废；若已收则记退款 memo，
 *   实收退款走 Stripe 原路——paid 状态仅 escrow 后可达，届时已匹配，本函数不触发）；
 * - 发布费：永不退（未收则作废应收；已收不退， ruling）；
 * - fee_status → void；demand → CANCELLED（调用方负责状态机校验）。
 */
export async function voidUnmatchedDemand(
  svc: SupabaseClient,
  demand: { id: string; fee_status?: string },
): Promise<{ customRefunded: number }> {
  const { data: rows } = await svc
    .from("demand_customizations")
    .select("id")
    .eq("demand_id", demand.id)
    .eq("status", "active");
  const ids = ((rows ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length > 0) {
    await svc.from("demand_customizations").update({ status: "refunded" }).in("id", ids);
  }
  await svc.from("demands").update({ fee_status: "void" }).eq("id", demand.id);
  return { customRefunded: ids.length };
}
