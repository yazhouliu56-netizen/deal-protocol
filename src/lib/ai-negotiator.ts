export interface NegotiationInput {
  userBudget: number
  providerExpectedPrice: number
  categorySlug: string
  description: string
}

export interface NegotiationResult {
  success: boolean
  counterPrice: number
  scopeAdjustments: string[]
  estimatedProbability: number
  reasoning?: string
}

export async function proposeCounterOffer(input: NegotiationInput): Promise<NegotiationResult> {
  const { userBudget, providerExpectedPrice, categorySlug, description } = input

  if (userBudget <= 0 || providerExpectedPrice <= 0) {
    return { success: false, counterPrice: 0, scopeAdjustments: [], estimatedProbability: 0 }
  }

  try {
    const { getAIModel } = await import('@/lib/ai-provider')
    const model = getAIModel()
    const prompt = `You are an AI negotiation assistant. Given a buyer budget of ¥${userBudget} and a provider expected price of ¥${providerExpectedPrice} for "${description}" (category: ${categorySlug}), suggest a win-win counter-offer price and scope adjustments. Return JSON with: counterPrice (number), scopeAdjustments (string array of 2-3 items), estimatedProbability (0-100 number), and reasoning (string).`

    const { text } = await model.doStream({
      system: 'You are a professional negotiation AI. Respond only in JSON.',
      prompt,
    })

    const reader = text.getReader()
    let result = ''
    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      result += decoder.decode(value, { stream: true })
    }
    reader.release()

    const parsed = JSON.parse(result) as {
      counterPrice: number
      scopeAdjustments: string[]
      estimatedProbability: number
      reasoning: string
    }

    return {
      success: true,
      counterPrice: parsed.counterPrice,
      scopeAdjustments: parsed.scopeAdjustments ?? [],
      estimatedProbability: parsed.estimatedProbability ?? 90,
      reasoning: parsed.reasoning,
    }
  } catch {
    const mid = Math.round((userBudget + providerExpectedPrice) / 2)
    return {
      success: true,
      counterPrice: mid,
      scopeAdjustments: [
        `Negotiate from ¥${providerExpectedPrice} down to ¥${mid}`,
        'Consider removing non-essential scope items',
        'Bundle multiple units for discount',
      ],
      estimatedProbability: 85,
      reasoning: `AI negotiation unavailable; fallback midpoint (¥${mid}) based on budget (¥${userBudget}) and provider (¥${providerExpectedPrice})`,
    }
  }
}
