import { getServiceClient } from "@/lib/supabase-client"

// ── Types ──

/**
 * P2 退役：阶梯佣金引擎（getCommissionRate）已删除。
 * commissionTiers 字段仅作历史行兼容保留（值恒全 0，不再被任何代码读取）；
 * 扁平 commissionRate 为唯一佣金口径。
 */
export type CommissionTier = { maxAmount: number; rate: number }

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

/** 结算份额项（百分比，和≡100，P3 方程读此；用户裁决 2026-09-18）。 */
export interface SettlementShare {
  key: string
  pct: number
}

/** 通道费率（签约值待商务确认，初值公开市场价；用户裁决：平台零垫付）。 */
export interface ChannelRates {
  wechat: number
  alipay: number
  stripe: number
}

/** 取消补偿城市基准（元/小时；ETA 默认分钟；用户裁决：在途按骑手线）。 */
export interface CancelBenchmark {
  tier1: { twoWheel: number; fourWheel: number; etaMin: number }
  tier2: { twoWheel: number; fourWheel: number; etaMin: number }
  tier3: { twoWheel: number; fourWheel: number; etaMin: number }
}

export interface PlatformConfig {
  fees: {
    /** P2 退役；现值全 0（上线免费政策，可逆，sunset 翻转改 commissionRate）。 */
    commissionTiers: CommissionTier[]
    /** 扁平佣金率（订单总额百分比），当前 0；sunset 到期改此值即生效。 */
    commissionRate: number
    /** 与 Type1 对齐 0.15（协议层 funding.fees 为准，此处仅管理面一致口径）。 */
    satisfactionHold: number
    channelRates: ChannelRates
    /** 提现银行卡固定费（元/笔；ALIPAY 按 channelRates.alipay 费率）。 */
    withdrawBankFlat: number
    publishFee: { freePerDay: number; unitPrice: number }
    cancelBenchmark: CancelBenchmark
    /** 定制情绪型护栏（比例相对订单基础价）+ 新维度冷启动底线（元）。 */
    qualityGuardrails: {
      emotionMinPct: number
      emotionMaxPct: number
      singleItemMaxPct: number
      newDimFallback: number
    }
    settlementShares: SettlementShare[]
    /** P4 双钟表：15% 批量触发（N 单 / T 天，先到为准；用户裁决 10/7）。 */
    batchRelease: { minCount: number; maxAgeDays: number }
    /** 佣金 sunset：净完单破 trigger + 公示 30 天 → commissionRate 翻为 target。 */
    sunset: {
      netCompletedTrigger: number
      targetCommissionRate: number
      announcedAt: string | null
      status: 'pending' | 'announced' | 'effective'
    }
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
        { maxAmount: 500, rate: 0 },
        { maxAmount: 5_000, rate: 0 },
        { maxAmount: 50_000, rate: 0 },
        { maxAmount: Number.MAX_SAFE_INTEGER, rate: 0 },
      ],
      commissionRate: 0,
      satisfactionHold: 0.15,
      channelRates: { wechat: 0.006, alipay: 0.006, stripe: 0.029 },
      withdrawBankFlat: 2,
      publishFee: { freePerDay: 3, unitPrice: 1 },
      cancelBenchmark: {
        tier1: { twoWheel: 35, fourWheel: 80, etaMin: 30 },
        tier2: { twoWheel: 30, fourWheel: 70, etaMin: 25 },
        tier3: { twoWheel: 25, fourWheel: 60, etaMin: 20 },
      },
      qualityGuardrails: {
        emotionMinPct: 0.03,
        emotionMaxPct: 0.15,
        singleItemMaxPct: 0.5,
        newDimFallback: 5,
      },
      settlementShares: [
        { key: 'base', pct: 85 },
        { key: 'attitude', pct: 5 },
        { key: 'appearance', pct: 5 },
        { key: 'restoration', pct: 5 },
      ],
      batchRelease: { minCount: 10, maxAgeDays: 7 },
      sunset: {
        netCompletedTrigger: 10000,
        targetCommissionRate: 0.05,
        announcedAt: null,
        status: 'pending',
      },
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

/** P2 退役：阶梯引擎删除。用 config.fees.commissionRate（扁平总额百分比）。 */

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

  // 服务端专用（调用方：penalty lib / admin 路由，均为服务端）：
  // service 直读，RLS 保持零策略锁死，anon 一律不可见。
  const supabase = getServiceClient()
  const { data: row, error } = await supabase
    .from('platform_config')
    .select('*')
    .eq('id', 'singleton')
    .single()

  if (error || !row) {
    const config = getDefaultConfig()
    const { error: insertError } = await supabase
      .from('platform_config')
      .insert({ id: 'singleton', config })
    if (insertError) throw insertError
    cachedConfig = config
    return config
  }

  // Seed 迁移写入的是 JSONB 对象，updateConfig 历史写入的是 JSON 字符串；
  // 双形状兼容，否则 JSON.parse(对象) 抛错 → 全网回退默认费率。
  cachedConfig = (typeof row.config === "string" ? JSON.parse(row.config) : row.config) as PlatformConfig
  return cachedConfig
}

export async function updateConfig(data: PlatformConfig): Promise<void> {
  const supabase = getServiceClient()
  const { error } = await supabase
    .from('platform_config')
    .upsert({ id: 'singleton', config: data }, { onConflict: 'id' })
  if (error) throw error
  cachedConfig = data
}
