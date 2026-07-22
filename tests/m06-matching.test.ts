// M06 测试：匹配路由
import { describe, it, expect } from 'vitest'
import { StaticRanker } from '../src/modules/m06-matching-routing/matcher'
import type { CandidateProvider } from '../src/lib/contracts'

describe('M06 Matching Router', () => {
  describe('StaticRanker', () => {
    const ranker = new StaticRanker()

    it('should sort by credit_score*20 - distance/100', async () => {
      const candidates: CandidateProvider[] = [
        { provider_id: 'A', distance_m: 1000, credit_score: 80, category_score: 75, skills: ['cleaning'] },
        { provider_id: 'B', distance_m: 500, credit_score: 70, category_score: 80, skills: ['cleaning'] },
        { provider_id: 'C', distance_m: 200, credit_score: 90, category_score: 85, skills: ['cleaning'] },
      ]

      const ranked = await ranker.rank(candidates)
      expect(ranked[0]!.provider_id).toBe('C') // 90*20 - 2 = 1798
      expect(ranked[1]!.provider_id).toBe('A') // 80*20 - 10 = 1590
      expect(ranked[2]!.provider_id).toBe('B') // 70*20 - 5 = 1395
    })

    it('should handle empty list', async () => {
      const ranked = await ranker.rank([])
      expect(ranked).toEqual([])
    })

    it('should handle single candidate', async () => {
      const candidates: CandidateProvider[] = [
        { provider_id: 'A', distance_m: 500, credit_score: 60, category_score: 60, skills: [] },
      ]
      const ranked = await ranker.rank(candidates)
      expect(ranked).toHaveLength(1)
      expect(ranked[0]!.provider_id).toBe('A')
    })
  })
})
