export interface CreditDimensions {
  integrity: number
  capability: number
  reliability: number
  communication: number
  safety: number
  contribution: number
}

export const COMPOSITE_WEIGHTS: Record<keyof CreditDimensions, number> = {
  integrity: 0.25,
  capability: 0.20,
  reliability: 0.20,
  communication: 0.15,
  safety: 0.15,
  contribution: 0.05,
}

export function ageFactor(createdAt: Date): number {
  const daysSinceFirst = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
  return Math.min(1, daysSinceFirst / 30)
}

export function decayFactor(lastActiveAt: Date | null): number {
  if (!lastActiveAt) return 1
  const idleDays = (Date.now() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, 1 - 0.01 * idleDays)
}

export function coldStartProtection(validCount: number): boolean {
  return validCount < 3
}

export function computeCompositeScore(
  dims: CreditDimensions,
  options?: { age?: number; decay?: number },
): number {
  const age = options?.age ?? 1
  const decay = options?.decay ?? 1

  let score = 0
  for (const key of Object.keys(COMPOSITE_WEIGHTS) as (keyof CreditDimensions)[]) {
    score += dims[key] * COMPOSITE_WEIGHTS[key]
  }
  score *= age * decay

  return Math.round(Math.max(0, Math.min(100, score)))
}

export function computeTotalScore(
  providerScore: number,
  customerScore: number,
  providerWeight: number = 0.6,
): number {
  return Math.round(
    Math.max(0, providerScore * providerWeight + customerScore * (1 - providerWeight)),
  )
}
