import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";

export const dynamic = "force-dynamic";

/**
 * 服务端权威订单创建（Step 2 核心接电 · P0-A）。
 *
 * POST /api/orders/publish
 * 客户端 payWave/publishWave 支付捕获成功后调用 —— 「支付完成 = PUBLISHED」，
 * 未支付的 pending 态是纯 UI 态不入权威库（红线 2 六态封闭）。
 *
 * 幂等：order_no 全局唯一 —— 同号重复提交返回既有行（idempotent:true），
 * 离线队列重放零副作用（红线 5）。
 * 写入走 service role 绕 RLS；UI 层永不直写 orders（红线 1 隔离墙）。
 */

interface PublishBody {
  /** 客户端 wave.id（天然幂等键，免 ID 映射）。 */
  orderNo: string;
  userId: string;
  providerId?: string;
  categoryCode: string;
  ammoId?: string;
  kind?: "solo" | "open";
  /** 金额单位：分（Cents/INT，全库统一）。 */
  totalAmountCents: number;
  payableAmountCents: number;
  targetLng?: number;
  targetLat?: number;
  addressDetail?: string;
  bizParams?: Record<string, unknown>;
  splitPlan?: Record<string, unknown>;
}

export async function POST(request: Request) {
  let body: PublishBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const {
    orderNo,
    userId,
    providerId,
    categoryCode,
    ammoId,
    kind = "solo",
    totalAmountCents,
    payableAmountCents,
    targetLng = 0,
    targetLat = 0,
    addressDetail = "",
    bizParams = {},
    splitPlan = {},
  } = body ?? {};

  if (!orderNo || !userId || !categoryCode) {
    return NextResponse.json(
      { error: "missing-required-fields", required: ["orderNo", "userId", "categoryCode"] },
      { status: 400 },
    );
  }
  if (
    !Number.isInteger(totalAmountCents) ||
    !Number.isInteger(payableAmountCents) ||
    totalAmountCents < 0 ||
    payableAmountCents < 0
  ) {
    return NextResponse.json(
      { error: "amount-must-be-non-negative-int-cents" },
      { status: 400 },
    );
  }

  const db = getServiceClient();

  // 幂等闸门：order_no 已存在 → 直接返回既有权威行（零副作用重放）
  const existing = await db
    .from("orders")
    .select("*")
    .eq("order_no", orderNo)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json({ idempotent: true, order: existing.data });
  }

  const insertRow = {
    order_no: orderNo,
    user_id: userId,
    provider_id: providerId ?? null,
    category_code: categoryCode,
    ammo_id: ammoId ?? null,
    kind,
    status: "PUBLISHED",
    version: 0,
    total_amount: totalAmountCents,
    discount_amount: totalAmountCents - payableAmountCents,
    payable_amount: payableAmountCents,
    target_lng: targetLng,
    target_lat: targetLat,
    address_detail: addressDetail,
    biz_params: bizParams,
    split_plan_json: splitPlan,
  };

  const inserted = await db.from("orders").insert(insertRow).select("*").single();
  if (inserted.error) {
    // 并发同号插入竞态：唯一约束兜底幂等 → 回读既有行
    const race = await db.from("orders").select("*").eq("order_no", orderNo).maybeSingle();
    if (race.data) return NextResponse.json({ idempotent: true, order: race.data });
    return NextResponse.json(
      { error: "publish-failed", detail: inserted.error.message },
      { status: 500 },
    );
  }

  // 初始审计条目（PUBLISHED 为原子态起点，非跃迁 —— from=to 记录开单事实）
  await db.from("order_state_logs").insert({
    order_no: orderNo,
    from_state: "PUBLISHED",
    to_state: "PUBLISHED",
    version_at_trans: 0,
    operator_type: "system",
    operator_id: "orders-publish-api",
    transition_reason: "ORDER_PUBLISHED_AFTER_PAYMENT_CAPTURE",
  });

  return NextResponse.json({ idempotent: false, order: inserted.data }, { status: 201 });
}
