import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const UPSTREAM = "https://open.bigmodel.cn/api/paas/v4/audio/speech";
const API_KEY = process.env.ZHIPU_API_KEY ?? "";

/**
 * 文字转语音（GLM-TTS 代理）。
 * - key 只在服务端。
 * - 返回 audio/wav 二进制流（浏览器 <audio> 直接播放）。
 * - 无 key → 503，客户端降级 speechSynthesis。
 * - 不留服务端缓存（播报音频本地脆弱，重复播报由客户端 ttsCache 处理）。
 */
export async function POST(req: Request) {
  if (!API_KEY) {
    return NextResponse.json(
      { error: "ZHIPU_API_KEY not configured (voice TTS)" },
      { status: 503 }
    );
  }

  let body: { input?: unknown; voice?: unknown; speed?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!input) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
  }
  if (input.length > 1024) {
    return NextResponse.json({ error: "input too long (>1024)" }, { status: 400 });
  }
  const voice =
    typeof body.voice === "string" && body.voice ? body.voice : "tongtong";
  const speed =
    typeof body.speed === "number" && Number.isFinite(body.speed)
      ? Math.min(2, Math.max(0.5, body.speed))
      : 1;

  try {
    const res = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "glm-tts",
        input,
        voice,
        speed,
        response_format: "wav",
        stream: false,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `upstream ${res.status}: ${text.slice(0, 300)}` },
        { status: res.status >= 500 ? 503 : 502 }
      );
    }
    const wav = await res.arrayBuffer();
    return new NextResponse(new Uint8Array(wav), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `tts upstream failed: ${err instanceof Error ? err.message : err}` },
      { status: 503 }
    );
  }
}