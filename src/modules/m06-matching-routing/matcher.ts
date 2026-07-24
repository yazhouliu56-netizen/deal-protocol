import { getSupabase } from '@/lib/supabase-client'
import { matchNearby } from '@/modules/m05-geo-index/geo-service'
import { getCategoryConfig } from '@/modules/m03-category-config/category-loader'
import { getCreditScore, isColdStart, getNewbornProtectionFactor, getWeekendMultiplier } from '@/modules/m07-credit/credit-engine'
import { getCreditTierPrivileges } from '@/lib/credit-privileges'
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

  const candidateRecords: CandidateProvider[] = []

  for (const geo of geoResults) {
    const credit = creditMap.get(geo.provider_id)
    if (!credit || credit.baseScore < minCredit) continue

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
        let cs = credit.baseScore
        if (await isColdStart(geo.provider_id, config.category)) {
          cs = Math.round(cs * 0.5)
        }
        const newbornFactor = getNewbornProtectionFactor(credit.baseTotalDeals)
        const weekendMul = getWeekendMultiplier()
        cs = Math.round(cs * newbornFactor * weekendMul * 100) / 100
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

  await getSupabase()
    .from('protocols')
    .update({ status: 'matching' })
    .eq('id', protocolId)

  return {
    candidateIds: topCandidates.map((c) => c.provider_id),
    responseMode,
    matchedCount: topCandidates.length,
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
  const { data } = await getSupabase()
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
    const { data } = await getSupabase()
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
  await getSupabase().from('evidence_log').insert({
    protocol_id: protocolId,
    event_type: 'match_empty',
    payload: { category, reason: 'No candidates found after all escalation steps' },
  })
  await getSupabase().from('admin_tasks').insert({
    protocol_id: protocolId,
    type: 'manual_assignment',
    payload: { category, reason: 'Empty candidate pool after 20km expansion' },
  })
  console.warn(`[M06] Empty candidate pool for protocol ${protocolId} (${category}) — admin_task created`)
}
