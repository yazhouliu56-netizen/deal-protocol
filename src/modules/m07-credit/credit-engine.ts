import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import type { CreditDimension } from '@/lib/contracts'
import { computeCompositeScore, ageFactor, decayFactor, coldStartProtection } from '../../../packages/credit-formula/index'

const DIMS: CreditDimension[] = ['integrity', 'capability', 'reliability', 'communication', 'safety', 'contribution']

const DIMENSION_WEIGHTS: Record<CreditDimension, number> = {
  integrity: 0.25,
  capability: 0.20,
  reliability: 0.20,
  communication: 0.15,
  safety: 0.15,
  contribution: 0.05,
  category_reputation: 0,
}

function dimCol(dim: CreditDimension): string {
  return `${dim}_score`
}

interface CreditUpdateInput {
  userId: string
  category?: string
  eventType: 'completion' | 'report' | 'verification' | 'violation' | 'sos'
  evidenceId: string
  description: string
}

function computeComposite(dims: Record<string, number>, createdAt?: string, lastActiveAt?: string, validCount?: number): number {
  let score = 0
  for (const dim of DIMS) {
    score += (dims[dim] ?? 60) * DIMENSION_WEIGHTS[dim]
  }
  if (createdAt || lastActiveAt || validCount !== undefined) {
    const options: Record<string, number> = {}
    if (createdAt) options.age = ageFactor(new Date(createdAt))
    if (lastActiveAt) options.decay = decayFactor(lastActiveAt ? new Date(lastActiveAt) : null)
    score = computeCompositeScore(
      { integrity: dims.integrity, capability: dims.capability, reliability: dims.reliability, communication: dims.communication, safety: dims.safety, contribution: dims.contribution },
      options,
    )
  }
  return Math.round(score * 100) / 100
}

function calculateDelta(eventType: string): Partial<Record<CreditDimension, number>> {
  switch (eventType) {
    case 'completion':
      return { integrity: 1, capability: 0.5, reliability: 0.5 }
    case 'violation':
      return { integrity: -10, reliability: -5, safety: -5 }
    case 'report':
      return { safety: -3, communication: -2 }
    case 'sos':
      return { safety: -20, integrity: -5 }
    case 'verification':
      return { contribution: 2 }
    default:
      return {}
  }
}

export async function updateCredit(input: CreditUpdateInput): Promise<{ success: boolean; newScore?: number }> {
  const { data: evidence } = await getSupabase()
    .from('evidence_log')
    .select('id')
    .eq('id', input.evidenceId)
    .single()

  if (!evidence) {
    throw new Error('Credit update must reference an existing evidence_log record')
  }

  const { data: current } = await getSupabase()
    .from('credit_records')
    .select('*')
    .eq('user_id', input.userId)
    .eq('category', input.category ?? '__platform__')
    .maybeSingle()

  const deltaMap = calculateDelta(input.eventType)

  const dims: Record<string, number> = {}
  for (const dim of DIMS) {
    dims[dim] = (current?.[dimCol(dim)] as number) ?? 60
  }

  for (const [dim, delta] of Object.entries(deltaMap)) {
    dims[dim] = Math.max(0, Math.min(100, dims[dim] + (delta as number)))
  }

  const composite = computeComposite(dims)

  let newCategoryScore = (current?.category_score as number | null) ?? null
  if (input.category) {
    const catDelta = input.eventType === 'completion' ? 2 : input.eventType === 'violation' ? -10 : 0
    newCategoryScore = (current?.category_score as number) ?? 60
    newCategoryScore = Math.max(0, Math.min(100, newCategoryScore + catDelta))
  }

  const rowCategory = input.category ?? null
  const upsertData: Record<string, unknown> = {
    user_id: input.userId,
    category: rowCategory,
    base_score: composite,
    base_total_deals: ((current?.base_total_deals as number) ?? 0) + (input.eventType === 'completion' ? 1 : 0),
    category_score: newCategoryScore,
    category_order_count: ((current?.category_order_count as number) ?? 0) + (input.eventType === 'completion' ? 1 : 0),
  }

  for (const dim of DIMS) {
    upsertData[dimCol(dim)] = dims[dim]
  }

  await getSupabase().from('credit_records').upsert(upsertData)

  for (const [dim, delta] of Object.entries(deltaMap)) {
    const d = dim as CreditDimension
    await getSupabase().from('credit_events').insert({
      user_id: input.userId,
      dimension: d,
      category: rowCategory,
      previous_score: (current?.[dimCol(d)] as number) ?? 60,
      new_score: dims[dim],
      delta: delta as number,
      reason: input.description,
      evidence_id: input.evidenceId,
      triggered_by: 'system',
    })
  }

  await appendEvidence({
    eventType: 'credit_updated',
    payload: {
      user_id: input.userId,
      category: input.category,
      new_base_score: composite,
      dimension_scores: dims,
      new_category_score: newCategoryScore,
      reason: input.description,
    },
    capturedBy: input.userId,
  })

  return { success: true, newScore: composite }
}

// 信用衰减逻辑（设计方案§5.6）
// 30天无订单：分数冻结，不增不减
// 90天无订单：每月衰减2%（衰减 = 当前分 × 0.98）
// 最低下限：40分
export const DECAY_CONFIG = {
  freezeDays: 30,
  decayDays: 90,
  decayRate: 0.02,
  minScore: 40,
  decayIntervalMonths: 1,
}

/**
 * 对指定用户的信用进行衰减检查
 * 返回: 衰减后的新分数（如未衰减则返回当前分数）
 */
export async function applyCreditDecay(userId: string): Promise<number | null> {
  const supabase = getSupabase()

  const { data: credit } = await supabase
    .from('credit_records')
    .select('*')
    .eq('user_id', userId)
    .is('category', null)
    .single()

  if (!credit) return null

  const lastActive = credit.updated_at ? new Date(credit.updated_at) : null
  if (!lastActive) return null

  const now = new Date()
  const daysSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24)

  // 30天内：不衰减
  if (daysSinceActive < DECAY_CONFIG.freezeDays) {
    return credit.base_score as number
  }

  // 30-90天：冻结（不增不减），不衰减
  if (daysSinceActive < DECAY_CONFIG.decayDays) {
    return credit.base_score as number
  }

  // 90天以上：每月衰减2%
  const monthsOverdue = Math.floor((daysSinceActive - DECAY_CONFIG.decayDays) / 30) + 1
  let currentScore = credit.base_score as number

  for (let i = 0; i < monthsOverdue; i++) {
    currentScore = currentScore * (1 - DECAY_CONFIG.decayRate)
  }

  const newScore = Math.max(DECAY_CONFIG.minScore, Math.round(currentScore * 100) / 100)

  // 只在实际变化时更新
  if (newScore < (credit.base_score as number)) {
    await supabase
      .from('credit_records')
      .update({
        base_score: newScore,
        updated_at: now.toISOString(),
      })
      .eq('id', credit.id)

    // 写衰减事件
    await supabase
      .from('credit_events')
      .insert({
        user_id: userId,
        dimension: 'integrity',
        previous_score: credit.base_score as number,
        new_score: newScore,
        delta: newScore - (credit.base_score as number),
        reason: `不活跃衰减: ${daysSinceActive.toFixed(0)}天无活动`,
        triggered_by: 'system',
      })
  }

  return newScore
}

/**
 * 批量执行所有用户的信用衰减
 * 设计方案§5.6: 定时任务调用
 */
export async function applyBulkCreditDecay(): Promise<{ processed: number; decayed: number }> {
  const supabase = getSupabase()

  const { data: allCredits } = await supabase
    .from('credit_records')
    .select('user_id')
    .is('category', null)

  if (!allCredits) return { processed: 0, decayed: 0 }

  let decayed = 0
  for (const row of allCredits) {
    const newScore = await applyCreditDecay(row.user_id)
    if (newScore !== null) decayed++
  }

  return { processed: allCredits.length, decayed }
}

export async function getCreditScore(userId: string, category?: string): Promise<{
  baseScore: number
  categoryScore: number | null
  dimensions: Record<string, number>
  baseTotalDeals: number
}> {
  const query = getSupabase()
    .from('credit_records')
    .select('*')
    .eq('user_id', userId)

  if (category) {
    query.eq('category', category)
  }

  const { data } = await query.maybeSingle()

  const dims: Record<string, number> = {}
  for (const dim of DIMS) {
    dims[dim] = (data?.[dimCol(dim)] as number) ?? 60
  }

  const baseTotalDeals = (data?.base_total_deals as number) ?? 0

  return {
    baseScore: (data?.base_score as number) ?? computeComposite(dims),
    categoryScore: (data?.category_score as number) ?? null,
    dimensions: dims,
    baseTotalDeals,
  }
}

export async function isColdStart(userId: string, category?: string): Promise<boolean> {
  const { data } = await getSupabase()
    .from('credit_records')
    .select('base_total_deals')
    .eq('user_id', userId)
    .maybeSingle()

  const totalDeals = (data?.base_total_deals as number) ?? 0

  let threshold = 3
  if (category) {
    try {
      const { getCategoryConfig } = await import('@/modules/m03-category-config/category-loader')
      const config = await getCategoryConfig(category)
      if (config?.entry_requirements) {
        const reqs = config.entry_requirements as Record<string, unknown>
        threshold = (reqs.cold_start_threshold as number) ?? 3
      }
    } catch {
      // fallback to default
    }
  }

  return totalDeals < threshold
}
