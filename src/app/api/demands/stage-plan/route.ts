import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { checkRateLimit, rateLimitResponse, RULE_DEFAULT } from "@/lib/rate-limit";
import { suggestStagePlan } from "@/lib/stages/planner";

/**
 * P7 阶段模板即时生成（用户裁决 2026-09-18：全开＋观察期）。
 * 输入类目＋需求描述（＋预算），返回 AI 阶段划分；前端展示给用户确认、可改，
 * 确认后的 plan 随发单 body.stages 提交（demands 路由校验＋存档）。
 * 新类目观察期（前 30 单运营抽查）为运营动作：source=llm 的批次可按类目审计。
 */
export const POST = withAuth(async (req, user) => {
  const limited = checkRateLimit(`stages:plan:user:${user.id}`, RULE_DEFAULT);
  if (!limited.allowed) return rateLimitResponse(limited.resetAt);

  const body = (await req.json()) as {
    category?: string;
    description?: string;
    amount?: number;
  };
  if (!body.description) {
    return NextResponse.json({ error: "需求描述缺失" }, { status: 400 });
  }
  const result = await suggestStagePlan(body.category ?? "保洁", body.description, body.amount);
  return NextResponse.json(result);
});
