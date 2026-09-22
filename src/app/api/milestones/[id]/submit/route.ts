import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { MilestoneRowError, submitStageRow } from "@/lib/milestone/rows";

/**
 * 阶段交验（C 全功能 M1）：服务方将 PENDING/HELD 行推至 SUBMITTED。
 * POST /api/milestones/[id]/submit（body 空，时钟取服务端）。
 */
export const POST = withAuth(
  async (_request: Request, user, ...rest: unknown[]) => {
    const { id: rowId } = await (
      rest[0] as { params: Promise<{ id: string }> }
    ).params;
    if (!rowId) {
      return NextResponse.json({ error: "缺少阶段行 id" }, { status: 400 });
    }
    try {
      const r = await submitStageRow(getServiceClient(), rowId, user.id);
      return NextResponse.json(r);
    } catch (e) {
      if (e instanceof MilestoneRowError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      return NextResponse.json({ error: "阶段交验失败" }, { status: 500 });
    }
  },
);
