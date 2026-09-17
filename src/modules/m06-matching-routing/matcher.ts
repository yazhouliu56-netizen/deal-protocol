import { getServiceClient } from '@/lib/supabase-client'
import { matchNearby } from '@/modules/m05-geo-index/geo-service'
import { getCategoryConfig } from '@/modules/m03-category-config/category-loader'
import { getCreditScore, isColdStart, getNewbornProtectionFactor, getWeekendMultiplier } from '@/modules/m07-credit/credit-engine'
import { objectiveMultiplier } from '@/base/trust/bayesian-rating'
import { getObjectiveRates } from '@/lib/matching/objective-rate'
import { getBayesianTiers } from '@/lib/matching/bayesian-tier'
import { getCreditTierPrivileges } from '@/lib/credit-privileges'
import { getCachedSemanticScore } from '@/lib/semantic-matcher'
import type { CandidateProvider, ResponseMode } from '@/lib/contracts'

const VALID_RESPONSE_MODES: ResponseMode[] = ['grab_first', 'interest_list', 'agency_dispatch']

export interface Ranker {
  rank(candidates: CandidateProvider[]): Promise<CandidateProvider[]>
}

export class StaticRanker implements Ranker {
  async rank(candidates: CandidateProvider[]): Promise<CandidateProvider[]> {
    return candidates.sort((a, b) => {
      const tierA = getCreditTierPrivileges(a.credit_score)
      const tierB = getCreditTierPrivileges(b.credit_score)
      const scoreA = a.credit_score * 20 * tierA.matchingWeight - a.distance_m / 100
      const scoreB = b.credit_score * 20 * tierB.matchingWeight - b.distance_m / 100
      return scoreB - scoreA
    })
  }
}

let currentRanker: Ranker = new StaticRanker()

export function setRanker(ranker: Ranker): void {
  currentRanker = ranker
}

export function resetRanker(): void {
  currentRanker = new StaticRanker()
}

interface MatchInput {
  protocolId: string
  latitude: number
  longitude: number
  category: string
  requiredSkills?: string[]
}

interface MatchResult {
  candidateIds: string[]
  responseMode: ResponseMode
  matchedCount: number
}

function validateConfig(config: NonNullable<Awaited<ReturnType<typeof getCategoryConfig>>>): void {
  if (!VALID_RESPONSE_MODES.includes(config.response_mode)) {
    throw new Error(`Invalid response_mode "${config.response_mode}" for category "${config.category}"`)
  }
}

export async function routeProtocol(input: MatchInput): Promise<MatchResult> {
  const config = await getCategoryConfig(input.category)
  if (!config) {
    throw new Error(`Category "${input.category}" not configured`)
  }

  const safeConfig = config!

  validateConfig(safeConfig)

  const responseMode = safeConfig.response_mode as ResponseMode

  const geoCandidates = await matchNearby({
    lat: input.latitude,
    lng: input.longitude,
    radiusKm: 5,
    category: input.category,
    requiredSkills: input.requiredSkills,
  })

  if (geoCandidates.length === 0) {
    const expandedCandidates = await matchNearby({
      lat: input.latitude,
      lng: input.longitude,
      radiusKm: 10,
      category: input.category,
      requiredSkills: input.requiredSkills,
    })

    if (expandedCandidates.length === 0) {
      const furtherCandidates = await matchNearby({
        lat: input.latitude,
        lng: input.longitude,
        radiusKm: 20,
        category: input.category,
        requiredSkills: input.requiredSkills,
      })

      if (furtherCandidates.length === 0) {
        await logEmptyPool(input.protocolId, input.category)
        return { candidateIds: [], responseMode, matchedCount: 0 }
      }

      return await processCandidates(furtherCandidates, input.protocolId, responseMode, safeConfig, input.category)
    }

    return await processCandidates(expandedCandidates, input.protocolId, responseMode, safeConfig, input.category)
  }

  return await processCandidates(geoCandidates, input.protocolId, responseMode, safeConfig, input.category)
}

async function processCandidates(
  geoResults: Awaited<ReturnType<typeof matchNearby>>,
  protocolId: string,
  responseMode: ResponseMode,
  config: NonNullable<Awaited<ReturnType<typeof getCategoryConfig>>>,
  category?: string,
): Promise<MatchResult> {
  const entryReqs = config.entry_requirements as Record<string, unknown> | null
  const minCredit = entryReqs?.manual_review ? 70 : 50

  const providerIds = geoResults.map((g) => g.provider_id)

  const creditResults = await batchLoadCreditScores(providerIds)
  const creditMap = new Map(creditResults.map((c) => [c.userId, c]))

  const { data: walletData } = await getServiceClient()
    .from('provider_wallets')
    .select('provider_id, deposit_amount, is_staked')
    .in('provider_id', providerIds)
  const depositMap = new Map((walletData ?? []).map((w) => [w.provider_id, { depositAmount: Number(w.deposit_amount ?? 0), isStaked: !!w.is_staked }]))

  // R7 客观率加权（用户裁决 2026-09-18，A 温和口径）：批量派生一次，
  // 失败回空 Map→乘子 1.0（宪法 #10，不拦派单）。
  const objectiveMap = await getObjectiveRates(providerIds)

  // B 贝叶斯定档上线（用户裁决 2026-09-18）：批量定档一次，失败回空 Map→全放行（#10）。
  const tierMap = await getBayesianTiers(providerIds, { category: config.category })

  // P5a 定制过滤（用户裁决 2026-09-18）：有活跃定制项的单只派给开关打开的师傅；
  // 开关表缺席/查询失败→放行（#10，不拦派单）。
  let needsCustom = false
  const customOk = new Set<string>()
  try {
    const { data: linked } = await getServiceClient()
      .from("demands")
      .select("id")
      .eq("protocol_id", protocolId)
      .limit(1)
    const demandId = ((linked ?? []) as { id: string }[])[0]?.id
    if (demandId) {
      const { data: items } = await getServiceClient()
        .from("demand_customizations")
        .select("id")
        .eq("demand_id", demandId)
        .eq("status", "active")
        .limit(1)
      needsCustom = ((items ?? []).length ?? 0) > 0
    }
    if (needsCustom) {
      const { data: profs } = await getServiceClient()
        .from("profiles")
        .select("id, accepts_custom")
        .in("id", providerIds)
      for (const p of ((profs ?? []) as { id: string; accepts_custom: boolean | null }[])) {
        if (p.accepts_custom !== false) customOk.add(p.id)
      }
    }
  } catch {
    needsCustom = false
  }

  const candidateRecords: CandidateProvider[] = []

  for (const geo of geoResults) {
    const credit = creditMap.get(geo.provider_id)
    if (!credit || credit.baseScore < minCredit) continue

    // B：贝叶斯最差档（tier 1）硬排除；null/缺席＝样本不足，放行（新人保护对齐）。
    if (tierMap.get(geo.provider_id)?.tier === 1) continue

    // P5a：定制单只派给开关打开的师傅（批量档案缺席＝无信用档案，本就不可派）。
    if (needsCustom && !customOk.has(geo.provider_id)) continue

    if (entryReqs?.qualification) {
      const quals = entryReqs.qualification as string[]
      const hasQuals = await checkQualifications(geo.provider_id, config.category, quals)
      if (!hasQuals) continue
    }

    let cs = credit.baseScore
    if (await isColdStart(geo.provider_id, config.category)) {
      cs = Math.round(cs * 0.5)
    }
    const newbornFactor = getNewbornProtectionFactor(credit.baseTotalDeals)
    const weekendMul = getWeekendMultiplier()
    cs = Math.round(cs * newbornFactor * weekendMul * 100) / 100

    const semanticScore = await getCachedSemanticScore(protocolId, geo.provider_id, config.category)
    const semanticMultiplier = 1 + semanticScore / 200
    cs = Math.round(cs * semanticMultiplier * 100) / 100

    const dep = depositMap.get(geo.provider_id)
    const depositMultiplier = dep?.isStaked && dep.depositAmount >= 500 ? 1.2 : 1.0
    cs = Math.round(cs * depositMultiplier * 100) / 100

    const objRate = objectiveMap.get(geo.provider_id)?.rate ?? null
    cs = Math.round(cs * objectiveMultiplier(objRate) * 100) / 100

    candidateRecords.push({
      provider_id: geo.provider_id,
      distance_m: geo.distance_m,
      credit_score: cs,
      category_score: credit.categoryScore ?? 0,
      skills: geo.skills,
    })
  }

  if (candidateRecords.length === 0) {
    for (const geo of geoResults) {
      const credit = creditMap.get(geo.provider_id)
      if (credit && credit.baseScore >= 30) {
        // P5a：降级池同样执行定制开关过滤。
        if (needsCustom && !customOk.has(geo.provider_id)) continue
        // B：降级池同样执行 tier 1 硬排除（最差档永不放单）。
        if (tierMap.get(geo.provider_id)?.tier === 1) continue
        let cs = credit.baseScore
        if (await isColdStart(geo.provider_id, config.category)) {
          cs = Math.round(cs * 0.5)
        }
        const newbornFactor = getNewbornProtectionFactor(credit.baseTotalDeals)
        const weekendMul = getWeekendMultiplier()
        cs = Math.round(cs * newbornFactor * weekendMul * 100) / 100
        const dep = depositMap.get(geo.provider_id)
        const depositMultiplier = dep?.isStaked && dep.depositAmount >= 500 ? 1.2 : 1.0
        cs = Math.round(cs * depositMultiplier * 100) / 100
        const objRate = objectiveMap.get(geo.provider_id)?.rate ?? null
        cs = Math.round(cs * objectiveMultiplier(objRate) * 100) / 100
        candidateRecords.push({
          provider_id: geo.provider_id,
          distance_m: geo.distance_m,
          credit_score: cs,
          category_score: credit.categoryScore ?? 0,
          skills: geo.skills,
        })
      }
    }
  }

  if (candidateRecords.length === 0) {
    await logEmptyPool(protocolId, config.category)
    return { candidateIds: [], responseMode, matchedCount: 0 }
  }

  const rankerToUse = await maybeActivateBandit(category ?? config.category, candidateRecords)
  const ranked = await rankerToUse.rank(candidateRecords)
  const topCandidates = ranked.slice(0, 10)

  const { data: tipProtocol } = await getServiceClient()
    .from('protocols')
    .select('core_fields')
    .eq('id', protocolId)
    .single()
  const hasTip = (tipProtocol?.core_fields as Record<string, unknown> ?? {}).has_tip === true
  const tipMultiplier = hasTip ? 1.5 : 1.0

  const boostedCandidates = topCandidates.map((c) => ({
    ...c,
    credit_score: Math.round(c.credit_score * tipMultiplier * 100) / 100,
  }))
  boostedCandidates.sort((a, b) => b.credit_score - a.credit_score)

  await getServiceClient()
    .from('protocols')
    .update({ status: 'matching' })
    .eq('id', protocolId)

  return {
    candidateIds: boostedCandidates.map((c) => c.provider_id),
    responseMode,
    matchedCount: boostedCandidates.length,
  }
}

async function batchLoadCreditScores(userIds: string[]): Promise<Array<{ userId: string; baseScore: number; categoryScore: number | null; baseTotalDeals: number }>> {
  const results = await Promise.all(userIds.map((uid) => getCreditScore(uid)))
  return userIds.map((userId, i) => ({
    userId,
    baseScore: results[i].baseScore,
    categoryScore: results[i].categoryScore,
    baseTotalDeals: results[i].baseTotalDeals,
  }))
}

async function checkQualifications(
  userId: string,
  category: string,
  requiredQuals: string[],
): Promise<boolean> {
  const { data } = await getServiceClient()
    .from('provider_qualifications')
    .select('qualification_type, verified')
    .eq('user_id', userId)
    .eq('category', category)

  if (!data || data.length === 0) return false

  const verifiedQuals = data
    .filter((q) => q.verified)
    .map((q) => q.qualification_type)

  return requiredQuals.every((rq) => verifiedQuals.includes(rq))
}

const MONTHLY_ORDER_THRESHOLD = 30

async function maybeActivateBandit(category: string, candidates: CandidateProvider[]): Promise<Ranker> {
  if (currentRanker instanceof StaticRanker === false) return currentRanker

  for (const c of candidates) {
    const { data } = await getServiceClient()
      .from('credit_records')
      .select('base_total_deals')
      .eq('user_id', c.provider_id)
      .maybeSingle()

    const deals = (data?.base_total_deals as number) ?? 0
    if (deals >= MONTHLY_ORDER_THRESHOLD) {
      const { BanditRanker } = await import('@/modules/m08-bandit/bandit-ranker')
      const bandit = new BanditRanker(0.1)
      setRanker(bandit)
      console.log(`[M06] Bandit ranker auto-activated: provider ${c.provider_id} has ${deals} deals`)
      return bandit
    }
  }

  return currentRanker
}

async function logEmptyPool(protocolId: string, category: string): Promise<void> {
  await getServiceClient().from('evidence_log').insert({
    protocol_id: protocolId,
    event_type: 'match_empty',
    payload: { category, reason: 'No candidates found after all escalation steps' },
  })
  await getServiceClient().from('admin_tasks').insert({
    protocol_id: protocolId,
    type: 'manual_assignment',
    payload: { category, reason: 'Empty candidate pool after 20km expansion' },
  })
  console.warn(`[M06] Empty candidate pool for protocol ${protocolId} (${category}) — admin_task created`)
}
