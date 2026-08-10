/**
 * 客户端语音识别链路：GLM-ASR（/api/asr）优先 → Web Speech API 降级。
 * 录音由 VoiceBar 用 MediaRecorder 完成；这里只负责「音频 blob → 文本」。
 */

/** 浏览器原生语音识别（Chrome webkitSpeechRecognition）。 */
interface WebSpeechReco {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

function webSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
  );
}

/**
 * Web Speech 兜底：全程录音（有静音断句则自动停），返回识别文本。
 * 不支持/识别失败 → reject（调用方提示）。
 */
export function recognizeWithWebSpeech(lang = "zh-CN"): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!webSpeechSupported()) {
      reject(new Error("web-speech-unavailable"));
      return;
    }
    const ctor = (
      window as unknown as {
        webkitSpeechRecognition?: new () => WebSpeechReco;
        SpeechRecognition?: new () => WebSpeechReco;
      }
    ).webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition: new () => WebSpeechReco }).SpeechRecognition;
    const reco = new ctor();
    reco.lang = lang;
    reco.interimResults = false;
    reco.maxAlternatives = 1;
    reco.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript?.trim() ?? "";
      if (text) resolve(text);
      else reject(new Error("empty-transcript"));
    };
    reco.onerror = (e) => reject(new Error(e.error ?? "speech-error"));
    reco.onend = () => {};
    reco.start();
  });
}

/**
 * 主链路：录音 blob → /api/asr（GLM-ASR）。
 * 503/网络失败 → 抛错（调用方决定是否降级 Web Speech）。
 */
export async function transcribeViaApi(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "voice.webm");
  const res = await fetch("/api/asr", { method: "POST", body: form });
  if (!res.ok) {
    throw new Error(`api-asr ${res.status}`);
  }
  const data = (await res.json()) as { text?: string };
  if (!data.text) throw new Error("empty-transcript");
  return data.text;
}

/**
 * 完整降级链：GLM-ASR → Web Speech → 失败。
 * preferWebSpeech=true 时（无麦克风录音场景/明确指定）跳过 API 直达浏览器识别。
 */
export async function recognizeSpeech(
  blob: Blob | null,
  opts: { preferWebSpeech?: boolean } = {}
): Promise<string> {
  if (opts.preferWebSpeech || !blob) return recognizeWithWebSpeech();
  try {
    return await transcribeViaApi(blob);
  } catch {
    return recognizeWithWebSpeech();
  }
}