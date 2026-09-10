import { NextResponse } from "next/server";
import { completeText } from "@/adapters/ai/gateway/engine";
import { configureLlmCompleteText } from "@/base/ai/llm-port";
import { sanitizePolishDraft } from "@/base/order/haggle";

configureLlmCompleteText(completeText);

/**
 * 磋商润话术（LLM 贯通式参与 · P3-T1 切片）。
 * POST { draft, priceYuan? } → { polished, source }。
 * 红线定位：纯文本润色，不碰价格/轮次/状态（比 judge 更安全——连建议都不进链）；
 * 发送永远人点（调用方 HaggleTable 只填输入框）。LLM 失败 → 503，调用方保留原文。
 */
const POLISH_PROMPT = (draft: string, priceHint: string) =>
  `你是 O2O 磋商话术助手。把用户的还价留言润色得更得体、更有成交力：礼貌开场 + 明确价格诉求 + 给对方台阶。不改变价格数字，不编造事实，不超过 60 字。只输出润色后正文，不要引号不要解释。\n用户原文：${draft}${priceHint}`;

function sanitizeInput(v: unknown): string | null {
  return sanitizePolishDraft(v);
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    draft?: unknown;
    priceYuan?: unknown;
  };
  const draft = sanitizeInput(body.draft);
  if (!draft) return NextResponse.json({ error: "polish.invalid-input" }, { status: 400 });
  const priceHint =
    typeof body.priceYuan === "number" && Number.isFinite(body.priceYuan) && body.priceYuan > 0
      ? `\n目标价：¥${Math.floor(body.priceYuan)}`
      : "";

  const outcome = await completeText({
    // 复用 chat 任务链（全 provider 支持；润色无专属配额需求，不另开任务名）
    task: "chat",
    messages: [{ role: "user", content: POLISH_PROMPT(draft, priceHint) }],
    temperature: 0.5,
    maxTokens: 256,
    timeoutMs: 10_000,
  });

  const text = outcome.content.trim().replace(/```/g, "");
  if (!outcome.ok || !text) {
    return NextResponse.json({ error: outcome.detail ?? "no LLM provider" }, { status: 503 });
  }
  return NextResponse.json({ polished: text.slice(0, 120), source: outcome.provider ?? "llm" });
}
