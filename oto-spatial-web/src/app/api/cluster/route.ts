import { NextResponse } from "next/server";
import { mockClusterTags } from "@/lib/cluster";

/**
 * LLM 聚类标签抽取 — POST { category, customs, negotiableNote } →
 * { tags: string[] }.
 *
 * Uses the Gemini API when GEMINI_API_KEY is set (server-only), otherwise
 * falls back to the deterministic mock extractor. The store calls this
 * fire-and-forget after publishing a signal wave.
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

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as ClusterPayload;
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  if (apiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: CLUSTER_PROMPT(
                      JSON.stringify({
                        category: payload.category,
                        customs: payload.customs,
                        negotiableNote: payload.negotiableNote,
                      })
                    ),
                  },
                ],
              },
            ],
            generationConfig: { temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const text =
          data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const tags = parseTags(text);
        if (tags.length > 0) return NextResponse.json({ tags });
      }
    } catch {
      // fall through to mock
    }
  }

  const tags = mockClusterTags(payload);
  return NextResponse.json({ tags, source: "mock" });
}