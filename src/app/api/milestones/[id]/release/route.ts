import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { MilestoneRowError, releaseStageRow } from "@/lib/milestone/rows";

/**
 * 阶段放款（C 全功能 M1）：需求方将 SUBMITTED/HELD 行推至 RELEASED
 * ＋师傅钱包即时到账（崩溃重放不双付，RELEASED 重放幂等直返）。
 * POST /api/milestones/[id]/release（body 空，时钟取服务端）。
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
      const r = await releaseStageRow(getServiceClient(), rowId, user.id);
      return NextResponse.json(r);
    } catch (e) {
      if (e instanceof MilestoneRowError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      return NextResponse.json({ error: "阶段放款失败" }, { status: 500 });
    }
  },
);
