import { NextResponse } from "next/server";
import { cacheKey, guardedFetch, llmCache } from "@/lib/chat/llmGuard";

export const runtime = "nodejs";
export const maxDuration = 60;

const API_KEY = process.env.GEMINI_API_KEY ?? "";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
};

interface ChatBody {
  messages?: Array<{ role?: string; content?: unknown }>;
}

/**
 * Server-side proxy for the Gemini OpenAI-compatible chat completions API.
 * Keeps the API key out of the client bundle and streams SSE back.
 *
 * Rate-limit hardening (see llmGuard.ts):
 *  - identical intents (same last user message, which embeds collected-demand
 *    summary + history) are answered from an in-memory cache — zero upstream
 *    cost on repeat asks and retries
 *  - upstream calls are serialized + min-gapped to stay under free-tier RPM
 *  - one bounded 429/5xx retry with jitter instead of failing fast
 */
export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 503 });
  }

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

  // 1) Intent-level cache hit: replay the stored SSE verbatim.
  const key = cacheKey(messages);
  const cached = key ? llmCache.get(key) : null;
  if (cached) {
    return new NextResponse(cached, { status: 200, headers: SSE_HEADERS });
  }

  // 2) Miss: serialized upstream call with one bounded retry.
  const upstream = await guardedFetch(GEMINI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: 0.4,
      stream: true,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return NextResponse.json(
      { error: `upstream ${upstream.status}: ${text.slice(0, 300)}` },
      { status: upstream.status }
    );
  }

  if (!upstream.body) {
    return NextResponse.json({ error: "no stream body" }, { status: 502 });
  }

  // 3) Pipe the SSE stream through; a tee'd side channel collects the raw
  //    bytes so a later identical intent replays from cache (no upstream call).
  const [passthrough, collector] = upstream.body.tee();
  void (async () => {
    const reader = collector.getReader();
    const decoder = new TextDecoder();
    let sse = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        sse += decoder.decode(value, { stream: true });
      }
      sse += decoder.decode();
      llmCache.set(key, sse);
    } catch {
      /* partial/cancelled stream: skip caching, passthrough already served */
    }
  })();

  return new NextResponse(passthrough, { status: 200, headers: SSE_HEADERS });
}