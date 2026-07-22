import { describe, it, expect } from 'vitest'
import { isEnabled } from '@/lib/feature-flags'
import type { FeatureFlag, UserContext } from '@/lib/feature-flags'

describe('M15 Feature Flags', () => {
  it('disabled flag always returns false', () => {
    const flag: FeatureFlag = {
      key: 'test.feature',
      enabled: false,
      rollout_percentage: 100,
      target_rules: {},
    }

    expect(isEnabled(flag)).toBe(false)
    expect(isEnabled(flag, { id: 'user-1' })).toBe(false)
  })

  it('enabled flag with no rules returns true', () => {
    const flag: FeatureFlag = {
      key: 'test.feature',
      enabled: true,
      rollout_percentage: 100,
      target_rules: {},
    }

    expect(isEnabled(flag)).toBe(true)
    expect(isEnabled(flag, { id: 'user-1' })).toBe(true)
  })

  it('user in whitelist gets enabled', () => {
    const flag: FeatureFlag = {
      key: 'test.feature',
      enabled: true,
      rollout_percentage: 100,
      target_rules: { user_ids: ['user-1'] },
    }

    expect(isEnabled(flag, { id: 'user-1' })).toBe(true)
    expect(isEnabled(flag, { id: 'user-2' })).toBe(false)
  })

  it('city restriction works correctly', () => {
    const flag: FeatureFlag = {
      key: 'test.feature',
      enabled: true,
      rollout_percentage: 100,
      target_rules: { cities: ['Shanghai', 'Beijing'] },
    }

    expect(isEnabled(flag, { id: 'u1', city: 'Shanghai' })).toBe(true)
    expect(isEnabled(flag, { id: 'u2', city: 'Beijing' })).toBe(true)
    expect(isEnabled(flag, { id: 'u3', city: 'Nanjing' })).toBe(false)
    expect(isEnabled(flag, { id: 'u4' })).toBe(false)
  })

  it('credit score restriction works', () => {
    const flag: FeatureFlag = {
      key: 'test.feature',
      enabled: true,
      rollout_percentage: 100,
      target_rules: { min_credit_score: 700 },
    }

    expect(isEnabled(flag, { id: 'u1', credit_score: 800 })).toBe(true)
    expect(isEnabled(flag, { id: 'u2', credit_score: 700 })).toBe(true)
    expect(isEnabled(flag, { id: 'u3', credit_score: 600 })).toBe(false)
    expect(isEnabled(flag, { id: 'u4' })).toBe(false)
  })

  it('category restriction works', () => {
    const flag: FeatureFlag = {
      key: 'test.feature',
      enabled: true,
      rollout_percentage: 100,
      target_rules: { categories: ['cleaning', 'moving'] },
    }

    expect(isEnabled(flag, { id: 'u1', category: 'cleaning' })).toBe(true)
    expect(isEnabled(flag, { id: 'u2', category: 'moving' })).toBe(true)
    expect(isEnabled(flag, { id: 'u3', category: 'repair' })).toBe(false)
    expect(isEnabled(flag, { id: 'u4' })).toBe(false)
  })
})
