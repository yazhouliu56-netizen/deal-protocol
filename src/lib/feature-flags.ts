interface TargetRules {
  cities?: string[]
  user_ids?: string[]
  min_credit_score?: number
  categories?: string[]
}

interface FeatureFlag {
  key: string
  enabled: boolean
  rollout_percentage: number
  target_rules: TargetRules
}

interface UserContext {
  id: string
  city?: string
  credit_score?: number
  category?: string
}

function isEnabled(flag: FeatureFlag, user?: UserContext): boolean {
  if (!flag.enabled) return false

  if (flag.rollout_percentage < 100 && user) {
    const hash = hashString(`${flag.key}:${user.id}`)
    if (hash % 100 >= flag.rollout_percentage) return false
  }

  const rules = flag.target_rules
  if (user) {
    if (rules.cities && rules.cities.length > 0) {
      if (!user.city || !rules.cities.includes(user.city)) return false
    }
    if (rules.user_ids && rules.user_ids.length > 0) {
      if (!rules.user_ids.includes(user.id)) return false
    }
    if (rules.min_credit_score !== undefined) {
      if ((user.credit_score ?? 0) < rules.min_credit_score) return false
    }
    if (rules.categories && rules.categories.length > 0) {
      if (!user.category || !rules.categories.includes(user.category)) return false
    }
  }

  return true
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

export type { FeatureFlag, TargetRules, UserContext }
export { isEnabled }
