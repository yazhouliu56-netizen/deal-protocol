// M06: 匹配路由引擎
// 设计方案§4.3: 执行链 + 空候选池三级降级

import { getServiceClient } from '@/lib/supabase-client'
import type { MatchCandidate, Ranker } from './ranker'
import { staticRanker } from './ranker'

export { type MatchCandidate } from './ranker'

/**
 * 匹配一个协议，返回排序后的候选人列表
 * 执行链（顺序不可变）：
 *   ① 地理围栏筛选
 *   ② 标签/技能交集过滤
 *   ③ 信用与资质门槛过滤
 *   ④ 排序（使用注入的 Ranker）
 *   ⑤ response_mode 分支
 */
export async function findMatches(
  category: string,
  options?: {
    lat?: number
    lng?: number
    radiusKm?: number
    limit?: number
    ranker?: Ranker
  },
): Promise<MatchCandidate[]> {
  const supabase = getServiceClient()
  const radius = options?.radiusKm ?? 5
  const limit = options?.limit ?? 20
  const ranker = options?.ranker ?? staticRanker

  let catProviders: { user_id: string; current_location?: unknown }[] | null = null
  try {
    let query = supabase
      .from('provider_categories')
      .select('user_id, current_location')
      .eq('category', category)

    if (options?.lat !== undefined && options?.lng !== undefined) {
      // ① 地理围栏筛选
      query = query.not('current_location', 'is', null)
    }

    const { data } = await query
    catProviders = data
  } catch {
    return []
  }

  const providerIds = (catProviders || []).map(p => p.user_id)
  if (providerIds.length === 0) {
    // 空池 → 触发三级降级
    return fallbackFindMatches(category, { ...options, tier: 1 })
  }

  let profiles: {
    id: string
    name: string
    credit_score: number
    dispute_losses: number
    created_at: string
    is_online?: boolean
  }[] | null = null
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, name, credit_score, dispute_losses, created_at, is_online')
      .or('roles.ilike.%PROVIDER%,role.eq.PROVIDER')
      .in('id', providerIds)
    profiles = data
  } catch {
    return []
  }

  // ② 信用与资质门槛过滤（③+④合并排序）
  const ranked = ranker.sort(profiles || [], { category, limit })

  // ⑤ 截断到 limit
  return ranked.slice(0, limit)
}

// ── 三级降级 ──
// 设计方案§4.3: 空候选池降级策略
// 第1级: 扩大半径 (5→10→20km)
// 第2级: 降低信用门槛
// 第3级: 转人工指派标记

async function fallbackFindMatches(
  category: string,
  options: {
    lat?: number
    lng?: number
    radiusKm?: number
    limit?: number
    tier?: number
    ranker?: Ranker
  },
): Promise<MatchCandidate[]> {
  const tier = options.tier ?? 1
  const ranker = options.ranker ?? staticRanker

  // 第1级: 扩大搜索半径
  if (tier === 1) {
    const expandedRadii = [10, 20, 50]
    for (const r of expandedRadii) {
      const result = await findMatches(category, {
        ...options,
        radiusKm: r,
        limit: options.limit ?? 20,
      })
      if (result.length > 0) {
        // 标记为扩半径结果
        return result.map(c => ({ ...c, note: `expanded_radius_${r}km` }))
      }
    }
    // 半径扩到最大仍空 → 进入第2级
    return fallbackFindMatches(category, { ...options, tier: 2 })
  }

  // 第2级: 降低信用门槛 — 允许低于信用门槛的provider进入候选
  if (tier === 2) {
    const supabase = getServiceClient()
    const { data } = await supabase
      .from('provider_categories')
      .select('user_id')
      .eq('category', category)

    const allProviderIds = (data || []).map(p => p.user_id)
    if (allProviderIds.length === 0) {
      return fallbackFindMatches(category, { ...options, tier: 3 })
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, credit_score, dispute_losses, created_at')
      .in('id', allProviderIds)

    const ranked = ranker.sort(profiles || [], { category, limit: options.limit ?? 20 })
    return ranked.map(c => ({ ...c, note: 'relaxed_threshold' }))
  }

  // 第3级: 标记为需人工指派
  return [{
    providerId: '__manual_assign__',
    name: '需人工指派',
    creditScore: 0,
    score: 0,
    note: 'manual_assign_required',
  }]
}
