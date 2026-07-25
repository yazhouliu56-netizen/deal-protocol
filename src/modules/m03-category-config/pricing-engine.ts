export interface PricingInput {
  category: string
  cityTier: 1 | 2 | 3
  workHours: number
  complexityFactors: string[]
  visitDistanceKm: number
  timeFactor?: 'normal' | 'peak' | 'urgent'
  quoteType: 'fixed' | 'fixed_plus' | 'estimate'
  materialCost?: number
}

export interface PricingResult {
  laborCost: number
  materialCost: number
  visitFee: number
  total: number
  breakdown: {
    hourlyRate: number
    workHours: number
    complexityFactor: number
    baseFee: number
    distanceFee: number
  }
}

const HOURLY_RATES: Record<1 | 2 | 3, number> = {
  1: 80,
  2: 60,
  3: 40,
}

const COMPLEXITY_MULTIPLIERS: Record<string, number> = {
  dirty_work: 1.3,
  heavy_lifting: 1.5,
  hazardous: 1.5,
}

const MAX_COMPLEXITY_FACTOR = 2.0

const BASE_FEE = 30
const DISTANCE_FEE_PER_KM = 5

const TIME_FACTORS: Record<string, number> = {
  normal: 1.0,
  peak: 1.3,
  urgent: 1.5,
}

const MIN_PRICE_FIXED = 50

const WARRANTY_MAP: Record<string, { months?: number; text: string }> = {
  '水电维修': { months: 6, text: '6个月' },
  '电气维修': { months: 6, text: '6个月' },
  '下水道疏通': { months: 3, text: '3个月' },
  '管道疏通': { months: 3, text: '3个月' },
  '开锁换锁': { months: 12, text: '12个月' },
  '搬家搬运': { months: 0, text: '通常无保修' },
  '全屋清洁': { months: 0, text: '通常无保修' },
  '空调清洗': { months: 0, text: '通常无保修' },
  '按摩': { months: 0, text: '短期待 - 满意度保障，非传统保修' },
}

function calculateComplexityFactor(factors: string[]): number {
  let factor = 1.0
  for (const f of factors) {
    const m = COMPLEXITY_MULTIPLIERS[f]
    if (m) {
      factor *= m
    }
  }
  return Math.min(factor, MAX_COMPLEXITY_FACTOR)
}

function calculateVisitFee(distanceKm: number, timeFactor: string): { baseFee: number; distanceFee: number; total: number } {
  const tf = TIME_FACTORS[timeFactor] ?? TIME_FACTORS.normal
  const baseFee = BASE_FEE
  const distanceFee = DISTANCE_FEE_PER_KM * distanceKm * tf
  return { baseFee, distanceFee, total: baseFee + distanceFee }
}

export function calculatePrice(input: PricingInput): PricingResult {
  const hourlyRate = HOURLY_RATES[input.cityTier]
  const complexityFactor = calculateComplexityFactor(input.complexityFactors)
  const laborCost = input.workHours * hourlyRate * complexityFactor

  const materialCost = input.materialCost ?? 0

  const tf = input.timeFactor ?? 'normal'
  const visit = calculateVisitFee(input.visitDistanceKm, tf)

  let total = laborCost + materialCost + visit.total

  if (input.quoteType === 'fixed') {
    total = Math.max(total, MIN_PRICE_FIXED)
  }

  return {
    laborCost: Math.round(laborCost * 100) / 100,
    materialCost,
    visitFee: visit.total,
    total: Math.round(total * 100) / 100,
    breakdown: {
      hourlyRate,
      workHours: input.workHours,
      complexityFactor,
      baseFee: visit.baseFee,
      distanceFee: visit.distanceFee,
    },
  }
}

export function getWarrantyPeriod(category: string): string {
  const entry = WARRANTY_MAP[category]
  if (entry) {
    if (entry.months === 0) return entry.text
    if (entry.months != null) return `${entry.months}个月`
    return entry.text
  }

  if (category.includes('水电') || category.includes('电气') || category.includes('维修')) {
    return WARRANTY_MAP['水电维修'].text
  }
  if (category.includes('疏通')) {
    return WARRANTY_MAP['下水道疏通'].text
  }
  if (category.includes('开锁') || category.includes('锁')) {
    return WARRANTY_MAP['开锁换锁'].text
  }
  if (category.includes('清洁') || category.includes('清洗')) {
    return WARRANTY_MAP['全屋清洁'].text
  }
  if (category.includes('按摩')) {
    return WARRANTY_MAP['按摩'].text
  }

  return '以合同约定为准'
}

export function verifyMaterialQuote(
  materialCost: number,
  marketRate: number,
): { reasonable: boolean; suggestedPrice?: number } {
  if (marketRate <= 0) {
    return { reasonable: true }
  }
  const ratio = materialCost / marketRate
  if (ratio <= 1.15) {
    return { reasonable: true }
  }
  return {
    reasonable: false,
    suggestedPrice: Math.round(marketRate * 100) / 100,
  }
}

// ─── Multi-Modal Dynamic Pricing (Persona A / Persona B) ────────────────────

export interface MultiModalPricingInput {
  categorySlug: string
  budget?: number
  durationHours?: number
  description?: string
  voiceText?: string
  mediaUrls?: string[]
  location?: [number, number]
}

export interface PricingEstimationResult {
  categorySlug: string
  userBudget: number
  isUserBudgetProvided: boolean
  recommendedMinPrice: number
  recommendedMaxPrice: number
  suggestedOptimalPrice: number
  complexityFactor: number
  estimatedMatchProbability: number
  marketAdvice: string
  priceStatus: 'UNDERPRICED' | 'FAIR' | 'PREMIUM' | 'AUTO_RECOMMENDED'
}

export async function estimateDynamicPricingAndMatchRate(
  input: MultiModalPricingInput,
): Promise<PricingEstimationResult> {
  const hasUserBudget = typeof input.budget === 'number' && input.budget > 0
  const userBudget = hasUserBudget ? (input.budget as number) : 0
  const hours = input.durationHours || 2
  const mediaCount = input.mediaUrls?.length || 0

  let complexity = 1.0
  const combinedText = `${input.description || ''} ${input.voiceText || ''}`

  if (
    combinedText.includes('严重') ||
    combinedText.includes('深层') ||
    combinedText.includes('急修') ||
    combinedText.includes('大面积')
  ) {
    complexity += 0.3
  }
  if (mediaCount > 0) {
    complexity += 0.1 * Math.min(mediaCount, 3)
  }

  const baseHourlyRate = 80
  const optimalPrice = Number((hours * baseHourlyRate * complexity).toFixed(2))
  const minPrice = Number((optimalPrice * 0.85).toFixed(2))
  const maxPrice = Number((optimalPrice * 1.25).toFixed(2))

  let probability = 85
  let status: 'UNDERPRICED' | 'FAIR' | 'PREMIUM' | 'AUTO_RECOMMENDED' = 'FAIR'
  let advice = ''

  if (!hasUserBudget) {
    status = 'AUTO_RECOMMENDED'
    probability = 90
    advice =
      `🤖 AI 已根据您提供的${mediaCount > 0 ? `${mediaCount}张现场照片与` : ''}需求细节完成综合评估（复杂度系数: ${complexity.toFixed(2)}）。推荐初始出价 ¥${optimalPrice}，预计可获得极佳的服务商响应率！`
  } else if (userBudget < minPrice) {
    status = 'UNDERPRICED'
    probability = Math.max(15, Math.round((userBudget / minPrice) * 50))
    advice =
      `当前预算 ¥${userBudget} 低于评估的市场合理区间 (¥${minPrice}~¥${maxPrice})，接单率预计为 ${probability}%，建议适当提高至 ¥${optimalPrice}。`
  } else if (userBudget > maxPrice) {
    status = 'PREMIUM'
    probability = 98
    advice =
      `当前预算 ¥${userBudget} 高于市场平均价，属于优质高出价，预计 3 分钟内触发优质服务商优先抢单！`
  } else {
    status = 'FAIR'
    probability = Math.round(
      75 + ((userBudget - minPrice) / (maxPrice - minPrice)) * 20,
    )
    advice =
      `当前预算 ¥${userBudget} 处于非常合理的市场成交区间，预计派单成功率达 ${probability}%！`
  }

  return {
    categorySlug: input.categorySlug || 'general',
    userBudget,
    isUserBudgetProvided: hasUserBudget,
    recommendedMinPrice: minPrice,
    recommendedMaxPrice: maxPrice,
    suggestedOptimalPrice: optimalPrice,
    complexityFactor: complexity,
    estimatedMatchProbability: probability,
    marketAdvice: advice,
    priceStatus: status,
  }
}
