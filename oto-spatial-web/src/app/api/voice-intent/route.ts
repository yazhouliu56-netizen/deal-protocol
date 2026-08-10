import { NextResponse } from "next/server";
import { intentPrompt } from "@/lib/voice/voiceIntent";

export const runtime = "nodejs";
export const maxDuration = 60;

// L2 语音意图解析：zhipu → gemini 降级链，非流式结构化 JSON。
// 客户端拿到 JSON 后经 parseVoiceIntent 二次校验（本地动作表），
// 缺 key → 503 → 客户端 mockVoiceIntent 本地关键词降级。
const PROVIDERS = [
  {
    name: "zhipu",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    apiKey: process.env.ZHIPU_API_KEY ?? "",
    model: process.env.ZHIPU_MODEL ?? "glm-4.7-flash",
  },
  {
    name: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },
].filter((p) => p.apiKey);

export async function POST(req: Request) {
  if (PROVIDERS.length === 0) {
    return NextResponse.json(
      { error: "no LLM provider configured (ZHIPU_API_KEY / GEMINI_API_KEY)" },
      { status: 503 }
    );
  }

  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > 400) {
    return NextResponse.json({ error: "text required (<=400 chars)" }, { status: 400 });
  }

  let lastDetail = "no providers";
  for (const provider of PROVIDERS) {
    try {
      const res = await fetch(provider.endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.1,
          stream: false,
          messages: [
            { role: "system", content: intentPrompt() },
            { role: "user", content: text },
          ],
        }),
      });
      if (!res.ok) {
        const err = await res.text().catch(() => "");
        lastDetail = `${provider.name} ${res.status}: ${err.slice(0, 200)}`;
        continue;
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? "";
      let json: unknown = null;
      try {
        json = JSON.parse(content);
      } catch {
        // LLM 偶尔包 ```json ``` 代码围栏，剥离后重试。
        const fence = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (fence) json = JSON.parse(fence[1]);
      }
      if (json === null) {
        lastDetail = `${provider.name}: non-JSON reply`;
        continue;
      }
      return NextResponse.json({ intent: json });
    } catch (err) {
      lastDetail = `${provider.name} fetch failed: ${err instanceof Error ? err.message : err}`;
    }
  }
  return NextResponse.json({ error: lastDetail }, { status: 503 });
}