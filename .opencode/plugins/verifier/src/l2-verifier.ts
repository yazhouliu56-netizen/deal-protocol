import type { CandidateSolution, L1CheckResult, L2RankResult, LlmComplete } from "./types"

const OUTPUT_SAMPLE_LIMIT = 2000

export const JUDGE_SYSTEM_PROMPT = [
  "You are a strict senior code reviewer acting as a comparative judge.",
  "You will be shown several candidate solutions for the same task.",
  "Compare them head-to-head (tournament style); never assign independent absolute scores.",
  "Evaluate every candidate against these criteria:",
  "1. Correctness & edge-case handling",
  "2. Time and space efficiency",
  "3. Readability & type safety",
  "Respond with ONLY one JSON object, no prose, no Markdown fences.",
].join("\n")

function truncate(text: string): string {
  return text.length > OUTPUT_SAMPLE_LIMIT ? `${text.slice(0, OUTPUT_SAMPLE_LIMIT)}...[truncated]` : text
}

export function buildJudgePrompt(options: {
  task: string
  baselineCode: string
  candidates: CandidateSolution[]
  l1Results: L1CheckResult[]
}): string {
  const { task, baselineCode, candidates, l1Results } = options

  const l1Section = l1Results.length
    ? l1Results
        .map(
          (r) =>
            `Command: ${r.command}\nResult: ${r.passed ? "PASSED" : "FAILED"} (exit code ${r.exitCode})\n` +
            `stdout:\n${truncate(r.stdout)}\nstderr:\n${truncate(r.stderr)}`,
        )
        .join("\n---\n")
    : "No deterministic L1 checks were run."

  const candidateSections = candidates
    .map((c) => {
      const baselineBroken = l1Results.some((r) => !r.passed)
      const l1ForCandidate = baselineBroken
        ? "Note: the baseline failed at least one L1 check; prefer candidates that would fix it."
        : ""
      return [
        `### Candidate #${c.index} (temperature ${c.temperature})`,
        "```",
        truncate(c.code),
        "```",
        l1ForCandidate,
      ]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n\n")

  return [
    `Task given to the model:`,
    "",
    task,
    "",
    "Baseline implementation (already rejected or unverified):",
    "",
    "```",
    truncate(baselineCode),
    "```",
    "",
    "L1 deterministic verification feedback (linter / tests / type check):",
    l1Section,
    "",
    "Candidates to compare and rank:",
    "",
    candidateSections,
    "",
    "Evaluation criteria (weigh every candidate against all others):",
    "1. Correctness & edge-case handling",
    "2. Time and space efficiency",
    "3. Readability & type safety",
    "",
    "Rank ALL candidates from best to worst by comparing them against each other.",
    'Return ONLY this exact JSON shape (keys "reasons" map candidate index to a short justification):',
    "```json",
    JSON.stringify(
      {
        bestIndex: candidates[0]?.index ?? 0,
        ranking: candidates.map((c) => c.index),
        reasons: { [String(candidates[0]?.index ?? 0)]: "Handles edge cases cleanly" },
        critique: "One-paragraph overall assessment.",
      },
      null,
      2,
    ),
    "```",
  ].join("\n")
}

/**
 * Resilient parser for judge output: extracts the outermost JSON object via
 * regex (`/\{[\s\S]*\}/`) so responses wrapped in backticks/prose still parse.
 * Returns null when nothing parseable/valid is found — callers must fall back.
 */
export function parseRanking(raw: string): L2RankResult | null {
  const match = /\{[\s\S]*\}/.exec(raw)
  if (!match) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(match[0])
  } catch {
    return null
  }

  if (typeof parsed !== "object" || parsed === null) return null
  const record = parsed as Record<string, unknown>

  if (typeof record.bestIndex !== "number" || !Number.isFinite(record.bestIndex)) return null

  if (
    !Array.isArray(record.ranking) ||
    record.ranking.some((v) => typeof v !== "number" || !Number.isFinite(v))
  ) {
    return null
  }

  const reasons: Record<number, string> = {}
  if (typeof record.reasons === "object" && record.reasons !== null) {
    for (const [key, value] of Object.entries(record.reasons as Record<string, unknown>)) {
      if (typeof value !== "string") continue
      const index = Number(key)
      if (!Number.isNaN(index)) reasons[index] = value
    }
  }

  return {
    bestIndex: record.bestIndex,
    ranking: record.ranking,
    reasons,
    critique: typeof record.critique === "string" ? record.critique : "",
  }
}

/**
 * Normalize a parsed ranking so it only references known candidate indices,
 * contains each candidate exactly once, and points bestIndex at a real candidate.
 */
export function normalizeRanking(parsed: L2RankResult, candidates: CandidateSolution[]): L2RankResult {
  const known = new Set(candidates.map((c) => c.index))

  const ranking: number[] = []
  for (const index of parsed.ranking) {
    if (known.has(index) && !ranking.includes(index)) ranking.push(index)
  }
  for (const c of candidates) {
    if (!ranking.includes(c.index)) ranking.push(c.index)
  }

  const bestIndex = known.has(parsed.bestIndex) ? parsed.bestIndex : ranking[0]!

  const reasons: Record<number, string> = {}
  for (const [key, value] of Object.entries(parsed.reasons)) {
    const index = Number(key)
    if (!Number.isNaN(index) && known.has(index)) reasons[index] = value
  }

  return { bestIndex, ranking, reasons, critique: parsed.critique }
}

/**
 * Run L2 comparative judging. If the judge response is missing or malformed,
 * a safe fallback is returned: original input order with an explanatory critique.
 */
export async function rankCandidates(options: {
  task: string
  baselineCode: string
  candidates: CandidateSolution[]
  l1Results: L1CheckResult[]
  complete: LlmComplete
}): Promise<L2RankResult> {
  const { task, baselineCode, candidates, l1Results, complete } = options

  const fallback: L2RankResult = {
    bestIndex: candidates[0]?.index ?? 0,
    ranking: candidates.map((c) => c.index),
    reasons: {},
    critique: "L2 judge returned no parsable ranking; fell back to input order.",
  }

  if (candidates.length === 0) return fallback

  let raw: string
  try {
    raw = await complete({
      prompt: buildJudgePrompt({ task, baselineCode, candidates, l1Results }),
      system: JUDGE_SYSTEM_PROMPT,
      temperature: 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ...fallback, critique: `${fallback.critique} Judge call failed: ${message}` }
  }

  const parsed = parseRanking(raw)
  if (!parsed) return fallback

  return normalizeRanking(parsed, candidates)
}
