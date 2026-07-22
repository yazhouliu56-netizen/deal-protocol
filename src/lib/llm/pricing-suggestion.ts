// LLM 辅助: 定价建议 — 根据用户描述+城市输出工时费系数
// 设计方案§4.2.6 调用点: 定价

import { callLLMJson } from '@/lib/llm'

export interface PricingSuggestion {
  hourlyRate: number
  estimatedHours: number
  complexityFactor: number
  totalEstimate: number
  currency: 'CNY'
}

const SYSTEM_PROMPT = `You are a service pricing advisor. Based on the user's service description and city, estimate the labor cost.
Use these city tiers for CNY hourly rates:
 一线城市(北京/上海/广州/深圳): ¥80/h baseline
 二线城市: ¥60/h baseline
 县城/其他: ¥40/h baseline

Complexity factor (multiplier on hourly rate):
 简单(换灯泡/搬东西等): ×1.0
 中等(维修/保洁等): ×1.2
 复杂(电路检修/高危作业等): ×1.5
 特殊(需要专业资质): ×1.8

Return ONLY valid JSON.`

export async function suggestPricing(
  description: string,
  city: string,
): Promise<PricingSuggestion> {
  const result = await callLLMJson<PricingSuggestion>(
    SYSTEM_PROMPT,
    `Service description: ${description}\nCity: ${city}\n\nReturn JSON: { "hourlyRate": number, "estimatedHours": number, "complexityFactor": number, "totalEstimate": number, "currency": "CNY" }`,
    { temperature: 0.1 },
  )

  return {
    hourlyRate: Math.max(20, Math.min(500, result.hourlyRate ?? 60)),
    estimatedHours: Math.max(0.5, Math.min(24, result.estimatedHours ?? 1)),
    complexityFactor: Math.max(1, Math.min(3, result.complexityFactor ?? 1)),
    totalEstimate: Math.round((result.totalEstimate ?? result.hourlyRate * result.estimatedHours) * 100) / 100,
    currency: 'CNY',
  }
}
