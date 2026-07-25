import { callLLM } from '@/lib/llm-adapter'

const cache = new Map<string, number>()

function cacheKey(protocolId: string, providerId: string): string {
  return `${protocolId}:${providerId}`
}

export function clearSemanticCache(): void {
  cache.clear()
}

export async function getCachedSemanticScore(
  protocolId: string,
  providerId: string,
  category: string,
): Promise<number> {
  const key = cacheKey(protocolId, providerId)
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const score = await computeSemanticRelevance(protocolId, providerId, category)
  cache.set(key, score)
  return score
}

async function computeSemanticRelevance(
  protocolId: string,
  providerId: string,
  category: string,
): Promise<number> {
  const systemPrompt = `You are a semantic matching evaluator for an O2O service platform.
Evaluate how relevant a provider is to a demand based on their category and profile.
Output ONLY a single integer between 0 and 100 representing the semantic relevance score.`

  const userPrompt = `Protocol category: ${category}
Protocol ID: ${protocolId}
Provider ID: ${providerId}

Score 0-100 how semantically relevant this provider is for this demand (100 = perfect match).`

  try {
    const result = await callLLM([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const parsed = parseInt(result.trim(), 10)
    if (isNaN(parsed)) return 0
    return Math.max(0, Math.min(100, parsed))
  } catch {
    return 0
  }
}
