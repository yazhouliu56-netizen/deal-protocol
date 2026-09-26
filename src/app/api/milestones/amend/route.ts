import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { MilestoneRowError } from "@/lib/milestone/rows";
import { listStageAmendments } from "@/lib/milestone/amend";

/**
 * 改期提案列表（C 全功能 M6 · 座舱读口）：版本号倒序，附调用方 canDecide
 * （当事方＋非提议人＋PROPOSED 才可批）。
 * GET /api/milestones/amend?contractId=
 */
export const GET = withAuth(async (request: Request, user) => {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  if (!contractId) {
    return NextResponse.json({ error: "缺少 contractId" }, { status: 400 });
  }
  try {
    const proposals = await listStageAmendments(getServiceClient(), contractId, user.id);
    return NextResponse.json({ proposals });
  } catch (e) {
    if (e instanceof MilestoneRowError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "提案查询失败" }, { status: 500 });
  }
});
