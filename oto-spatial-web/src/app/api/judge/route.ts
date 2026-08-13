import { NextResponse } from "next/server";
import { completeText } from "@/base/ai/gateway/engine";
import {
  normalizeLlmSuggestion,
  ruleJudge,
  type JudgeInput,
  type VerdictSuggestion,
} from "@/base/ai/judge";

/**
 * 智能争议小法官 · POST { reason, evidence, responderText, amountYuan, promiseHints }
 * → { verdict, source }。
 *
 * LLM 链路（ADR-0005/0008）：gateway 三级降级，prompt 内嵌原因档位上限；
 * 解析失败 / provider 全挂 / 超时 → 回落规则引擎（宪法 #10：永不裸奔）。
 */

const REASON_CAP_LABEL: Record<string, string> = {
  "no-show": "100%",
  "deliverable-missing": "100%",
  late: "60%",
  "result-mismatch": "60%",
  "demander-change": "0%",
  "force-majeure": "50%",
};

const JUDGE_PROMPT = (payload: string) =>
  `你是 OTO 本地服务平台的中立争议小法官。输入包含：官方争议原因 reason、需求方举证 evidence、响应者反驳 responderText、争议金额 amountYuan、聊天中可量化的承诺 promiseHints。

判定规则：
- stance 只能取 "responder-full" | "responder-partial" | "demander" | "shared"；
- refundPct 是建议退款百分比（0-100），且不得超过该 reason 的赔付上限：${JSON.stringify(REASON_CAP_LABEL)}；
- 比对承诺 vs 实际交付，言而无信加重责任；响应者已补救/提前告知可减责；需求方原因不可赔付；
- rationale 一句话摘要（≤60 字），replyScript 是给双方看的裁定话术（安抚 + 结论 + 下一步，≤120 字）。

只输出 JSON：
{"stance":"responder-partial","refundPct":40,"rationale":"承诺全屋 2 小时，实际 40 分钟离场，属部分履约","replyScript":"已比对聊天承诺与现场证据，本次按 40% 赔付 ¥xx。如异议可 48 小时内申诉。","confidence":0.85}
不要 markdown 包裹，不要多余文字。

${payload}`;

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as Partial<JudgeInput>;

  if (!payload.reason || !payload.evidence?.trim() || !Number.isFinite(payload.amountYuan)) {
    return NextResponse.json({ error: "judge.invalid-input" }, { status: 400 });
  }

  const input: JudgeInput = {
    reason: payload.reason,
    evidence: payload.evidence.trim().slice(0, 500),
    responderText: payload.responderText?.trim().slice(0, 300),
    amountYuan: Math.max(0, Math.round(payload.amountYuan ?? 0)),
    promiseHints: Array.isArray(payload.promiseHints)
      ? payload.promiseHints.slice(0, 6).map((h) => String(h))
      : undefined,
  };

  const outcome = await completeText({
    task: "judge",
    messages: [{ role: "user", content: JUDGE_PROMPT(JSON.stringify(input)) }],
    temperature: 0.2,
    maxTokens: 512,
    timeoutMs: 10_000,
  });

  if (outcome.ok) {
    const suggestion = normalizeLlmSuggestion(outcome.content, input);
    if (suggestion) {
      return NextResponse.json({ verdict: suggestion, source: outcome.provider });
    }
  }

  const fallback: VerdictSuggestion = ruleJudge(input);
  return NextResponse.json({ verdict: fallback, source: "mock" });
}