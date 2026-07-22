// LLM 辅助: 评价标签提取 — 从用户评论文本中提取结构化标签
// 设计方案§4.2.6 调用点: 评价标签

import { callLLMJson } from '@/lib/llm'

export interface ExtractedLabel {
  sentiment: 'positive' | 'neutral' | 'negative'
  tags: string[]
  keyPoints: string[]
  overallScore: number
}

const SYSTEM_PROMPT = `You are a review analysis assistant. Extract structured labels from a user's service review.
Categories of tags: punctuality, quality, communication, price, safety, cleanliness, professionalism
Sentiment: positive / neutral / negative
overallScore: 1-5 (1=worst, 5=best)

Return ONLY valid JSON.`

export async function extractLabels(
  reviewText: string,
  category?: string,
): Promise<ExtractedLabel> {
  const result = await callLLMJson<ExtractedLabel>(
    SYSTEM_PROMPT,
    `Review text: ${reviewText}\n${category ? `Service category: ${category}\n` : ''}Return JSON: { "sentiment": "positive"|"neutral"|"negative", "tags": string[], "keyPoints": string[], "overallScore": number }`,
    { temperature: 0.1 },
  )

  return {
    sentiment: ['positive', 'neutral', 'negative'].includes(result.sentiment) ? result.sentiment : 'neutral',
    tags: (result.tags ?? []).slice(0, 10),
    keyPoints: (result.keyPoints ?? []).slice(0, 5),
    overallScore: Math.max(1, Math.min(5, result.overallScore ?? 3)),
  }
}
