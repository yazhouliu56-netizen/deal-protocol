// M03: 品类配置体系
// 带 TTL 缓存的配置读取 + 校验器
// 新增品类 = 新增一条配置记录，不改代码

import { getSupabase } from '@/lib/supabase-client'
import type { ResponseMode, RiskTier } from '@/lib/contracts'

interface CategoryConfig {
  id: string
  category: string
  risk_tier: RiskTier
  schema_json: Record<string, unknown>
  entry_requirements: Record<string, unknown> | null
  response_mode: ResponseMode
  safety_requirements: Record<string, unknown> | null
  enabled: boolean
  version: number
}

export interface PricingConfig {
  id: string
  category: string
  default_work_hours: number
  min_price: number
  warranty_months: number | null
  warranty_text: string | null
  material_markup: number
  fixed_quote_max_minutes: number
  enabled: boolean
}

// 内存缓存 + TTL
const cache = new Map<string, { data: CategoryConfig; expiresAt: number }>()
const pricingCache = new Map<string, { data: PricingConfig; expiresAt: number }>()
const TTL_MS = 30_000 // 30 秒

export async function getCategoryConfig(category: string): Promise<CategoryConfig | null> {
  // 1. 检查缓存
  const cached = cache.get(category)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  // 2. 从数据库读取
  const { data, error } = await getSupabase()
    .from('category_configs')
    .select('*')
    .eq('category', category)
    .single()

  if (error || !data) return null

  const config = data as unknown as CategoryConfig

  // 3. 写入缓存
  cache.set(category, { data: config, expiresAt: Date.now() + TTL_MS })

  return config
}

export async function getPricingConfig(category: string): Promise<PricingConfig | null> {
  const cached = pricingCache.get(category)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data
  }

  const { data, error } = await getSupabase()
    .from('pricing_configs')
    .select('*')
    .eq('category', category)
    .single()

  if (error || !data) return null

  const config = data as unknown as PricingConfig
  pricingCache.set(category, { data: config, expiresAt: Date.now() + TTL_MS })

  return config
}

// ---- 配置校验器 ----
export interface ValidationError {
  field: string
  message: string
}

export function validateConfig(config: Partial<CategoryConfig>): ValidationError[] {
  const errors: ValidationError[] = []

  if (!config.category) {
    errors.push({ field: 'category', message: 'Category name is required' })
  }

  if (!config.risk_tier) {
    errors.push({ field: 'risk_tier', message: 'Risk tier is required' })
  } else if (!['low', 'medium', 'high'].includes(config.risk_tier)) {
    errors.push({ field: 'risk_tier', message: 'Risk tier must be low, medium, or high' })
  }

  // high → manual_review 必须为 true
  if (
    config.risk_tier === 'high' &&
    (!config.entry_requirements ||
      (config.entry_requirements as Record<string, unknown>)?.manual_review !== true)
  ) {
    errors.push({
      field: 'entry_requirements.manual_review',
      message: 'High risk tier requires manual_review=true',
    })
  }

  // response_mode 白名单
  if (config.response_mode && !['grab_first', 'grab_rst', 'interest_list', 'agency_dispatch'].includes(config.response_mode)) {
    errors.push({
      field: 'response_mode',
      message: 'Must be grab_first, grab_rst, interest_list, or agency_dispatch',
    })
  }

  // 医疗陪护不允许 grab_first
  if (config.category === '医疗陪护' && config.response_mode === 'grab_first') {
    errors.push({
      field: 'response_mode',
      message: 'Medical escort category cannot use grab_first mode',
    })
  }

  // schema 变更须升版本
  if (config.schema_json && config.version) {
    // schema 变更须触发 version bump（调用方处理）
  }

  return errors
}

// 缓存刷新（配置更新后调用）
export function invalidateCache(category?: string): void {
  if (category) {
    cache.delete(category)
    pricingCache.delete(category)
  } else {
    cache.clear()
    pricingCache.clear()
  }
}
