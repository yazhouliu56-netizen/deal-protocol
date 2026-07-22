// M06: Ranker 接口 + 默认静态排序实现
// 设计方案§4.3: 排序逻辑封装为可替换接口，为 M08 Bandit 预留插槽

export interface MatchCandidate {
  providerId: string
  name: string
  creditScore: number
  score: number
  note?: string
}

export interface RankerContext {
  category: string
  limit: number
}

export interface Ranker {
  sort(profiles: RankableProfile[], ctx: RankerContext): MatchCandidate[]
}

export interface RankableProfile {
  id: string
  name: string
  credit_score: number
  dispute_losses: number
  created_at: string
}

// 默认静态评分 Ranker
// 评分 = category_score × 20 - distance / 100
// 设计方案§4.3 默认排序公式
const DEFAULT_WEIGHTS = {
  creditWeight: 0.5,
  experienceWeight: 0.2,
  reliabilityWeight: 0.2,
  baseWeight: 0.1,
}

export const staticRanker: Ranker = {
  sort(profiles: RankableProfile[], _ctx: RankerContext): MatchCandidate[] {
    const now = Date.now()
    const ninetyDays = 90 * 24 * 60 * 60 * 1000

    return profiles.map(p => {
      const creditWeight = Math.min(1, (p.credit_score ?? 0) / 1000) * DEFAULT_WEIGHTS.creditWeight
      const experienceWeight = Math.min(1, (now - new Date(p.created_at).getTime()) / ninetyDays) * DEFAULT_WEIGHTS.experienceWeight
      const reliabilityWeight = Math.max(0, 1 - ((p.dispute_losses ?? 0) / Math.max(1, 5))) * DEFAULT_WEIGHTS.reliabilityWeight
      const baseWeight = DEFAULT_WEIGHTS.baseWeight

      return {
        providerId: p.id,
        name: p.name,
        creditScore: p.credit_score ?? 0,
        score: Math.round((creditWeight + experienceWeight + reliabilityWeight + baseWeight) * 100),
      }
    }).sort((a, b) => b.score - a.score)
  },
}
