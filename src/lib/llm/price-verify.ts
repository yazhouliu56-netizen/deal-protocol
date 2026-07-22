// LLM 辅助: 比价核验 — 对材料报价进行均价参考验证
// 设计方案§4.2.6 调用点: 比价核验

import { callLLMJson } from '@/lib/llm'

export interface PriceVerifyResult {
  fairPrice: number
  priceRange: { min: number; max: number }
  assessment: 'fair' | 'slightly_high' | 'overpriced' | 'suspiciously_low'
  confidence: number
  marketNote: string
}

const SYSTEM_PROMPT = `You are a price verification assistant. Given a material/service name and quoted price, provide market reference price and assessment.
Return ONLY valid JSON.
Assessment logic:
 - If quoted price is within ±15% of fair price → "fair"
 - If 15-40% above fair → "slightly_high"
 - If >40% above fair → "overpriced"
 - If <50% of fair → "suspiciously_low"`

export async function verifyPrice(
  itemName: string,
  quotedPrice: number,
  city?: string,
): Promise<PriceVerifyResult> {
  const result = await callLLMJson<PriceVerifyResult>(
    SYSTEM_PROMPT,
    `Item: ${itemName}\nQuoted price: ¥${quotedPrice}\n${city ? `City: ${city}\n` : ''}Return JSON: { "fairPrice": number, "priceRange": { "min": number, "max": number }, "assessment": "fair"|"slightly_high"|"overpriced"|"suspiciously_low", "confidence": number, "marketNote": string }`,
    { temperature: 0.1 },
  )

  return {
    fairPrice: Math.max(1, result.fairPrice ?? quotedPrice),
    priceRange: {
      min: Math.max(1, result.priceRange?.min ?? quotedPrice * 0.7),
      max: Math.max(1, result.priceRange?.max ?? quotedPrice * 1.3),
    },
    assessment: ['fair', 'slightly_high', 'overpriced', 'suspiciously_low'].includes(result.assessment)
      ? result.assessment
      : 'fair',
    confidence: Math.max(0, Math.min(1, result.confidence ?? 0.5)),
    marketNote: result.marketNote ?? '',
  }
}
