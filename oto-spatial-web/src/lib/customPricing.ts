/**
 * Custom-condition pricing: a straight-tier surcharge ladder.
 * 第 1 个定制 +15%，第 2 个 +30%，第 3 个 +45%… (15% × N, confirmed).
 * Base price is the responder's / platform's base; demanders may override
 * with a manual amount (bargaining) instead.
 */

export const ADD_RATE = 0.15;

/** 15% × count — straight-line ladder. */
export function customSurcharge(base: number, customCount: number): number {
  if (customCount <= 0) return 0;
  return Math.round(base * ADD_RATE * customCount);
}

/** Suggested offer price = base + ladder surcharge. */
export function suggestedPrice(base: number, customCount: number): number {
  return base + customSurcharge(base, customCount);
}

/** Display "¥xx" helper. */
export function yuan(value: number): string {
  return `¥${Math.round(value)}`;
}

/**
 * Suggested amount a demander is nudged toward when the platform detects a
 * wave keeps failing to match (加价建议): base + full ladder.
 */
export function raiseSuggestion(base: number, customCount: number): number {
  return suggestedPrice(base, customCount) + Math.round(base * 0.2);
}