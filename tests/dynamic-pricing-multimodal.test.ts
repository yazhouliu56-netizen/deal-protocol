import { describe, it, expect } from 'vitest'
import { estimateDynamicPricingAndMatchRate } from '../src/modules/m03-category-config/pricing-engine'

describe('Dynamic Pricing — Multi-Modal AI Engine', () => {
  it('should return AUTO_RECOMMENDED when buyer has no budget', async () => {
    const result = await estimateDynamicPricingAndMatchRate({
      categorySlug: 'electrician',
      durationHours: 3,
      description: '电路跳闸需要上门检修',
    })

    expect(result.priceStatus).toBe('AUTO_RECOMMENDED')
    expect(result.isUserBudgetProvided).toBe(false)
    expect(result.userBudget).toBe(0)
    expect(result.suggestedOptimalPrice).toBeGreaterThan(0)
    expect(result.estimatedMatchProbability).toBe(90)
    expect(result.marketAdvice).toContain('AI')
    expect(result.complexityFactor).toBe(1.0)
  })

  it('should increase complexity factor with mediaUrls and severe keywords', async () => {
    const result = await estimateDynamicPricingAndMatchRate({
      categorySlug: 'plumbing',
      durationHours: 2,
      description: '水管严重爆裂急需维修，大面积渗水',
      mediaUrls: [
        'https://example.com/photo1.jpg',
        'https://example.com/photo2.jpg',
        'https://example.com/photo3.jpg',
        'https://example.com/photo4.jpg',
      ],
    })

    // 3 photos × 0.1 + "严重" keyword + "大面积" keyword
    expect(result.complexityFactor).toBeGreaterThan(1.3)
    expect(result.suggestedOptimalPrice).toBeGreaterThan(80 * 2 * 1.0)
    expect(result.marketAdvice).toContain('AI')
  })

  it('should return UNDERPRICED when budget is too low', async () => {
    const result = await estimateDynamicPricingAndMatchRate({
      categorySlug: 'cleaning',
      durationHours: 4,
      description: '全屋深度清洁',
      budget: 80,
    })

    expect(result.priceStatus).toBe('UNDERPRICED')
    expect(result.isUserBudgetProvided).toBe(true)
    expect(result.userBudget).toBe(80)
    expect(result.estimatedMatchProbability).toBeLessThan(50)
    expect(result.marketAdvice).toContain('低于')
    expect(result.suggestedOptimalPrice).toBeGreaterThan(result.userBudget)
  })

  it('should return PREMIUM when budget is well above market', async () => {
    const result = await estimateDynamicPricingAndMatchRate({
      categorySlug: 'massage',
      durationHours: 1,
      description: '肩颈按摩',
      budget: 500,
    })

    expect(result.priceStatus).toBe('PREMIUM')
    expect(result.estimatedMatchProbability).toBe(98)
    expect(result.marketAdvice).toContain('高于')
  })

  it('should return FAIR when budget is within reasonable range', async () => {
    const result = await estimateDynamicPricingAndMatchRate({
      categorySlug: 'moving',
      durationHours: 3,
      description: '搬家搬运',
      budget: 240,
    })

    expect(result.priceStatus).toBe('FAIR')
    expect(result.isUserBudgetProvided).toBe(true)
    expect(result.estimatedMatchProbability).toBeGreaterThanOrEqual(75)
    expect(result.estimatedMatchProbability).toBeLessThanOrEqual(95)
  })
})
