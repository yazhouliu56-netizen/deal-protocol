import type { CandidateSolution, LlmComplete } from "./types"

/**
 * Strip outer Markdown code fences (```ts ... ```) while preserving the inner
 * code's indentation and formatting. If several fenced blocks are present,
 * their contents are joined. Bare responses without any fence are returned
 * trimmed as-is.
 */
export function extractCodeBlock(raw: string): string {
  const fencePattern = /```[^\n]*\r?\n([\s\S]*?)\r?\n?\s*```/g
  const blocks: string[] = []
  for (const match of raw.matchAll(fencePattern)) {
    const body = match[1]
    if (body !== undefined) blocks.push(body.replace(/^\r?\n/, "").replace(/\s+$/, ""))
  }
  if (blocks.length === 0) return raw.trim()
  return blocks.join("\n\n")
}

export function buildGenerationPrompt(options: {
  task: string
  baselineCode: string
  temperature: number
}): string {
  const { task, baselineCode, temperature } = options
  return [
    `You are implementing a solution for the following task:`,
    "",
    task,
    "",
    "Current baseline implementation:",
    "",
    "```",
    baselineCode,
    "```",
    "",
    "Respond with exactly ONE complete code snippet wrapped in a single ``` fenced block.",
    "Do not include explanations before or after the block.",
    "Preserve indentation and keep the snippet self-contained.",
    `Creativity/diversity target for this sample: temperature ${temperature}.`,
  ].join("\n")
}

interface Attempt {
  ok: boolean
  text: string
}

/**
 * Sample N candidate solutions concurrently with a per-candidate temperature.
 *
 * - Uses Promise.all so all requests run in parallel.
 * - Temperatures cycle when fewer values than candidates are configured.
 * - Partial failures are tolerated: surviving candidates are kept; if every
 *   attempt fails, a single fallback candidate wrapping the baseline is returned.
 */
export async function generateCandidates(options: {
  task: string
  baselineCode: string
  numCandidates: number
  temperatures: number[]
  complete: LlmComplete
}): Promise<CandidateSolution[]> {
  const { task, baselineCode, numCandidates, temperatures, complete } = options

  const ladder = Array.from(
    { length: numCandidates },
    (_, i) => temperatures[i % temperatures.length] ?? 0,
  )

  const attempts: Promise<Attempt>[] = ladder.map((temperature) =>
    complete({
      prompt: buildGenerationPrompt({ task, baselineCode, temperature }),
      temperature,
    }).then(
      (text): Attempt => ({ ok: true, text }),
      (): Attempt => ({ ok: false, text: "" }),
    ),
  )

  // All sampling requests are launched concurrently via Promise.all.
  const settled = await Promise.all(attempts)

  const candidates: CandidateSolution[] = []
  settled.forEach((attempt, slot) => {
    if (!attempt.ok) return
    candidates.push({
      index: slot,
      temperature: ladder[slot] ?? 0,
      code: extractCodeBlock(attempt.text),
      rawResponse: attempt.text,
    })
  })

  if (candidates.length === 0) {
    return [{ index: 0, temperature: ladder[0] ?? 0, code: baselineCode }]
  }
  return candidates
}
