import { NextResponse } from "next/server";
import { mockDecompose } from "@/base/ai/decompose";
import { completeText } from "@/adapters/ai/gateway/engine";
import { configureLlmCompleteText } from "@/base/ai/llm-port";

configureLlmCompleteText(completeText);

/**
 * LLM 任务拆解 — POST { category, time, note, budget } →
 * { modules: [{ name, acceptance, weight }], source }.
 *
 * 薄层（ADR-0005）：prompt/解析/权重归一/mock 兜底留在业务层，provider
 * 链与配额走 Gateway（decompose 任务，zhipu JSON 稳定优先）。
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

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as DecomposePayload;
  const prompt = DECOMPOSE_PROMPT(
    JSON.stringify({
      category: payload.category,
      time: payload.time,
      note: payload.note,
    })
  );

  const outcome = await completeText({
    task: "decompose",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    maxTokens: 1024,
    timeoutMs: 15_000,
  });
  if (outcome.ok) {
    const normalized = normalizeWeights(parseModules(outcome.content));
    if (normalized.length >= 2) {
      return NextResponse.json({ modules: normalized, source: outcome.provider });
    }
  }

  // Deterministic mock splitter.
  const modules = mockDecompose({
    category: payload.category,
    note: payload.note,
    budget: payload.budget,
  });
  return NextResponse.json({ modules, source: "mock" });
}