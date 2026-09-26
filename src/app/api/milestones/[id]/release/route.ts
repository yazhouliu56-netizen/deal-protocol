import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { MilestoneRowError, releaseStageRow } from "@/lib/milestone/rows";
import type { Type1SubjectivePass } from "@/base/money/type1-settlement";

/**
 * 阶段放款（C 全功能 M1）：需求方将 SUBMITTED/HELD 行推至 RELEASED
 * ＋师傅钱包即时到账（崩溃重放不双付，RELEASED 重放幂等直返）。
 * POST /api/milestones/[id]/release（body 空，时钟取服务端；
 * M5 body 可带 { pass: { attitude, appearance, restoration } | null }，
 * 缺省 null＝全勾全返；未释勾进平台质管费，不是退客户）。
 */
export const POST = withAuth(
  async (request: Request, user, ...rest: unknown[]) => {
    const { id: rowId } = await (
      rest[0] as { params: Promise<{ id: string }> }
    ).params;
    if (!rowId) {
      return NextResponse.json({ error: "缺少阶段行 id" }, { status: 400 });
    }
    let pass: Type1SubjectivePass | null | undefined;
    try {
      // 形状由 lib 做 INVALID_PASS 硬校验，此处只透传。
      pass = (await request.json().catch(() => ({})) as { pass?: Type1SubjectivePass | null }).pass;
    } catch {
      return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
    }
    try {
      const r = await releaseStageRow(getServiceClient(), rowId, user.id, undefined, { pass: pass ?? null });
      return NextResponse.json(r);
    } catch (e) {
      if (e instanceof MilestoneRowError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      return NextResponse.json({ error: "阶段放款失败" }, { status: 500 });
    }
  },
);
