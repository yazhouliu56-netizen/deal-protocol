import { NextResponse } from "next/server";
import { mockDecompose } from "@/lib/decompose";

/**
 * LLM 任务拆解 — POST { category, time, note, budget } →
 * { modules: [{ name, acceptance, weight }], source }.
 *
 * Turns a fuzzy one-sentence demand ("我要清理整个房间" — too vague) into
 * independent, individually-acceptable task modules with suggested price
 * weights (sum 100%). The demander confirms / edits the list before publish.
 *
 * Provider chain (same as /api/cluster): Zhipu → Gemini → deterministic mock.
 */

const DECOMPOSE_PROMPT = (payload: string) => `你是 OTO 本地服务任务拆解引擎。用户用一句话描述需求，你要把它拆成 2-5 个【相互独立、可单独验收】的任务模块。

要求：
1. 每个模块给出：name（6-12 个中文字）、acceptance（验收标准，如何判断"这模块做完了"，20-50 字）、weight（建议价格权重百分比整数，全部模块权重之和必须恰好为 100）。
2. 模块必须相互独立：每个模块的结果可单独检查，不依赖其他模块先完成（先完成顺序可以，但验收要独立）。
3. 用户描述太笼统（如"清理整个房间"）时，拆成可执行的具体模块（如：全屋表面除尘 → 卫生间深度清洁 → 垃圾清运）。
4. 如果需求天然简单（通马桶、换灯泡），也要拆 2 个模块（到场 + 交付确认），权重可偏向核心执行。
5. 只输出 JSON：{"modules":[{"name":"...","acceptance":"...","weight":60}]}
不要 markdown 代码围栏，不要其他文字。

需求 JSON（category 品类 / time 时间 / note 描述）：
${payload}`;

interface DecomposePayload {
  category: string;
  time?: string;
  note?: string;
  budget: number;
}

function parseModules(text: string): Array<{ name: string; acceptance: string; weight: number }> {
  try {
    const data = JSON.parse(text) as { modules?: unknown };
    if (!Array.isArray(data.modules)) return [];
    return data.modules
      .filter(
        (m): m is { name?: unknown; acceptance?: unknown; weight?: unknown } =>
          !!m && typeof m === "object"
      )
      .map((m) => ({
        name: String(m.name ?? "").trim().slice(0, 20),
        acceptance: String(m.acceptance ?? "").trim().slice(0, 80),
        weight: Math.round(Number(m.weight)),
      }))
      .filter((m) => m.name && m.acceptance && Number.isFinite(m.weight))
      .slice(0, 5);
  } catch {
    return [];
  }
}

/** Normalise LLM weights to exactly 100 (LLMs occasionally drift off). */
function normalizeWeights(
  mods: Array<{ name: string; acceptance: string; weight: number }>
): Array<{ name: string; acceptance: string; weight: number }> {
  if (mods.length === 0) return mods;
  const total = mods.reduce((s, m) => s + Math.max(0, m.weight), 0);
  if (total === 100) return mods;
  if (total <= 0) {
    // degenerate — equal weights
    const w = Math.round(100 / mods.length);
    const rest = 100 - w * mods.length;
    return mods.map((m, i) => ({ ...m, weight: w + (i < rest ? 1 : 0) }));
  }
  let allocated = 0;
  const out = mods.map((m, i) => {
    const w =
      i === mods.length - 1
        ? 100 - allocated
        : Math.round((Math.max(0, m.weight) / total) * 100);
    allocated += w;
    return { ...m, weight: w };
  });
  return out;
}

/** OpenAI-compatible chat completion (Zhipu v4 / Gemini v1beta both speak it). */
async function openAiDecompose(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<Array<{ name: string; acceptance: string; weight: number }>> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1024,
      ...(endpoint.includes("bigmodel.cn") ? { thinking: { type: "disabled" } } : {}),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseModules(data.choices?.[0]?.message?.content ?? "");
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as DecomposePayload;
  const prompt = DECOMPOSE_PROMPT(
    JSON.stringify({
      category: payload.category,
      time: payload.time,
      note: payload.note,
    })
  );

  // 1) Zhipu GLM-4-Flash first (free + mainland-reachable).
  if (process.env.ZHIPU_API_KEY) {
    try {
      const mods = await openAiDecompose(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        process.env.ZHIPU_API_KEY,
        process.env.ZHIPU_MODEL ?? "glm-4-flash",
        prompt
      );
      const normalized = normalizeWeights(mods);
      if (normalized.length >= 2) {
        return NextResponse.json({ modules: normalized, source: "zhipu" });
      }
    } catch {
      // fall through
    }
  }

  // 2) Gemini (v1beta OpenAI-compatible endpoint).
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  if (geminiKey) {
    try {
      const mods = await openAiDecompose(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        geminiKey,
        geminiModel,
        prompt
      );
      const normalized = normalizeWeights(mods);
      if (normalized.length >= 2) {
        return NextResponse.json({ modules: normalized, source: "gemini" });
      }
    } catch {
      // fall through
    }
  }

  // 3) Deterministic mock splitter.
  const modules = mockDecompose({
    category: payload.category,
    note: payload.note,
    budget: payload.budget,
  });
  return NextResponse.json({ modules, source: "mock" });
}