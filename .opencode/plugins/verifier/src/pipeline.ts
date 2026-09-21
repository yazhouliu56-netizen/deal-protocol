import { generateCandidates } from "./generator"
import { runL1Check, type SpawnFn } from "./l1-executor"
import { JUDGE_SYSTEM_PROMPT, rankCandidates } from "./l2-verifier"
import {
  TOOL_NAME,
  type CandidateSolution,
  type L1CheckResult,
  type L2RankResult,
  type LlmComplete,
  type VerifierConfig,
} from "./types"

export interface PipelineArgs {
  task: string
  code: string
  testCommand?: string
}

export interface PipelineDeps {
  config: VerifierConfig
  llm: LlmComplete
  /** Working directory for the L1 deterministic command. */
  cwd: string
  spawn?: SpawnFn
  onProgress?: (status: string) => void | Promise<void>
}

export interface PipelineResult {
  output: string
  metadata: Record<string, unknown>
}

function formatL1Summary(l1: L1CheckResult[]): string {
  if (l1.length === 0) return "- skipped (no command configured)"
  return l1
    .map(
      (r) =>
        `- ${r.command} -> ${r.passed ? "PASSED" : "FAILED"} (exit ${r.exitCode})` +
        (r.stderr.trim() ? `\n  stderr: ${r.stderr.trim().slice(0, 500)}` : ""),
    )
    .join("\n")
}

function formatResult(
  rank: L2RankResult,
  candidates: CandidateSolution[],
  l1: L1CheckResult[],
): string {
  const best = candidates.find((c) => c.index === rank.bestIndex)
  return [
    "Verification complete.",
    "",
    `L1 deterministic checks:`,
    formatL1Summary(l1),
    "",
    `L2 comparative ranking: [${rank.ranking.join(", ")}] (best: #${rank.bestIndex})`,
    ...Object.entries(rank.reasons).map(([index, reason]) => `  #${index}: ${reason}`),
    "",
    `Critique: ${rank.critique}`,
    "",
    "=== Best candidate ===",
    best?.code ?? "(no candidate)",
  ].join("\n")
}

/**
 * Framework-free verification core: L1 deterministic checks, parallel
 * candidate sampling across a temperature ladder, then LLM comparative
 * ranking. Throws on unexpected failures; callers translate to tool results.
 */
export async function runVerification(
  args: PipelineArgs,
  deps: PipelineDeps,
): Promise<PipelineResult> {
  const { config, llm, cwd, spawn, onProgress } = deps
  const notify = async (status: string) => {
    await onProgress?.(status)
  }

  await notify(`${TOOL_NAME}: L1 check`)

  const command = args.testCommand ?? config.defaultL1Command
  const l1Results: L1CheckResult[] = []
  if (command && command.trim().length > 0) {
    l1Results.push(await runL1Check({ command, cwd, spawn }))
  }

  await notify(`${TOOL_NAME}: sampling ${config.numCandidates} candidates`)

  const candidates = await generateCandidates({
    task: args.task,
    baselineCode: args.code,
    numCandidates: config.numCandidates,
    temperatures: config.temperatures,
    complete: llm,
  })

  await notify(`${TOOL_NAME}: L2 judging ${candidates.length} candidates`)

  const rank = await rankCandidates({
    task: args.task,
    baselineCode: args.code,
    candidates,
    l1Results,
    complete: llm,
  })

  const best = candidates.find((c) => c.index === rank.bestIndex)

  return {
    output: formatResult(rank, candidates, l1Results),
    metadata: {
      rejected: false,
      judgeSystemPromptChars: JUDGE_SYSTEM_PROMPT.length,
      l1: l1Results,
      ranking: rank.ranking,
      bestIndex: rank.bestIndex,
      reasons: rank.reasons,
      critique: rank.critique,
      bestCode: best?.code ?? null,
      sampledCandidates: candidates.length,
      temperatures: candidates.map((c) => c.temperature),
    },
  }
}
