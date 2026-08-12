import { NextResponse } from "next/server";
import { streamChat } from "@/lib/gateway/engine";

export const runtime = "nodejs";
export const maxDuration = 60;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
};

interface ChatBody {
  messages?: Array<{ role?: string; content?: unknown }>;
}

/**
 * 薄层：body 校验 → Gateway 引擎（ADR-0005 provider 表 + per-provider
 * 配额 + 意图缓存）。行为与旧实现一致：200 SSE 流式 / 503 交客户端
 * MockEngine 降级。
 */
export async function POST(req: Request) {
  let body: ChatBody = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const outcome = await streamChat(messages);
  if (outcome.status !== 200) {
    return NextResponse.json(
      { error: outcome.error || "no LLM provider configured (see providers.ts)" },
      { status: 503 }
    );
  }
  if (outcome.sse !== undefined) {
    return new NextResponse(outcome.sse, { status: 200, headers: SSE_HEADERS });
  }
  return new NextResponse(outcome.stream!, { status: 200, headers: SSE_HEADERS });
}