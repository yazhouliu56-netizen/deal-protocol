import { NextResponse } from "next/server";
import { cacheKey, guardedFetch, llmCache } from "@/lib/chat/llmGuard";

export const runtime = "nodejs";
export const maxDuration = 60;

// Provider chain (free-tier-first): Zhipu GLM-4-Flash → Gemini → error.
// The client (ChatPage) falls back to MockEngine when this returns 503.
const PROVIDERS = [
  {
    name: "zhipu",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    apiKey: process.env.ZHIPU_API_KEY ?? "",
    model: process.env.ZHIPU_MODEL ?? "glm-4-flash",
  },
  {
    name: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },
].filter((p) => p.apiKey);

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
};

interface ChatBody {
  messages?: Array<{ role?: string; content?: unknown }>;
}

/**
 * Server-side proxy with a provider chain: Zhipu GLM-4-Flash first (free,
 * JSON-stable, mainland-reachable), Gemini as fallback, and a final 503 that
 * the client turns into MockEngine degradation. Keeps keys out of the client
 * bundle and streams SSE back.
 *
 * Rate-limit hardening (see llmGuard.ts):
 *  - identical intents are answered from an in-memory cache — zero upstream
 *    cost on repeat asks and retries
 *  - upstream calls are serialized + min-gapped to stay under free-tier RPM
 *  - one bounded 429/5xx retry with jitter instead of failing fast
 */
export async function POST(req: Request) {
  if (PROVIDERS.length === 0) {
    return NextResponse.json(
      { error: "no LLM provider configured (ZHIPU_API_KEY / GEMINI_API_KEY)" },
      { status: 503 }
    );
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

  // 2) Walk the provider chain: first ok response wins; 429/5xx falls
  //    through to the next provider (guardedFetch already retried once).
  let lastStatus = 0;
  let lastDetail = "no providers";
  for (const provider of PROVIDERS) {
    const upstream = await guardedFetch(provider.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.4,
        stream: true,
        // GLM-4.7-Flash hybrid thinking: disable for fast structured replies —
        // reasoning streams waste quota and delay first content.
        ...(provider.name === "zhipu" ? { thinking: { type: "disabled" } } : {}),
      }),
    });

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => "");
      lastStatus = upstream.status;
      lastDetail = `${provider.name} ${upstream.status}: ${text.slice(0, 300)}`;
      // Config errors (401/403/404) are not transient — try the next provider
      // but don't keep retrying inside guardedFetch's serialized gap for this
      // call; a 429/5xx already got one bounded retry there.
      continue;
    }

    if (!upstream.body) {
      lastStatus = 502;
      lastDetail = `${provider.name}: no stream body`;
      continue;
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

  return NextResponse.json({ error: lastDetail || `upstream ${lastStatus}` }, { status: lastStatus || 503 });
}
