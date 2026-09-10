import { NextResponse } from "next/server";
import { jsonChat, completeText } from "@/adapters/ai/gateway/engine";
import { configureLlmCompleteText } from "@/base/ai/llm-port";
import {
  assembleInterpret,
  buildUserText,
  INTERPRET_MAX_PHOTOS,
  interpretSystemPrompt,
} from "@/base/ai/publish-interpret";
import { emptyDraft, MAX_PHOTO_FACTS, normalizeDraft } from "@/base/order/publish-draft";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

configureLlmCompleteText(completeText);

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 会话发单解释器（TalkPublish R2c）。
 * 六圈定位：增长圈 × 体验圈；宪法对照 #10（LLM 不可用 → 200 + source:rules，
 * 客户端凭 nextQuestion 继续追问，永不 503 打断会话）。
 */
const RULE_INTERPRET = { windowMs: 60_000, maxRequests: 6 };
const MAX_PHOTO_BYTES = 700_000;

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function validPhoto(v: unknown): v is string {
  if (typeof v !== "string" || !v.startsWith("data:image/")) return false;
  const comma = v.indexOf(",");
  if (comma < 0) return false;
  return v.length - comma - 1 <= Math.ceil((MAX_PHOTO_BYTES * 4) / 3) + 64;
}

async function visionFacts(photoDataUrl: string): Promise<string[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gemini-2.5-flash-lite",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "你是发单助手。看照片，用中文列出与本地生活服务相关的客观事实（物品/脏乱/数量/状况），只回JSON：{\"facts\":[\"...\"]}，最多3条，每条20字内；无关返回{\"facts\":[]}。",
              },
              { type: "image_url", image_url: { url: photoDataUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 200,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => null)) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    } | null;
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return [];
    const parsed = JSON.parse(content) as { facts?: unknown };
    if (!Array.isArray(parsed.facts)) return [];
    return parsed.facts
      .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
      .map((f) => f.trim().slice(0, 60))
      .slice(0, MAX_PHOTO_FACTS);
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  const lim = checkRateLimit(`publish:interpret:${clientIp(req)}`, RULE_INTERPRET);
  if (!lim.allowed) return rateLimitResponse(lim.resetAt);

  let body: { text?: unknown; history?: unknown; draft?: unknown; photos?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 800) : "";
  const history = Array.isArray(body.history)
    ? body.history.filter((h): h is string => typeof h === "string").slice(-6)
    : [];
  const prev = normalizeDraft(body.draft ?? emptyDraft());
  const photos = Array.isArray(body.photos)
    ? body.photos.filter(validPhoto).slice(0, INTERPRET_MAX_PHOTOS)
    : [];
  if (!text && photos.length === 0) {
    return NextResponse.json({ error: "text or photos required" }, { status: 400 });
  }

  const [patch, factLists] = await Promise.all([
    (async () => {
      if (!text) return null;
      const outcome = await jsonChat([
        { role: "system", content: interpretSystemPrompt() },
        { role: "user", content: buildUserText(history, text) },
      ]);
      if (outcome.status !== 200 || outcome.json === null) return null;
      const d = normalizeDraft(outcome.json);
      if (!d.category && !d.time && !d.area && d.budgetYuan <= 0 && !d.note) return null;
      return d;
    })(),
    Promise.all(photos.map((p) => visionFacts(p))),
  ]);
  const facts = factLists.flat().slice(0, MAX_PHOTO_FACTS);
  const result = assembleInterpret(prev, patch, facts);
  return NextResponse.json({ ...result, photoFacts: facts });
}
