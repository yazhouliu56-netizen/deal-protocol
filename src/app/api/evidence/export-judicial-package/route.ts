import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getSupabase } from "@/lib/supabase-client";
import { buildJudicialPackage } from "@/base/safe/evidence-chain";

export const GET = withAuth(async (request: Request, _user) => {
  try {
    const { searchParams } = new URL(request.url);
    const disputeId = searchParams.get("disputeId");

    if (!disputeId) {
      return NextResponse.json({ error: "缺少 disputeId 参数" }, { status: 400 });
    }

    const supabase = getSupabase();

    // 方向 1 接线 A②（数据面断裂修复）：真实争议行由 orders/[id] PATCH 写入
    // `disputes` 表（contract_id 关联）；013 的 order_disputes 是 admin 仲裁表
    // （键 order_id、无 channel/llm_verdict 列）——故先按 contract_id 取最新争议，
    // 未命中再回落 order_disputes.id 直查（兼容 admin 侧建单）。
    let dispute: Record<string, unknown> | null = null;
    const runtimeRes = await supabase
      .from("disputes")
      .select("*")
      .eq("contract_id", disputeId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (runtimeRes.data && runtimeRes.data.length > 0) {
      dispute = runtimeRes.data[0] as Record<string, unknown>;
    } else {
      const byId = await supabase.from("disputes").select("*").eq("id", disputeId).single();
      if (byId.data) {
        dispute = byId.data as Record<string, unknown>;
      } else {
        const adminRes = await supabase
          .from("order_disputes")
          .select("*")
          .eq("id", disputeId)
          .single();
        dispute = (adminRes.data as Record<string, unknown> | null) ?? null;
      }
    }

    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    const orderId = String(dispute.order_id ?? dispute.contract_id ?? disputeId);

    const [evidenceRes, protocolRes, contractRes] = await Promise.all([
      supabase.from("evidence_log").select("*").eq("order_id", orderId).order("created_at", { ascending: true }),
      supabase.from("protocols").select("*").eq("id", orderId).maybeSingle(),
      supabase.from("contracts").select("customer_id, provider_id").eq("id", orderId).single(),
    ]);

    // 当事人精确匹配（批次 3b 修复：原 users.limit(2) 盲取全表前两行的严重缺陷）
    const contract = contractRes.data as Record<string, unknown> | null;
    const partyIds = Array.from(
      new Set([contract?.customer_id, contract?.provider_id].filter(Boolean) as string[]),
    );
    const usersRes = partyIds.length
      ? await supabase
          .from("users")
          .select("id, phone, verification_real_name, verification_id_number")
          .in("id", partyIds)
      : { data: [] };

    // 按争议双方次序装配（需求方在前），仅保留命中当事人身份的记录
    const userRows = (usersRes.data ?? []) as Array<Record<string, unknown>>;
    const parties = partyIds.map((pid) => {
      const u = userRows.find((row) => row.id === pid);
      return {
        userId: pid,
        phone: (u?.phone as string | null) ?? null,
        realName: (u?.verification_real_name as string | null) ?? null,
        idNumber: (u?.verification_id_number as string | null) ?? null,
      };
    });

    const protocol = protocolRes.data as Record<string, unknown> | null;
    const judicialPackage = buildJudicialPackage({
      disputeId,
      orderId,
      status: (dispute.status as string | null) ?? null,
      createdAt: (dispute.created_at as string | null) ?? null,
      protocol: protocol
        ? {
            id: String(protocol.id),
            category: String(protocol.category ?? ""),
            coreFields: protocol.core_fields,
            status: String(protocol.status ?? ""),
            finalPrice: Number(protocol.final_price ?? 0),
            createdAt: String(protocol.created_at ?? ""),
          }
        : null,
      parties,
      evidenceLogs: (evidenceRes.data ?? []) as never,
      compiledAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, judicialPackage });
  } catch (err) {
    return NextResponse.json({ error: (err instanceof Error ? err.message : String(err)) || "导出司法举证包失败" }, { status: 500 });
  }
});
