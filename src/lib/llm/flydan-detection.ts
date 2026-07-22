// LLM 辅助: 飞单检测 — 分析聊天记录标记疑似飞单行为
// 设计方案§4.2.6 + §6.1 调用点: 飞单检测

import { callLLMJson } from '@/lib/llm'

export interface FlydanResult {
  suspicious: boolean
  riskLevel: 'low' | 'medium' | 'high'
  signals: string[]
  confidence: number
}

const SYSTEM_PROMPT = `You are a transaction integrity monitor. Analyze chat transcripts between a platform user and service provider for signs of "flydan" (off-platform transaction).
Signals to watch:
 1. Mentioning off-platform payments (WeChat/Alipay private transfer)
 2. Sharing personal phone numbers to bypass platform
 3. Suggesting to cancel platform order and transact directly
 4. Offering discounts for off-platform deals
 5. Asking to communicate on other apps (WeChat/QQ)

Return riskLevel: low (no signals), medium (weak signals), high (clear evidence).`

export async function detectFlydan(
  chatTranscript: string,
): Promise<FlydanResult> {
  if (!chatTranscript || chatTranscript.length < 10) {
    return { suspicious: false, riskLevel: 'low', signals: [], confidence: 1.0 }
  }

  const result = await callLLMJson<FlydanResult>(
    SYSTEM_PROMPT,
    `Analyze this chat transcript for off-platform transaction signals:\n\n${chatTranscript.slice(0, 4000)}\n\nReturn JSON: { "suspicious": boolean, "riskLevel": "low"|"medium"|"high", "signals": string[], "confidence": number }`,
    { temperature: 0.1 },
  )

  return {
    suspicious: result.suspicious ?? false,
    riskLevel: ['low', 'medium', 'high'].includes(result.riskLevel) ? result.riskLevel : 'low',
    signals: (result.signals ?? []).slice(0, 10),
    confidence: Math.max(0, Math.min(1, result.confidence ?? 0.5)),
  }
}
