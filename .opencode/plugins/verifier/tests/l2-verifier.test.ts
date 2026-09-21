import { describe, expect, test } from "vitest"

import { buildJudgePrompt, JUDGE_SYSTEM_PROMPT, normalizeRanking, parseRanking, rankCandidates } from "../src/l2-verifier"
import type { CandidateSolution, L1CheckResult } from "../src/types"

function makeCandidate(index: number, code: string): CandidateSolution {
  return { index, temperature: index * 0.5, code }
}

const l1Failed: L1CheckResult = {
  passed: false,
  command: "bun test",
  stdout: "",
  stderr: "1 test failed: add() returns NaN for negative inputs",
  exitCode: 1,
}

const validRankJson = JSON.stringify({
  bestIndex: 1,
  ranking: [1, 0, 2],
  reasons: { "1": "Handles edge cases cleanly", "0": "Missing null check", "2": "Slower" },
  critique: "Candidate 1 is structurally superior.",
})

describe("parseRanking", () => {
  test("parses a clean JSON object", () => {
    const parsed = parseRanking(validRankJson)

    expect(parsed).not.toBeNull()
    expect(parsed!.bestIndex).toBe(1)
    expect(parsed!.ranking).toEqual([1, 0, 2])
    expect(parsed!.reasons[1]).toBe("Handles edge cases cleanly")
    expect(parsed!.critique).toContain("structurally superior")
  })

  test("recovers JSON wrapped in Markdown fences and surrounding prose", () => {
    const raw = `Sure! Here is my evaluation:\n\n\`\`\`json\n${validRankJson}\n\`\`\`\n\nLet me know if you need more detail.`

    const parsed = parseRanking(raw)

    expect(parsed).not.toBeNull()
    expect(parsed!.bestIndex).toBe(1)
  })

  test("returns null for malformed JSON", () => {
    expect(parseRanking("{ bestIndex: nope")).toBeNull()
    expect(parseRanking("no json at all here")).toBeNull()
  })

  test("returns null when required fields are missing or mistyped", () => {
    expect(parseRanking('{"bestIndex": "1", "ranking": [1]}')).toBeNull()
    expect(parseRanking('{"bestIndex": 1}')).toBeNull()
    expect(parseRanking('{"bestIndex": 1, "ranking": ["a"]}')).toBeNull()
    expect(parseRanking("[]")).toBeNull()
  })

  test("converts string reason keys to numeric keys and tolerates missing reasons/critique", () => {
    const parsed = parseRanking('{"bestIndex": 2, "ranking": [2, 0], "reasons": {"2": "fastest"}}')

    expect(parsed).toEqual({ bestIndex: 2, ranking: [2, 0], reasons: { 2: "fastest" }, critique: "" })
  })
})

describe("normalizeRanking", () => {
  test("drops unknown/duplicate indices and appends missing candidates", () => {
    const candidates = [makeCandidate(0, "a"), makeCandidate(1, "b"), makeCandidate(2, "c")]

    const result = normalizeRanking(
      { bestIndex: 9, ranking: [1, 7, 1], reasons: { 9: "ghost" }, critique: "" },
      candidates,
    )

    expect(result.ranking).toEqual([1, 0, 2])
    expect(result.bestIndex).toBe(1)
    expect(result.reasons).toEqual({})
  })
})

describe("rankCandidates", () => {
  const base = {
    task: "implement add(a,b)",
    baselineCode: "const add = () => NaN",
    candidates: [makeCandidate(0, "c0"), makeCandidate(1, "c1"), makeCandidate(2, "c2")],
    l1Results: [l1Failed],
  }

  test("judge prompt contains task, all candidates, L1 feedback, criteria and comparative instructions", async () => {
    let capturedPrompt = ""
    let capturedSystem = ""
    const complete = async (req: { prompt: string; system?: string }) => {
      capturedPrompt = req.prompt
      capturedSystem = req.system ?? ""
      return validRankJson
    }

    await rankCandidates({ ...base, complete })

    expect(capturedPrompt).toContain("implement add(a,b)")
    expect(capturedPrompt).toContain("c0")
    expect(capturedPrompt).toContain("c1")
    expect(capturedPrompt).toContain("c2")
    expect(capturedPrompt).toContain("add() returns NaN")
    expect(capturedPrompt).toContain("exit code 1")
    expect(capturedPrompt).toContain("Correctness")
    expect(capturedPrompt).toContain("efficiency")
    expect(capturedPrompt).toContain("type safety")
    expect(capturedPrompt.toLowerCase()).toContain("compare")
    expect(capturedSystem).toContain(JUDGE_SYSTEM_PROMPT)
  })

  test("maps a valid fenced judge response to the winning candidate", async () => {
    const result = await rankCandidates({
      ...base,
      complete: async () => `\`\`\`json\n${validRankJson}\n\`\`\``,
    })

    expect(result.bestIndex).toBe(1)
    expect(result.ranking).toEqual([1, 0, 2])
    expect(result.reasons[0]).toBe("Missing null check")
  })

  test("unparseable judge output falls back to input order with explanatory critique", async () => {
    const result = await rankCandidates({
      ...base,
      complete: async () => "I think candidate zero looks nice but here is no JSON.",
    })

    expect(result.bestIndex).toBe(0)
    expect(result.ranking).toEqual([0, 1, 2])
    expect(result.critique).toContain("fell back to input order")
    expect(result.reasons).toEqual({})
  })

  test("judge transport failure falls back safely instead of throwing", async () => {
    const result = await rankCandidates({
      ...base,
      complete: async () => {
        throw new Error("network down")
      },
    })

    expect(result.bestIndex).toBe(0)
    expect(result.ranking).toEqual([0, 1, 2])
    expect(result.critique).toContain("network down")
  })
})

describe("buildJudgePrompt", () => {
  test("mentions the passing/failing L1 status per configured command", () => {
    const prompt = buildJudgePrompt({
      task: "t",
      baselineCode: "b",
      candidates: [makeCandidate(0, "x")],
      l1Results: [{ passed: true, command: "tsc --noEmit", stdout: "ok", stderr: "", exitCode: 0 }],
    })

    expect(prompt).toContain("tsc --noEmit")
    expect(prompt).toContain("PASSED")
  })
})
