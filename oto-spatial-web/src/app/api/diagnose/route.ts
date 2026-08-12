import { NextResponse } from "next/server";
import { mockDiagnose, type DiagnosisAdvice } from "@/lib/diagnostic";
import { completeText } from "@/lib/gateway/engine";

/**
 * S2 AI 主动诊断 — POST { id, budget, basics, customs, negotiable, createdAt }
 * → { advice: DiagnosisAdvice[] }.
 *
 * 薄层（ADR-0005）：prompt/解析/mock 兜底留在业务层，provider 链与配额
 * 走 Gateway（diagnose 任务，zhipu JSON 稳定优先）。任何上游失败 → 本地
 * 规则引擎，需求方始终拿到可执行建议。
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

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as Partial<DiagnosePayload>;

  // Fresh waves are not diagnosable — nothing to advise yet.
  if (!payload.id || !payload.budget || !payload.basics) {
    return NextResponse.json({ advice: [] });
  }

  const prompt = DIAGNOSE_PROMPT(JSON.stringify(payload));

  const outcome = await completeText({
    task: "diagnose",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    maxTokens: 1024,
    timeoutMs: 10_000,
  });
  if (outcome.ok) {
    const advice = parseAdvice(outcome.content);
    if (advice.length > 0) {
      return NextResponse.json({ advice, source: outcome.provider });
    }
  }

  // Deterministic local rule engine.
  const advice = mockDiagnose(payload as Required<DiagnosePayload>);
  return NextResponse.json({ advice, source: "mock" });
}