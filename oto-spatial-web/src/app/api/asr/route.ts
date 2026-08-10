import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const UPSTREAM = "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions";
const API_KEY = process.env.ZHIPU_API_KEY ?? "";
const MODEL = process.env.ZHIPU_ASR_MODEL ?? "glm-asr-2512";

/**
 * 语音转文字（GLM-ASR-2512 代理）。
 * - key 只在服务端；客户端不可见。
 * - 同步调用（stream=false），返回 { text }。
 * - 无 key → 503，客户端降级 Web Speech API。
 * - 不留任何缓存/日志采样（语音证据链本地化原则）。
 */
export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "ZHIPU_API_KEY not configured (voice ASR)" },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
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