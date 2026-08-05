import { NextResponse } from "next/server";
import { mockClusterTags } from "@/lib/cluster";

/**
 * LLM 聚类标签抽取 — POST { category, customs, negotiableNote } →
 * { tags: string[] }.
 *
 * Provider chain: Zhipu GLM-4-Flash (free, JSON-stable) → Gemini → the
 * deterministic mock extractor. The store calls this fire-and-forget after
 * publishing a signal wave, so any upstream failure degrades gracefully.
 */

const CLUSTER_PROMPT = (
  payload: string
) => `你是 OTO 本地服务聚类引擎。从一条用户需求里抽取"语义标签"（最多 8 个，每个 2-6 个中文字，服务品类/对象/场景/能力关键词），用于把需求匹配给具备相应能力的响应者。

需求 JSON（category 品类 / customs 定制条件 / negotiableNote 磋商留言）：
${payload}

只输出 JSON：{"tags":["上门做饭","30岁生日","晚餐"]}
不要 markdown 代码围栏，不要其他文字。`;

interface ClusterPayload {
  category: string;
  customs?: Array<{ text: string; tags?: string[] }>;
  negotiableNote?: string;
}

function parseTags(text: string): string[] {
  try {
    const data = JSON.parse(text) as { tags?: unknown };
    if (Array.isArray(data.tags)) {
      return data.tags
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);
    }
  } catch {
    // fall through to mock
  }
  return [];
}

/** OpenAI-compatible chat completion (Zhipu v4 / Gemini v1beta both speak it). */
async function openAiTags(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<string[]> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 512,
      // GLM-4.7-Flash is a hybrid-thinking model: with thinking enabled the
      // final answer lands in `content` only at stream end and non-stream
      // replies can come back with an empty content — disable it for the
      // small structured-extraction task so the JSON is returned directly.
      ...(endpoint.includes("bigmodel.cn") ? { thinking: { type: "disabled" } } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseTags(data.choices?.[0]?.message?.content ?? "");
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as ClusterPayload;
  const prompt = CLUSTER_PROMPT(
    JSON.stringify({
      category: payload.category,
      customs: payload.customs,
      negotiableNote: payload.negotiableNote,
    })
  );

  // 1) Zhipu GLM-4-Flash first (free + mainland-reachable).
  if (process.env.ZHIPU_API_KEY) {
    try {
      const tags = await openAiTags(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        process.env.ZHIPU_API_KEY,
        process.env.ZHIPU_MODEL ?? "glm-4-flash",
        prompt
      );
      if (tags.length > 0) return NextResponse.json({ tags, source: "zhipu" });
    } catch {
      // fall through
    }
  }

  // 2) Gemini (v1beta OpenAI-compatible endpoint).
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  if (geminiKey) {
    try {
      const tags = await openAiTags(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        geminiKey,
        geminiModel,
        prompt
      );
      if (tags.length > 0) return NextResponse.json({ tags, source: "gemini" });
    } catch {
      // fall through
    }
  }

  // 3) Deterministic mock extractor.
  const tags = mockClusterTags(payload);
  return NextResponse.json({ tags, source: "mock" });
}
