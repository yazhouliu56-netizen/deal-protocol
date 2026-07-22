import { getSupabase } from '@/lib/supabase-client'
import type { Ranker } from '@/modules/m06-matching-routing/matcher'
import type { CandidateProvider } from '@/lib/contracts'

export class BanditRanker implements Ranker {
  private epsilon: number

  constructor(epsilon = 0.1) {
    this.epsilon = epsilon
  }

  getEpsilon(): number {
    return this.epsilon
  }

  async rank(candidates: CandidateProvider[]): Promise<CandidateProvider[]> {
    const providerIds = candidates.map((c) => c.provider_id)

    const { data: stats } = await getSupabase()
      .from('bandit_stats')
      .select('provider_id, impressions, conversions')
      .in('provider_id', providerIds)

    const statsMap = new Map(
      (stats ?? []).map((s) => [s.provider_id, { impressions: s.impressions ?? 0, conversions: s.conversions ?? 0 }]),
    )

    return candidates
      .map((c) => {
        const s = statsMap.get(c.provider_id)
        const impressions = s?.impressions ?? 0
        const conversionRate = impressions > 0 ? (s?.conversions ?? 0) / impressions : 0
        const exploreBonus = this.epsilon * Math.random() * 100
        const score = conversionRate * 100 + exploreBonus

        return { ...c, _banditScore: score }
      })
      .sort((a, b) => (b as CandidateProvider & { _banditScore: number })._banditScore - (a as CandidateProvider & { _banditScore: number })._banditScore)
      .map(({ _banditScore, ...rest }) => rest as CandidateProvider)
  }
}

export async function recordReward(
  providerId: string,
  category: string,
  outcome: 'conversion' | 'click' | 'impression',
  weight = 1,
): Promise<void> {
  const delta = {
    conversion: { impressions: 0, clicks: 0, conversions: 1, reward_sum: weight },
    click: { impressions: 0, clicks: 1, conversions: 0, reward_sum: weight * 0.1 },
    impression: { impressions: 1, clicks: 0, conversions: 0, reward_sum: 0 },
  }

  const update = delta[outcome]
  const safeWeight = weight < 0 ? 0 : weight

  const { data: existing } = await getSupabase()
    .from('bandit_stats')
    .select('impressions, clicks, conversions, reward_sum')
    .eq('provider_id', providerId)
    .eq('category', category)
    .maybeSingle()

  if (existing) {
    await getSupabase()
      .from('bandit_stats')
      .update({
        impressions: (existing.impressions ?? 0) + update.impressions,
        clicks: (existing.clicks ?? 0) + update.clicks,
        conversions: (existing.conversions ?? 0) + update.conversions,
        reward_sum: (existing.reward_sum ?? 0) + safeWeight,
      })
      .eq('provider_id', providerId)
      .eq('category', category)
  } else {
    await getSupabase()
      .from('bandit_stats')
      .insert({
        provider_id: providerId,
        category,
        impressions: update.impressions,
        clicks: update.clicks,
        conversions: update.conversions,
        reward_sum: safeWeight,
      })
  }
}