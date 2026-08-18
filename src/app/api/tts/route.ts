import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 链路总时限（红线 5 确定性降级 / 宪法 #10）：GLM fetch 与 edge-tts 流消费
 * 共享同一预算，超时统一返回 504，严禁请求连接悬挂。
 *
 * 背景：生产构建曾因 webpack 将 ws 的可选原生加速器 bufferutil 打成空桩
 * （require 不抛错 → ws 的 try/catch 不触发 → 掩码 wrapper 安装 → 发帧时
 * `b.mask is not a function`），msedge-tts 的音频流永不产出也永不结束，
 * for-await 无限挂起。已由 next.config serverExternalPackages 外置 + 
 * restart-prod WS_NO_BUFFER_UTIL 逃生舱根治打包层；本看门狗为请求层兜底，
 * 即使失败模式再度变化（上游黑洞/流阻塞），8 秒内必返回。
 */
const TTS_DEADLINE_MS = 8000;

export const TTS_TIMEOUT_ERROR = "TTS synthesis timeout (8s watchdog)";

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
 * - 两链共享 8s 总预算，超时 504（TTS_TIMEOUT_ERROR）。
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

  const start = Date.now();
  const budgetLeft = (): number =>
    Math.max(0, TTS_DEADLINE_MS - (Date.now() - start));

  // 1) GLM-TTS 主链路（AbortSignal 共享 8s 预算）。
  if (API_KEY) {
    const controller = new AbortController();
    const deadlineTimer = setTimeout(() => controller.abort(), budgetLeft());
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
        signal: controller.signal,
      });
    } catch {
      res = null;
    } finally {
      clearTimeout(deadlineTimer);
    }
    if (controller.signal.aborted) return ttsTimeoutResponse();
    if (res && res.ok) {
      const wav = Buffer.from(await res.arrayBuffer());
      return blobResponse(wav, GLM_MIME);
    }
    // 429/5xx/网络失败 → edge-tts 兜底（不直接 503），剩余预算继续共享。
  }

  // 2) edge-tts 兜底（8s 看门狗：Promise.race + tts.close() 释放套接字）。
  const fallback = await edgeTtsAudio(input, speed, budgetLeft());
  if (fallback === "TIMEOUT") return ttsTimeoutResponse();
  if (fallback) {
    return blobResponse(fallback, FALLBACK_MIME);
  }

  // 3) 双链全灭 → 503 → 客户端 speechSynthesis。
  return NextResponse.json(
    { error: "GLM-TTS unavailable and edge-tts fallback failed" },
    { status: 503 }
  );
}

function ttsTimeoutResponse() {
  return NextResponse.json({ error: TTS_TIMEOUT_ERROR }, { status: 504 });
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

/** 看门狗消费结果：ok=完整字节 / timeout=超时 / empty=流空 / error=流异常。 */
export type TtsConsumeOutcome =
  | { kind: "ok"; bytes: Buffer }
  | { kind: "timeout" }
  | { kind: "empty" }
  | { kind: "error" };

/**
 * 带时限的异步流消费（8s 看门狗核心，纯逻辑可单测）：
 * - 正常消费：逐块拼接，结束时清定时器；
 * - 超时：调用 onTimeout（释放 ws 套接字）并确定性返回 { kind: "timeout" }；
 * - 流抛出：{ kind: "error" }；流空：{ kind: "empty" }。
 * 消费侧错误经 then 双分支收敛，杜绝 race 已决后出现二次 unhandledRejection。
 */
export async function consumeTtsStreamWithDeadline(
  stream: AsyncIterable<Uint8Array>,
  deadlineMs: number,
  onTimeout: () => void
): Promise<TtsConsumeOutcome> {
  const chunks: Buffer[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const consume = (async () => {
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk as Uint8Array));
      }
    })();
    const settled = consume.then(
      () => "DONE" as const,
      () => "STREAM_ERROR" as const
    );
    const timedOut = new Promise<"TIMEOUT">((resolve) => {
      timer = setTimeout(() => resolve("TIMEOUT"), deadlineMs);
    });
    const outcome = await Promise.race([settled, timedOut]);
    if (outcome === "TIMEOUT") {
      onTimeout();
      return { kind: "timeout" };
    }
    if (outcome === "STREAM_ERROR") return { kind: "error" };
    if (chunks.length === 0) return { kind: "empty" };
    return { kind: "ok", bytes: Buffer.concat(chunks) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** edge-tts 合成；失败返回 null，超时返回 "TIMEOUT"（调用方降级）。 */
async function edgeTtsAudio(
  input: string,
  speed: number,
  deadlineMs: number
): Promise<Buffer | null | "TIMEOUT"> {
  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(
      "zh-CN-XiaoxiaoNeural",
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(input, {
      rate: `${Math.round((speed - 1) * 100)}%`,
    });
    const outcome = await consumeTtsStreamWithDeadline(
      audioStream,
      deadlineMs,
      () => tts.close()
    );
    if (outcome.kind === "timeout") return "TIMEOUT";
    if (outcome.kind !== "ok") return null;
    return outcome.bytes;
  } catch {
    return null;
  } finally {
    tts.close();
  }
}