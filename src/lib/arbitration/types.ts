export type DisputeTier = "EASY" | "MEDIUM" | "HARD"

export interface ArbitrationRequest {
  disputeId: string
  tier: DisputeTier
  reason: string
  evidence: string
  contractAmount: number
  serviceTitle: string
  initiatorId: string
  responderId: string
}

export interface CouncilVote {
  model: string
  persona: string
  verdict: string
  providerAmount: number
  customerAmount: number
  confidence: number
  reasoning: string
}

export interface ArbitrationVerdict {
  resolution: string
  providerAmount: number
  customerAmount: number
  confidence: number
  loserId: string
  councilVotes?: CouncilVote[]
}
