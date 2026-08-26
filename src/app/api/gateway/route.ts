import { NextResponse } from "next/server";
import { intentPrompt } from "@/base/ai/voice/voiceIntent";
import { jsonChat, streamChat, completeText } from "@/adapters/ai/gateway/engine";
import { configureLlmCompleteText } from "@/base/ai/llm-port";

configureLlmCompleteText(completeText);
import type { GatewayTask } from "@/adapters/ai/gateway/providers";

export const runtime = "nodejs";
export const maxDuration = 60;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
};

const TASKS: GatewayTask[] = ["chat", "voice-intent"];

/**
 * Gateway 统一入口（ADR-0005）：task 参数分派到流式对话 / 非流式 JSON。
 * - `chat`：POST { task: "chat", messages }
 * - `voice-intent`：POST { task: "voice-intent", text } → { intent }
 * chat 返回 SSE；voice-intent 返回 JSON。
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const task = (body.task as GatewayTask | undefined) ?? "chat";
  if (!TASKS.includes(task)) {
    return NextResponse.json({ error: `unknown task: ${String(task)}` }, { status: 400 });
  }

  if (task === "chat") {
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }
    const outcome = await streamChat(messages);
    if (outcome.status !== 200) {
      return NextResponse.json({ error: outcome.error }, { status: 503 });
    }
    if (outcome.sse !== undefined) {
      return new NextResponse(outcome.sse, { status: 200, headers: SSE_HEADERS });
    }
    return new NextResponse(outcome.stream!, { status: 200, headers: SSE_HEADERS });
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