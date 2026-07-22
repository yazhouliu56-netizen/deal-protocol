// M03 测试：品类配置校验器
import { describe, it, expect } from 'vitest'
import { validateConfig } from '../src/modules/m03-category-config/category-loader'

describe('M03 Category Config Validator', () => {
  it('should reject empty category', () => {
    const errors = validateConfig({})
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some((e) => e.field === 'category')).toBe(true)
  })

  it('should reject missing risk_tier', () => {
    const errors = validateConfig({ category: 'test' })
    expect(errors.some((e) => e.field === 'risk_tier')).toBe(true)
  })

  it('should reject invalid risk_tier', () => {
    const errors = validateConfig({ category: 'test', risk_tier: 'extreme' as any })
    expect(errors.some((e) => e.message.includes('low, medium, or high'))).toBe(true)
  })

  it('should enforce manual_review for high risk tier', () => {
    const errors = validateConfig({
      category: 'test',
      risk_tier: 'high',
      entry_requirements: { identity_verified: true },
    })
    expect(errors.some((e) => e.field === 'entry_requirements.manual_review')).toBe(true)
  })

  it('should allow high risk tier with manual_review=true', () => {
    const errors = validateConfig({
      category: 'test',
      risk_tier: 'high',
      entry_requirements: { identity_verified: true, manual_review: true },
    })
    expect(errors.some((e) => e.field === 'entry_requirements.manual_review')).toBe(false)
  })

  it('should reject invalid response_mode', () => {
    const errors = validateConfig({
      category: 'test',
      risk_tier: 'low',
      response_mode: 'invalid_mode' as any,
    })
    expect(errors.some((e) => e.field === 'response_mode')).toBe(true)
  })

  it('should reject grab_first for 医疗陪护', () => {
    const errors = validateConfig({
      category: '医疗陪护',
      risk_tier: 'high',
      entry_requirements: { manual_review: true },
      response_mode: 'grab_first',
    })
    expect(errors.some((e) => e.message.includes('Medical escort'))).toBe(true)
  })
})
