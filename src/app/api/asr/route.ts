import { NextResponse } from "next/server";
import { getAIModel } from "@/lib/ai-provider";
import { generateText } from "ai";

export const runtime = "nodejs";
export const maxDuration = 60;

const UPSTREAM = "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions";
const API_KEY = process.env.ZHIPU_API_KEY ?? "";
const MODEL = process.env.ZHIPU_ASR_MODEL ?? "glm-asr-2512";

/**
 * 语音链合流（D-08 裁决：ai/asr + asr → 单一 /api/asr）：
 * - form 含 `file` → GLM-ASR-2512 音频转写（stream=false，返回 { text }）；
 *   key 缺失/上游失败返回 503，客户端降级 Web Speech API。
 * - form 含 `rawText`/`audio` → LLM 协议提取（返回 { success, text, protocol }）。
 * - 不落任何缓存/日志（语音隐私血液，宪法 #8）。
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const file = form.get("file");
  const rawText = form.get("rawText") as string | null;
  const audio = form.get("audio") as Blob | null;

  if (file instanceof Blob && file.size > 0) {
    return transcribe(file);
  }

  let inputText = rawText;
  if (audio && audio.size > 0) {
    const arrayBuffer = await audio.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const model = getAIModel();
    const { text: transcription } = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: "You are a Mandarin Chinese speech-to-text transcriber. Transcribe the audio exactly as spoken. Output ONLY the transcribed text, nothing else.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this audio recording:" },
            { type: "file", data: { type: "data", data: base64 }, mediaType: audio.type || "audio/webm" },
          ],
        },
      ],
    });
    inputText = transcription;
  }

  if (!inputText || !inputText.trim()) {
    return NextResponse.json({ success: false, error: "No input text or audio provided" }, { status: 400 });
  }

  try {
    const model = getAIModel();
    const { text: extraction } = await generateText({
      model,
      messages: [
        {
          role: "system",
          content: `You are a protocol extraction assistant. Extract a structured service protocol from the user's request.

Respond with a JSON object (ONLY valid JSON, no markdown) in this exact format:
{
  "category": "家政 | 交友 | 按摩 | 医疗陪护 | 其他",
  "title": "简短标题",
  "budget": 数字(元),
  "pricing_type": "一口价 | 按小时计费",
  "service_time": "服务时间描述",
  "address_hint": "地点线索",
  "special_requirements": ["要求1", "要求2"]
}`,
        },
        { role: "user", content: inputText },
      ],
      temperature: 0.2,
    });

    let protocol: Record<string, unknown>;
    try {
      protocol = JSON.parse(extraction);
    } catch {
      return NextResponse.json({ success: false, error: "Failed to parse protocol extraction from AI" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      text: inputText,
      protocol,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/** GLM-ASR 转写：file → { text }。 */
async function transcribe(file: Blob): Promise<NextResponse> {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "ZHIPU_API_KEY not configured (voice ASR)" },
      { status: 503 }
    );
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large (>25MB)" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("model", MODEL);
  upstream.append("stream", "false");
  upstream.append("file", file, "voice.webm");

  try {
    const res = await fetch(UPSTREAM, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: upstream,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `upstream ${res.status}: ${text.slice(0, 300)}` },
        { status: res.status >= 500 ? 503 : 502 }
      );
    }
    const data = (await res.json()) as { text?: string };
    if (!data.text) {
      return NextResponse.json({ error: "empty transcription" }, { status: 502 });
    }
    return NextResponse.json({ text: data.text });
  } catch (err) {
    return NextResponse.json(
      { error: `asr upstream failed: ${err instanceof Error ? err.message : err}` },
      { status: 503 }
    );
  }
}
