import { NextResponse } from "next/server";
import { mockClusterTags } from "@/base/ai/cluster";
import { completeText } from "@/base/ai/gateway/engine";

/**
 * LLM 聚类标签抽取 — POST { category, customs, negotiableNote } →
 * { tags: string[] }.
 *
 * 薄层（ADR-0005）：prompt/解析/mock 兜底留在业务层，provider 链与配额
 * 走 Gateway（cluster 任务，zhipu JSON 稳定优先）。任何上游失败 → mock。
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
  const prompt = CLUSTER_PROMPT(
    JSON.stringify({
      category: payload.category,
      customs: payload.customs,
      negotiableNote: payload.negotiableNote,
    })
  );

  const outcome = await completeText({
    task: "cluster",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    maxTokens: 512,
    timeoutMs: 10_000,
  });
  if (outcome.ok) {
    const tags = parseTags(outcome.content);
    if (tags.length > 0) {
      return NextResponse.json({ tags, source: outcome.provider });
    }
  }

  // Deterministic mock extractor.
  const tags = mockClusterTags(payload);
  return NextResponse.json({ tags, source: "mock" });
}