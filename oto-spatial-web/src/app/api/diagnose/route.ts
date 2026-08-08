import { NextResponse } from "next/server";
import { mockDiagnose, type DiagnosisAdvice } from "@/lib/diagnostic";

/**
 * S2 AI 主动诊断 — POST { id, budget, basics, customs, negotiable, createdAt }
 * → { advice: DiagnosisAdvice[] }.
 *
 * Provider chain (same shape as /api/cluster): Zhipu GLM-4-Flash → Gemini →
 * the deterministic mock engine. Called from MyWaves when an active wave has
 * sat unclaimed past the 2-minute threshold; every failure degrades to the
 * local rule engine, so the demander always gets actionable advice.
 */

const DIAGNOSE_PROMPT = (payload: string) =>
  `你是 OTO 本地服务平台的撮合诊断助手。一条需求发布后超过 2 分钟无人响应，你要给出 1-3 条最可能改善匹配的建议。
每条建议必须包含：kind（"price"|"customs"|"radius" 之一）、title（10 字内标题）、body（30-60 字，中文，具体可执行）、value（建议的具体值，如 "预算 +20%"）。

需求 JSON：
${payload}

只输出 JSON：{"advice":[{"kind":"price","title":"预算可上探一档","body":"同品类未被响应时，加价 20% 通常能跨过响应者的心理门槛。","value":"预算 +20%"}]}
不要 markdown 代码围栏，不要其他文字。`;

interface DiagnosePayload {
  id: string;
  budget: number;
  basics: { category: string; radiusKm: number };
  customs?: Array<{ text: string }>;
  negotiable?: boolean;
  capacity?: number;
  createdAt: number;
}

function parseAdvice(text: string): DiagnosisAdvice[] {
  try {
    const data = JSON.parse(text) as { advice?: unknown };
    if (Array.isArray(data.advice)) {
      return data.advice
        .filter(
          (a): a is DiagnosisAdvice =>
            typeof a === "object" &&
            a !== null &&
            typeof (a as DiagnosisAdvice).kind === "string" &&
            ["price", "customs", "radius"].includes(
              (a as DiagnosisAdvice).kind
            ) &&
            typeof (a as DiagnosisAdvice).title === "string" &&
            typeof (a as DiagnosisAdvice).body === "string"
        )
        .slice(0, 3);
    }
  } catch {
    // fall through to mock
  }
  return [];
}

/** OpenAI-compatible chat completion (Zhipu v4 / Gemini v1beta both speak it). */
async function openAiDiagnose(
  endpoint: string,
  apiKey: string,
  model: string,
  prompt: string
): Promise<DiagnosisAdvice[]> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 1024,
      // GLM hybrid-thinking quirk — see /api/cluster.
      ...(endpoint.includes("bigmodel.cn") ? { thinking: { type: "disabled" } } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return parseAdvice(data.choices?.[0]?.message?.content ?? "");
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as Partial<DiagnosePayload>;

  // Fresh waves are not diagnosable — nothing to advise yet.
  if (!payload.id || !payload.budget || !payload.basics) {
    return NextResponse.json({ advice: [] });
  }

  const prompt = DIAGNOSE_PROMPT(JSON.stringify(payload));

  // 1) Zhipu GLM-4-Flash first (free + mainland-reachable).
  if (process.env.ZHIPU_API_KEY) {
    try {
      const advice = await openAiDiagnose(
        "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        process.env.ZHIPU_API_KEY,
        process.env.ZHIPU_MODEL ?? "glm-4-flash",
        prompt
      );
      if (advice.length > 0)
        return NextResponse.json({ advice, source: "zhipu" });
    } catch {
      // fall through
    }
  }

  // 2) Gemini (v1beta OpenAI-compatible endpoint).
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  if (geminiKey) {
    try {
      const advice = await openAiDiagnose(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        geminiKey,
        geminiModel,
        prompt
      );
      if (advice.length > 0)
        return NextResponse.json({ advice, source: "gemini" });
    } catch {
      // fall through
    }
  }

  // 3) Deterministic local rule engine.
  const advice = mockDiagnose(payload as Required<DiagnosePayload>);
  return NextResponse.json({ advice, source: "mock" });
}