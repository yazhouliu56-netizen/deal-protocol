export { singleArbitrate } from "./llm-arbitrator"
export { councilArbitrate } from "./council-arbitrator"
export type { ArbitrationRequest, ArbitrationVerdict, CouncilVote, DisputeTier } from "./types"

import { singleArbitrate } from "./llm-arbitrator"
import { councilArbitrate } from "./council-arbitrator"
import type { ArbitrationRequest, ArbitrationVerdict, DisputeTier } from "./types"

// 设计方案§4.2.4: 置信度阈值
// ≥0.85 → LLM裁决自动生效
// <0.85 → 升级人工复核
export const CONFIDENCE_AUTO_EXECUTE_THRESHOLD = 0.85

export async function arbitrate(req: ArbitrationRequest): Promise<ArbitrationVerdict> {
  switch (req.tier) {
    case "EASY":
      return singleArbitrate(req)
    case "MEDIUM":
      return councilArbitrate(req)
    case "HARD":
      throw new Error("HARD 级别争议需人工仲裁")
    default:
      return singleArbitrate(req)
  }
}

export function determineTier(amount: number): DisputeTier {
  if (amount <= 200) return "EASY"
  if (amount <= 2000) return "MEDIUM"
  return "HARD"
}

/**
 * 检查仲裁裁决置信度是否达到自动执行阈值
 * 返回 true = 可自动生效，false = 需升级人工复核
 */
export function canAutoExecute(verdict: ArbitrationVerdict): boolean {
  return verdict.confidence >= CONFIDENCE_AUTO_EXECUTE_THRESHOLD
}
