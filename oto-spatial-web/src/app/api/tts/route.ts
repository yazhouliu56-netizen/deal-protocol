import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const runtime = "nodejs";
export const maxDuration = 60;

const UPSTREAM = "https://open.bigmodel.cn/api/paas/v4/audio/speech";
const API_KEY = process.env.ZHIPU_API_KEY ?? "";

const FALLBACK_MIME = "audio/mpeg";
const GLM_MIME = "audio/wav";

/**
 * 文字转语音，降级链：GLM-TTS（wav）→ edge-tts（免费无 key，
 * zh-CN-XiaoxiaoNeural，mp3，ADR-0005）→ 503 交客户端 speechSynthesis。
 * - key 只在服务端。
 * - GLM 429/5xx 不再直接 503：先落 edge-tts 兜底再放弃。
 * - 不留服务端缓存（客户端 ttsCache 处理重复播报）。
 */
export async function POST(req: Request) {
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

  // 1) GLM-TTS 主链路。
  if (API_KEY) {
    let res: Response | null = null;
    try {
      res = await fetch(UPSTREAM, {
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
    } catch {
      res = null;
    }
    if (res && res.ok) {
      const wav = Buffer.from(await res.arrayBuffer());
      return blobResponse(wav, GLM_MIME);
    }
    // 429/5xx/网络失败 → edge-tts 兜底（不直接 503）。
  }

  // 2) edge-tts 兜底：免费无 key，zh-CN-XiaoxiaoNeural（mp3）。
  const fallback = await edgeTtsAudio(input, speed);
  if (fallback) {
    return blobResponse(fallback, FALLBACK_MIME);
  }

  // 3) 双链全灭 → 503 → 客户端 speechSynthesis。
  return NextResponse.json(
    { error: "GLM-TTS unavailable and edge-tts fallback failed" },
    { status: 503 }
  );
}

function blobResponse(bytes: Buffer, mime: string) {
  // Buffer 是 Uint8Array 子类；拷贝出恰好大小的 ArrayBuffer 供 BodyInit。
  const body = new Uint8Array(bytes);
  return new NextResponse(body.buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

/** edge-tts 合成；失败返回 null（调用方降级）。 */
async function edgeTtsAudio(input: string, speed: number): Promise<Buffer | null> {
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(
      "zh-CN-XiaoxiaoNeural",
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(input, {
      rate: `${Math.round((speed - 1) * 100)}%`,
    });
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.from(chunk as Uint8Array));
    }
    tts.close();
    if (chunks.length === 0) return null;
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}