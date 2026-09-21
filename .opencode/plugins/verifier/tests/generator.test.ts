import { describe, expect, test } from "vitest"

import { buildGenerationPrompt, extractCodeBlock, generateCandidates } from "../src/generator"
import type { LlmComplete } from "../src/types"

describe("extractCodeBlock", () => {
  test("strips a single fenced block with language tag, preserving inner indentation", () => {
    const raw = 'Here is the solution:\n\n```ts\nfunction add(a: number, b: number) {\n  return a + b\n}\n```\n\nHope it helps!'

    expect(extractCodeBlock(raw)).toBe('function add(a: number, b: number) {\n  return a + b\n}')
  })

  test("handles CRLF fences and no-newline-before-closing-fence", () => {
    const raw = "```ts\r\nconst x = 1\r\n```"

    expect(extractCodeBlock(raw)).toBe("const x = 1")
  })

  test("returns bare code trimmed when no fence is present", () => {
    const raw = "\n  const y = 2  \n"

    expect(extractCodeBlock(raw)).toBe("const y = 2")
  })

  test("joins multiple fenced blocks", () => {
    const raw = "```ts\nconst a = 1\n```\nprose\n```ts\nconst b = 2\n```"

    expect(extractCodeBlock(raw)).toBe("const a = 1\n\nconst b = 2")
  })
})

describe("generateCandidates", () => {
  function makeComplete(
    handler: (prompt: string, temperature: number) => Promise<string> | string,
  ): LlmComplete & { calls: Array<{ prompt: string; temperature: number }> } {
    const calls: Array<{ prompt: string; temperature: number }> = []
    const complete = async (request: { prompt: string; temperature: number }) => {
      calls.push(request)
      return await handler(request.prompt, request.temperature)
    }
    return Object.assign(complete, { calls })
  }

  test("launches all sampling requests concurrently via Promise.all", async () => {
    const deferreds = [0, 1, 2].map(() => {
      let release!: () => void
      const done = new Promise<void>((resolve) => {
        release = resolve
      })
      return { done, release }
    })
    let calls = 0
    const complete: LlmComplete = async () => {
      const slot = calls
      calls += 1
      await deferreds[slot]!.done
      return `candidate ${slot + 1}`
    }

    const pending = generateCandidates({
      task: "t",
      baselineCode: "base",
      numCandidates: 3,
      temperatures: [0.2, 0.7, 1.0],
      complete,
    })

    // All three requests must already be in flight before any resolves.
    expect(calls).toBe(3)

    deferreds.forEach((d) => d.release())
    const candidates = await pending

    expect(candidates.map((c) => c.code)).toEqual(["candidate 1", "candidate 2", "candidate 3"])
  })

  test("passes distinct temperature values and preserves slot indices", async () => {
    const complete = makeComplete((_prompt, temperature) => `\`\`\`ts\ncode@${temperature}\n\`\`\``)

    const candidates = await generateCandidates({
      task: "solve x",
      baselineCode: "// base",
      numCandidates: 3,
      temperatures: [0.2, 0.7, 1.0],
      complete,
    })

    expect(complete.calls.map((c) => c.temperature)).toEqual([0.2, 0.7, 1.0])
    expect(candidates.map((c) => c.index)).toEqual([0, 1, 2])
    expect(candidates.map((c) => c.temperature)).toEqual([0.2, 0.7, 1.0])
    expect(candidates[0]!.code).toBe("code@0.2")
    expect(candidates[0]!.rawResponse).toContain("code@0.2")
  })

  test("cycles the temperature ladder when fewer values than candidates are configured", async () => {
    const complete = makeComplete(() => "irrelevant")

    await generateCandidates({
      task: "t",
      baselineCode: "b",
      numCandidates: 4,
      temperatures: [0.3, 0.9],
      complete,
    })

    expect(complete.calls.map((c) => c.temperature)).toEqual([0.3, 0.9, 0.3, 0.9])
  })

  test("partial failure keeps surviving candidates in their original slots", async () => {
    const complete: LlmComplete = async ({ temperature }) => {
      if (temperature === 0.7) throw new Error("provider timeout")
      return `\`\`\`\nsurvivor@${temperature}\n\`\`\``
    }

    const candidates = await generateCandidates({
      task: "t",
      baselineCode: "baseline-code",
      numCandidates: 3,
      temperatures: [0.2, 0.7, 1.0],
      complete,
    })

    expect(candidates.map((c) => c.index)).toEqual([0, 2])
    expect(candidates.map((c) => c.code)).toEqual(["survivor@0.2", "survivor@1"])
  })

  test("total failure falls back to a single candidate wrapping the baseline", async () => {
    const complete: LlmComplete = async () => {
      throw new Error("all providers down")
    }

    const candidates = await generateCandidates({
      task: "t",
      baselineCode: "baseline-code",
      numCandidates: 3,
      temperatures: [0.2, 0.7, 1.0],
      complete,
    })

    expect(candidates).toHaveLength(1)
    expect(candidates[0]).toMatchObject({ index: 0, temperature: 0.2, code: "baseline-code" })
  })

  test("generation prompt embeds task, baseline and diversity target", () => {
    const prompt = buildGenerationPrompt({ task: "fix null crash", baselineCode: "let a;", temperature: 0.7 })

    expect(prompt).toContain("fix null crash")
    expect(prompt).toContain("let a;")
    expect(prompt).toContain("temperature 0.7")
  })
})
