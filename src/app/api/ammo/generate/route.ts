import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { assembleAmmo, registerDynamicAmmo, validateAmmoConfig } from "@/ammo/factory";
import type { IHolographicAmmoConfig } from "@/types/ammo-schema";

// 5/min 限流（单实例内存 LRU）
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitMap = new Map<string, number[]>();
function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = rateLimitMap.get(userId) ?? [];
  const recent = arr.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(userId, recent);
    return true;
  }
  recent.push(now);
  rateLimitMap.set(userId, recent);
  return false;
}

const SYSTEM_PROMPT = `你是 O2O 弹药工厂的 8D 配置生成器。仅输出严格 JSON，禁止 Markdown 解释。
输出必须符合 IHolographicAmmoConfig：
{
  "ammoId": "kebab-v1",
  "category": "任意中文品类如 上门洗车",
  "version": "1.0.0",
  "supplyCluster": "C1_MOBILITY|C2_IN_HOME|C3_TECH_B2B",
  "pricingModel": { "kind": "FIXED", "amountYuan": 50 } | { "kind": "PER_SEAT", "perSeatYuan": 80, "minSeats": 2 } | { "kind": "HOURLY", "hourlyYuan": 60 } | { "kind": "FORMULA", "formula": "..." },
  "fuzePolicy": { "kind": "IMPACT" | "DELAY" | "PROXIMITY" | "IMPACT_INHOME" },
  "forwardHooks": ["ArrivalCheckHook","CleaningCheckHook","OnsiteQuoteHook","AASplitSettleHook","PrivacyShieldHook","DepartureFinishHook"] 仅白名单 6 个
}
 few-shot pet-boarding-v1:
{"ammoId":"pet-boarding-v1","category":"宠物寄养","version":"1.0.0","supplyCluster":"C2_IN_HOME","pricingModel":{"kind":"FIXED","amountYuan":80},"fuzePolicy":{"kind":"IMPACT_INHOME"},"forwardHooks":[]}
仅输出 JSON 对象，无注释。`;

function extractJson(raw: string): string | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return cleaned.slice(start, end + 1);
}

function templateConfig(prompt: string, category?: string): IHolographicAmmoConfig {
  const cat = (category || prompt.slice(0, 12).trim() || "通用服务").slice(0, 20);
  const safeCat = cat.replace(/[^\u4e00-\u9fa5a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "generic";
  const ammoIdRaw = safeCat.toLowerCase().slice(0, 30);
  const ammoId = ammoIdRaw.includes("-v1") ? ammoIdRaw : `${ammoIdRaw}-v1`;
  return {
    ammoId,
    category: cat,
    version: "1.0.0",
    supplyCluster: "C1_MOBILITY",
    pricingModel: { kind: "FIXED", amountYuan: 50 } as unknown as IHolographicAmmoConfig["pricingModel"],
    fuzePolicy: { kind: "IMPACT" } as unknown as IHolographicAmmoConfig["fuzePolicy"],
    forwardHooks: [],
  } as unknown as IHolographicAmmoConfig;
}

export const POST = withAuth(async (req, user) => {
  if (isRateLimited(user.id)) {
    return NextResponse.json({ ok: false, error: "Too Many Requests" }, { status: 429 });
  }
  let body: { prompt?: string; category?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim() : undefined;
  if (!prompt) return NextResponse.json({ ok: false, error: "prompt required" }, { status: 400 });

  let rawJson: string | null = null;
  // 尝试调用 LLM（deepseek），无 Key 或失败则走模板降级（红线 5 永不 500）
  const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.LLM_API_KEY ?? "";
  if (apiKey) {
    try {
      const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `prompt: ${prompt}\ncategory: ${category ?? ""}` },
          ],
          temperature: 0.2,
        }),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
        const content = data.choices?.[0]?.message?.content ?? "";
        rawJson = extractJson(content);
      }
    } catch {
      rawJson = null;
    }
  }

  let config: IHolographicAmmoConfig;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson) as IHolographicAmmoConfig;
      // category 覆盖（显式传入优先）
      if (category) parsed.category = category;
      config = parsed;
    } catch {
      config = templateConfig(prompt, category);
    }
  } else {
    config = templateConfig(prompt, category);
  }

  const verdict = validateAmmoConfig(config);
  if (!verdict.ok) {
    return NextResponse.json({ ok: false, error: "validation failed", errors: verdict.errors }, { status: 422 });
  }
  const assembled = assembleAmmo(config);
  if (!assembled.ok) {
    return NextResponse.json({ ok: false, error: "assembly failed", errors: assembled.errors }, { status: 422 });
  }
  const reg = registerDynamicAmmo(config);
  if (!reg.ok) {
    return NextResponse.json({ ok: false, error: "register failed", errors: reg.errors }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    ammoId: assembled.ammo.ammoId,
    category: assembled.ammo.category,
    holographic: assembled.ammo.holographic,
  });
});
