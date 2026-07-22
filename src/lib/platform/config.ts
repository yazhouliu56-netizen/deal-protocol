import { getSupabase } from "@/lib/supabase-client"

// ── Types ──

export interface CommissionTier {
  maxAmount: number
  rate: number
}

export interface CreditLevel {
  minScore: number
  label: string
  benefits: string[]
}

export interface PoolAllocation {
  warranty: number
  customer: number
  provider: number
  sos: number
}

export interface PlatformConfig {
  fees: {
    commissionTiers: CommissionTier[]
    satisfactionHold: number
  }
  credit: {
    levels: CreditLevel[]
  }
  rules: {
    cancelThreshold: number
    cancelPenaltyCount: number
    cancelPenaltyCredit: number
    cancelPenaltyDays: number
  }
  insurance: {
    ratePerOrder: number
    poolAllocation: PoolAllocation
  }
}

// ── Defaults ──

export function getDefaultConfig(): PlatformConfig {
  return {
    fees: {
      commissionTiers: [
        { maxAmount: 500, rate: 0.15 },
        { maxAmount: 5_000, rate: 0.12 },
        { maxAmount: 50_000, rate: 0.10 },
        { maxAmount: Number.MAX_SAFE_INTEGER, rate: 0.08 },
      ],
      satisfactionHold: 0.10,
    },
    credit: {
      levels: [
        { minScore: 900, label: "钻石", benefits: ["优先派单", "免押金服务", "专属客服"] },
        { minScore: 750, label: "黄金", benefits: ["快速响应", "信用免押"] },
        { minScore: 600, label: "白银", benefits: ["基础信用特权"] },
        { minScore: 300, label: "青铜", benefits: [] },
        { minScore: 0, label: "新手", benefits: [] },
      ],
    },
    rules: {
      cancelThreshold: 3,
      cancelPenaltyCount: 5,
      cancelPenaltyCredit: 100,
      cancelPenaltyDays: 7,
    },
    insurance: {
      ratePerOrder: 0.01,
      poolAllocation: {
        warranty: 0.40,
        customer: 0.30,
        provider: 0.20,
        sos: 0.10,
      },
    },
  }
}

// ── Helpers ──

export function getCommissionRate(amount: number, config: PlatformConfig): number {
  for (const tier of config.fees.commissionTiers) {
    if (amount <= tier.maxAmount) return tier.rate
  }
  return config.fees.commissionTiers[config.fees.commissionTiers.length - 1]?.rate ?? 0.15
}

export function getCreditLevel(score: number, config: PlatformConfig): CreditLevel {
  const sorted = [...config.credit.levels].sort((a, b) => b.minScore - a.minScore)
  for (const level of sorted) {
    if (score >= level.minScore) return level
  }
  return sorted[sorted.length - 1]
}

// ── Runtime: in-memory cache + DB ──

let cachedConfig: PlatformConfig | null = null

export function clearConfigCache(): void {
  cachedConfig = null
}

export async function getConfig(): Promise<PlatformConfig> {
  if (cachedConfig) return cachedConfig

  const supabase = getSupabase()
  const { data: row, error } = await supabase
    .from('platform_config')
    .select('*')
    .eq('id', 'singleton')
    .single()

  if (error || !row) {
    const config = getDefaultConfig()
    const { error: insertError } = await supabase
      .from('platform_config')
      .insert({ id: 'singleton', config: JSON.stringify(config) })
    if (insertError) throw insertError
    cachedConfig = config
    return config
  }

  cachedConfig = JSON.parse(row.config) as PlatformConfig
  return cachedConfig
}

export async function updateConfig(data: PlatformConfig): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('platform_config')
    .upsert({ id: 'singleton', config: JSON.stringify(data) }, { onConflict: 'id' })
  if (error) throw error
  cachedConfig = data
}
