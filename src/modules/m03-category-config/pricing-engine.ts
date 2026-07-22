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
