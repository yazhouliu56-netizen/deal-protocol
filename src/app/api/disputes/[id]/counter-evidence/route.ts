import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { canSubmitCounterEvidence } from "@/lib/dispute/counter-evidence";

/**
 * 被发起侧反驳举证（ADR-0021 后续根本解决 · 用户裁决 2026-09-23）。
 *
 * POST /api/disputes/[id]/counter-evidence { evidence } —
 * 写入 disputes.responder_evidence（发起侧用开争议的 evidence 列，
 * 哪一侧提交的就是哪一侧的）。非空即转人工（resolver 实读进门禁）。
 * RLS 零策略继承：service 直写；侧归属由本路由强制（当事方＋非发起侧＋OPEN）。
 */
export const POST = withAuth(
  async (request: Request, user, ...rest: unknown[]) => {
    const { id: disputeId } = await (
      rest[0] as { params: Promise<{ id: string }> }
    ).params;
    if (!disputeId) {
      return NextResponse.json({ error: "缺少争议 id" }, { status: 400 });
    }

    let evidence: unknown;
    try {
      evidence = (await request.json() as { evidence?: unknown })?.evidence;
    } catch {
      return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
    }
    if (evidence == null || (typeof evidence === "string" && evidence.trim() === "")) {
      return NextResponse.json({ error: "举证内容不能为空" }, { status: 400 });
    }

    const svc = getServiceClient();
    const { data: dispute } = await svc
      .from("disputes")
      .select("id, initiator_id, contract_id, status")
      .eq("id", disputeId)
      .single();
    const d = dispute as {
      id?: string; initiator_id?: string; contract_id?: string; status?: string;
    } | null;
    if (!d?.id) {
      return NextResponse.json({ error: "争议不存在" }, { status: 404 });
    }

    const { data: contract } = await svc
      .from("contracts")
      .select("customer_id, provider_id")
      .eq("id", d.contract_id)
      .single();
    const c = contract as { customer_id?: string; provider_id?: string } | null;
    if (!c?.customer_id || !c?.provider_id) {
      return NextResponse.json({ error: "关联合同不存在" }, { status: 404 });
    }

    const verdict = canSubmitCounterEvidence({
      callerId: user.id,
      initiatorId: d.initiator_id ?? "",
      customerId: c.customer_id,
      providerId: c.provider_id,
      status: d.status ?? "",
    });
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.code }, { status: verdict.status });
    }

    // CAS：仅 OPEN 行可写（并发结案胜出即 409 语义由 0 行更新表达）。
    const { data: updated, error: updateError } = await svc
      .from("disputes")
      .update({ responder_evidence: evidence as never })
      .eq("id", disputeId)
      .eq("status", "OPEN")
      .select("id");
    if (updateError || !updated || (updated as unknown[]).length === 0) {
      return NextResponse.json(
        { error: "举证失败：争议已不在待举证状态" },
        { status: 409 },
      );
    }

    return NextResponse.json({ submitted: true });
  },
);
