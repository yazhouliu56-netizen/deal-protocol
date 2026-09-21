import { z } from "zod"

/** Canonical tool name registered by the plugin. Single source of truth. */
export const TOOL_NAME = "verify_and_optimize"

export const VerifierConfigSchema = z.object({
  numCandidates: z.number().int().min(2).max(5).default(3),
  temperatures: z.array(z.number()).default([0.2, 0.7, 1.0]),
  defaultL1Command: z.string().optional(),
})

export type VerifierConfig = z.infer<typeof VerifierConfigSchema>

export interface CandidateSolution {
  index: number
  temperature: number
  code: string
  rawResponse?: string
}

export interface L1CheckResult {
  passed: boolean
  command: string
  stdout: string
  stderr: string
  exitCode: number
}

export interface L2RankResult {
  bestIndex: number
  ranking: number[]
  reasons: Record<number, string>
  critique: string
}

export interface LlmCompleteRequest {
  prompt: string
  system?: string
  temperature: number
}

/**
 * Minimal LLM transport abstraction. The plugin ships a default implementation
 * backed by the OpenCode SDK client; tests and advanced setups inject their own.
 */
export type LlmComplete = (request: LlmCompleteRequest) => Promise<string>
