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

    const { data: dispute } = await supabase
      .from("order_disputes")
      .select("*")
      .eq("id", disputeId)
      .single();

    if (!dispute) {
      throw new Error(`Dispute not found: ${disputeId}`);
    }

    const orderId = String((dispute as Record<string, unknown>).order_id ?? disputeId);

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
      status: ((dispute as Record<string, unknown>).status as string | null) ?? null,
      createdAt: ((dispute as Record<string, unknown>).created_at as string | null) ?? null,
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
