import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { MilestoneRowError } from "@/lib/milestone/rows";
import { proposeStageAmendment } from "@/lib/milestone/amend";

/**
 * 改期提议（C 全功能 M6）：任一当事方按新权重提案（权重和≡100，≤5 期），
 * 无在途验收方可立项，版本号递增。对方确认见 decide。
 * POST /api/milestones/amend/propose { contractId, stages: [{title, weightPct, acceptance}] }
 */
export const POST = withAuth(async (request: Request, user) => {
  let body: { contractId?: unknown; stages?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }
  if (typeof body.contractId !== "string" || !body.contractId) {
    return NextResponse.json({ error: "缺少 contractId" }, { status: 400 });
  }
  try {
    const r = await proposeStageAmendment(
      getServiceClient(),
      body.contractId,
      user.id,
      (body.stages ?? []) as never,
    );
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof MilestoneRowError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "改期提议失败" }, { status: 500 });
  }
});
