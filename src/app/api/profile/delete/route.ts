import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";
import {
  executeCryptoShredding,
  type FinancialLedgerRow,
  type IShreddingCertificate,
  type PiiProfile,
} from "@/base/safe/privacy-erasure";

/**
 * L4-M5 账户注销密态销毁 API（P2 战役第一波攻坚）。
 * DELETE /api/profile/delete —— 校验登录态后执行《个保法》§47 密态销毁管道：
 *  ① 读取用户 Profile PII（实名/手机号/精确坐标）；
 *  ② 读取历史订单财务不可变快照（contracts 对账流水，两侧身份）；
 *  ③ executeCryptoShredding：PII 不可逆覆写（匿名化用户名/掩码手机号/星号身份证/坐标置空），
 *     财务流水原样保留（税务/对账合规），生成 IShreddingCertificate 存证证书；
 *  ④ 匿名 Profile 写回 + deleted_at 标记，返回证书。
 */

export const DELETE = withAuth(async (req, user) => {
  const svc = await getRouteClient();

  const { data: profile } = await svc
    .from("profiles")
    .select("id, phone, nickname, verification_real_name, verification_id_number, current_location")
    .eq("id", user.id)
    .single();

  let lat: number | null = null;
  let lng: number | null = null;
  const loc = profile?.current_location;
  if (loc && typeof loc === "object") {
    const rec = loc as Record<string, unknown>;
    if (typeof rec.lat === "number" && Number.isFinite(rec.lat)) lat = rec.lat;
    if (typeof rec.lng === "number" && Number.isFinite(rec.lng)) lng = rec.lng;
  }

  const pii: PiiProfile = {
    id: profile?.id ?? user.id,
    name: profile?.verification_real_name ?? undefined,
    phone: profile?.phone ?? undefined,
    idNumber: profile?.verification_id_number ?? undefined,
    ...(lat !== null ? { lat } : {}),
    ...(lng !== null ? { lng } : {}),
  };

  const { data: contracts } = await svc
    .from("contracts")
    .select("id, amount, tip_amount, fund_status, created_at")
    .or(`customer_id.eq.${user.id},provider_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  const ledger: FinancialLedgerRow[] = (contracts ?? []).map((c) => ({
    order_no: c.id,
    amount_cents: Math.round((c.amount + (c.tip_amount ?? 0)) * 100),
    split_plan_json: JSON.stringify({ fund_status: c.fund_status ?? "", tip_amount: c.tip_amount ?? 0 }),
    paid_at: new Date(c.created_at).getTime(),
    settlement_status: c.fund_status ?? "",
  }));

  const shredded = executeCryptoShredding({
    userId: user.id,
    profile: pii,
    ledger,
    requestedAt: Date.now(),
    executor: "user:self-delete",
  });

  const anonProfile = shredded.profile;
  const updateData: Record<string, unknown> = {
    nickname: anonProfile.name ?? "已注销用户",
    phone: anonProfile.phone ?? null,
    verification_real_name: null,
    verification_id_number: null,
    verification_certificates: null,
    current_location: null,
    bio: null,
    service_areas: null,
    deleted_at: new Date().toISOString(),
  };
  const { error: updateError } = await svc
    .from("profiles")
    .update(updateData)
    .eq("id", user.id);

  if (updateError) {
    console.warn("[API Profile Delete] anonymize write-back failed:", updateError.message);
    return NextResponse.json({ error: "匿名化写回失败" }, { status: 500 });
  }

  const certificate: IShreddingCertificate = shredded.certificate;
  return NextResponse.json({
    success: true,
    message: "账户已注销，个人敏感信息完成密态销毁；财务对账流水依法保留。",
    certificate,
    retainedLedgerCount: certificate.retainedLedgerCount,
    retainedLedgerAmountCents: certificate.retainedLedgerAmountCents,
  });
});