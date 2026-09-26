import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";

/**
 * 里程碑行查询（C 全功能 M2 · 座舱接线读口）。
 *
 * GET /api/milestones?contractId= — 返回该合同阶段行（step_number 升序）。
 * 仅合同当事方（customer/provider）可读；无行返回空数组（座舱不渲染阶梯）。
 */
export const GET = withAuth(async (request: Request, user) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  if (!contractId) {
    return NextResponse.json({ error: "缺少 contractId" }, { status: 400 });
  }

  const svc = getServiceClient();
  const { data: contract } = await svc
    .from("contracts")
    .select("customer_id, provider_id")
    .eq("id", contractId)
    .single();
  const c = contract as { customer_id?: string; provider_id?: string } | null;
  if (!c?.customer_id || !c?.provider_id) {
    return NextResponse.json({ error: "合同不存在" }, { status: 404 });
  }
  if (user.id !== c.customer_id && user.id !== c.provider_id) {
    return NextResponse.json({ error: "仅合同当事方可查看" }, { status: 403 });
  }

  const { data: rows, error } = await svc
    .from("milestone_schedules")
    .select("id, contract_id, title, amount, step_number, status, submitted_at, auto_confirm_at, confirmed_at")
    .eq("contract_id", contractId)
    .order("step_number", { ascending: true });
  if (error) {
    return NextResponse.json({ error: "阶段行查询失败" }, { status: 500 });
  }
  return NextResponse.json({ rows: rows ?? [] });
});
