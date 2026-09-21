import { describe, expect, test } from "vitest"

import { runVerification } from "../src/pipeline"
import { VerifierConfigSchema, type LlmComplete } from "../src/types"

const RANK_OK = JSON.stringify({
  bestIndex: 1,
  ranking: [1, 0],
  reasons: { "1": "handles edge cases" },
  critique: "second is best",
})

function samplingLlm(seen: number[]): LlmComplete {
  return async ({ temperature }) => {
    if (temperature === 0) return RANK_OK
    seen.push(temperature)
    return `\`\`\`ts\nsample-${temperature}\n\`\`\``
  }
}

describe("runVerification", () => {
  test("L1 configured: stub spawn result flows into metadata and output", async () => {
    const seen: number[] = []
    const statuses: string[] = []
    const result = await runVerification(
      { task: "do thing", code: "baseline-snippet", testCommand: "npm run check" },
      {
        config: VerifierConfigSchema.parse({ numCandidates: 2, temperatures: [0.5, 0.9] }),
        llm: samplingLlm(seen),
        cwd: "/proj",
        spawn: async (command, cwd) => {
          expect(command).toBe("npm run check")
          expect(cwd).toBe("/proj")
          return { stdout: "ok", stderr: "", exitCode: 0 }
        },
        onProgress: (status) => {
          statuses.push(status)
        },
      },
    )

    expect(seen.sort()).toEqual([0.5, 0.9])
    expect(result.output).toContain("Verification complete.")
    expect(result.output).toContain("PASSED")
    expect(result.metadata.bestIndex).toBe(1)
    expect(result.metadata.ranking).toEqual([1, 0])
    expect(result.metadata.bestCode).toBe("sample-0.9")
    expect(result.metadata.l1).toEqual([
      { passed: true, command: "npm run check", stdout: "ok", stderr: "", exitCode: 0 },
    ])
    expect(statuses).toEqual([
      "verify_and_optimize: L1 check",
      "verify_and_optimize: sampling 2 candidates",
      "verify_and_optimize: L2 judging 2 candidates",
    ])
  })

  test("failing L1 still ranks; failure is visible in the output", async () => {
    const result = await runVerification(
      { task: "t", code: "c", testCommand: "npm test" },
      {
        config: VerifierConfigSchema.parse({ numCandidates: 2 }),
        llm: samplingLlm([]),
        cwd: "/proj",
        spawn: async () => ({ stdout: "", stderr: "boom", exitCode: 1 }),
      },
    )

    expect(result.output).toContain("FAILED")
    expect(result.metadata.bestIndex).toBe(1)
  })

  test("malformed judge output falls back to input order with an explanatory critique", async () => {
    const llm: LlmComplete = async ({ temperature }) =>
      temperature === 0 ? "not json at all" : "```\ncode\n```"
    const result = await runVerification(
      { task: "t", code: "baseline" },
      { config: VerifierConfigSchema.parse({ numCandidates: 2 }), llm, cwd: "/proj" },
    )

    expect(result.metadata.ranking).toEqual([0, 1])
    expect(String(result.metadata.critique)).toContain("fell back to input order")
  })
})
