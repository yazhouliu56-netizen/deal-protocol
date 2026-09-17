import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { voidUnmatchedDemand } from "@/lib/demand/unmatched";

/**
 * P5b 未匹配取消 ＋ P6 已接单取消补偿（用户裁决 2026-09-18）。
 * - OPEN/MATCHED 无人接：CANCELLED＋定制作废（发布费不退／未收作废）；
 * - ASSIGNED/DEPARTED/ARRIVED：3 分钟冷静免费，否则补偿＝预估×基准（未到×1/已到×2），
 *   记应收 comp_due（实收在 escrow 支付时并入，平台零垫付）；
 * - STARTED+：不可取消（走纠纷）。
 */
export const POST = withAuth(async (req, user, ...args) => {
  const { id } = await (args[0] as { params: Promise<{ id: string }> }).params;
  const svc = getServiceClient();

  const { data: demand } = await svc
    .from("demands")
    .select("id, status, demander_id, client_id, customer_id, matched_provider_id, fee_status, city_tier, estimated_arrival_min, assigned_at")
    .eq("id", id)
    .single();
  const d = demand as {
    id: string; status: string; demander_id: string; client_id: string;
    customer_id: string; matched_provider_id: string | null; fee_status?: string;
    city_tier?: number; estimated_arrival_min?: number | null; assigned_at?: string | null;
  } | null;
  if (!d) return NextResponse.json({ error: "需求不存在" }, { status: 404 });
  const isOwner = d.demander_id === user.id || d.client_id === user.id || d.customer_id === user.id;
  if (!isOwner) return NextResponse.json({ error: "仅发单方可取消" }, { status: 403 });

  // 未匹配：P5b 作废路径。
  if (!d.matched_provider_id && (d.status === "OPEN" || d.status === "MATCHED")) {
    const { error } = await svc
      .from("demands")
      .update({ status: "CANCELLED" })
      .eq("id", id)
      .in("status", ["OPEN", "MATCHED"]);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const r = await voidUnmatchedDemand(svc, { id, fee_status: d.fee_status });
    return NextResponse.json({ success: true, customRefunded: r.customRefunded, compensation: 0 });
  }

  // 已接单：P6 补偿路径（STARTED+ 不可取消）。
  if (d.status !== "ASSIGNED" && d.status !== "DEPARTED" && d.status !== "ARRIVED") {
    return NextResponse.json(
      { error: "ORDER_CANCEL_NOT_ALLOWED", message: "当前状态不可取消（开工后走纠纷）" },
      { status: 409 },
    );
  }

  const { computeCompensation } = await import("@/base/cancel/compensation");
  const { getConfig } = await import("@/lib/platform/config");
  const cfg = await getConfig();
  const tier = d.city_tier === 1 ? "tier1" : d.city_tier === 3 ? "tier3" : "tier2";
  const bench = cfg.fees.cancelBenchmark?.[tier] ?? { twoWheel: 30, fourWheel: 70, etaMin: 25 };
  // 交通工具按师傅档案（缺席回落两轮）。
  const { data: prof } = await svc
    .from("profiles")
    .select("vehicle")
    .eq("id", d.matched_provider_id)
    .single();
  const vehicle = (prof as { vehicle?: string } | null)?.vehicle === "fourWheel" ? "fourWheel" : "twoWheel";
  const comp = computeCompensation({
    assignedAtMs: d.assigned_at ? Date.parse(d.assigned_at) : Date.now(),
    cancelAtMs: Date.now(),
    etaMin: d.estimated_arrival_min ?? bench.etaMin,
    hourlyRate: vehicle === "fourWheel" ? bench.fourWheel : bench.twoWheel,
    arrived: d.status === "ARRIVED",
  });

  const { error: cancelError } = await svc
    .from("demands")
    .update({
      status: "CANCELLED",
      // 应收记账（实收在 escrow 支付时并入；平台零垫付）。
      comp_due: comp.amount,
    })
    .eq("id", id)
    .in("status", ["ASSIGNED", "DEPARTED", "ARRIVED"]);
  if (cancelError) return NextResponse.json({ error: cancelError.message }, { status: 500 });

  // 定制行同步作废（溢价未发生；平台 1 元/项按"已匹配取消不退"保留应收）。
  await voidUnmatchedDemand(svc, { id, fee_status: d.fee_status }, { keepFees: true });

  return NextResponse.json({
    success: true,
    compensation: comp.amount,
    free: comp.free,
    arrived: d.status === "ARRIVED",
  });
});
