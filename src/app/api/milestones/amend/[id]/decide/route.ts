import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { MilestoneRowError } from "@/lib/milestone/rows";
import { decideStageAmendment } from "@/lib/milestone/amend";

/**
 * 改期裁决（C 全功能 M6）：仅对方当事方可批（自批 403）。
 * 接受 → 复核无在途验收 → 删未放款行 → 按合同额重切建行。
 * POST /api/milestones/amend/[id]/decide { accept: boolean }
 */
export const POST = withAuth(
  async (request: Request, user, ...rest: unknown[]) => {
    const { id: proposalId } = await (
      rest[0] as { params: Promise<{ id: string }> }
    ).params;
    if (!proposalId) {
      return NextResponse.json({ error: "缺少提案 id" }, { status: 400 });
    }
    let accept: unknown;
    try {
      accept = (await request.json().catch(() => ({})) as { accept?: unknown }).accept;
    } catch {
      return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
    }
    if (typeof accept !== "boolean") {
      return NextResponse.json({ error: "accept 须为布尔值" }, { status: 400 });
    }
    try {
      const r = await decideStageAmendment(getServiceClient(), proposalId, user.id, accept);
      return NextResponse.json(r);
    } catch (e) {
      if (e instanceof MilestoneRowError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      return NextResponse.json({ error: "改期裁决失败" }, { status: 500 });
    }
  },
);
