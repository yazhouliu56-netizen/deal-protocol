import { NextResponse } from "next/server";
import { intentPrompt } from "@/base/ai/voice/voiceIntent";
import { jsonChat } from "@/base/ai/gateway/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * L2 语音意图解析：薄层 → Gateway 引擎（voice-intent 任务，智谱 JSON 稳定
 * 优先，Gemini/Groq/OpenRouter 降级）。缺 key/全灭 → 503 → 客户端
 * mockVoiceIntent 本地关键词降级。行为与旧实现一致。
 */
export async function POST(req: Request) {
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 400) {
    return NextResponse.json({ error: "text required (<=400 chars)" }, { status: 400 });
  }

  const outcome = await jsonChat([
    { role: "system", content: intentPrompt() },
    { role: "user", content: text },
  ]);
  if (outcome.status !== 200 || outcome.json === null) {
    return NextResponse.json({ error: outcome.error }, { status: 503 });
  }
  return NextResponse.json({ intent: outcome.json });
}