import { describe, expect, test } from "vitest"

import { Plugin } from "@opencode/plugin"

import { createVerifierState, defineVerifierPlugin } from "../src/factory"
import { TOOL_NAME, VerifierConfigSchema } from "../src/types"

interface CapturedTool {
  name: string
  description: string
  input: unknown
  execute: (
    input: unknown,
    context: {
      sessionID: string
      progress: (update: Record<string, unknown>) => Promise<void>
    },
  ) => Promise<{ content: string; metadata?: Record<string, unknown> }>
}

interface Harness {
  state: ReturnType<typeof createVerifierState>
  hooks: Record<string, (event: { tool: string; sessionID: string }) => unknown>
  tools: Record<string, CapturedTool>
  seenPrompts: string[]
  seenModels: unknown[]
}

async function setup(
  options: Record<string, unknown>,
  textImpl: (fullPrompt: string) => string | Promise<string>,
  directory = "/proj",
): Promise<Harness> {
  const state = createVerifierState()
  const harness: Harness = { state, hooks: {}, tools: {}, seenPrompts: [], seenModels: [] }
  const fakeCtx = {
    options,
    location: { directory },
    generate: {
      text: async ({ prompt, model }: { prompt: string; model?: unknown }) => {
        harness.seenPrompts.push(prompt)
        harness.seenModels.push(model ?? null)
        return { text: await textImpl(prompt) }
      },
    },
    tool: {
      hook: async (name: string, cb: (event: { tool: string; sessionID: string }) => unknown) => {
        harness.hooks[name] = cb
      },
      transform: async (cb: (editor: { add: (def: CapturedTool) => void }) => void) => {
        cb({
          add: (def) => {
            harness.tools[def.name] = def
          },
        })
      },
    },
  }
  const definition = defineVerifierPlugin(state)
  await definition.setup(fakeCtx as unknown as Plugin.Context)
  return harness
}

const RANK_OK = JSON.stringify({
  bestIndex: 0,
  ranking: [0, 1],
  reasons: { "0": "solid" },
  critique: "first is best",
})

function routedTemperature(fullPrompt: string): number {
  const match = /temperature (-?[\d.]+)\./.exec(fullPrompt)
  return match ? Number(match[1]) : Number.NaN
}

function samplingStub(seen: number[]) {
  return async (fullPrompt: string) => {
    const temperature = routedTemperature(fullPrompt)
    if (temperature === 0) return RANK_OK
    seen.push(temperature)
    expect(fullPrompt).toContain("baseline-snippet")
    return `\`\`\`ts\nsample-${temperature}\n\`\`\``
  }
}

function makeExecuteContext(sessionID: string, progress?: (update: Record<string, unknown>) => Promise<void>) {
  return {
    sessionID,
    progress: progress ?? (async () => {}),
  }
}

describe("VerifierConfigSchema", () => {
  test("applies documented defaults", () => {
    const config = VerifierConfigSchema.parse({})

    expect(config).toEqual({
      numCandidates: 3,
      temperatures: [0.2, 0.7, 1.0],
      defaultL1Command: undefined,
    })
  })

  test("enforces numCandidates range [2, 5]", () => {
    expect(() => VerifierConfigSchema.parse({ numCandidates: 1 })).toThrow()
    expect(() => VerifierConfigSchema.parse({ numCandidates: 6 })).toThrow()
    expect(() => VerifierConfigSchema.parse({ numCandidates: 2.5 })).toThrow()
    expect(VerifierConfigSchema.parse({ numCandidates: 5 }).numCandidates).toBe(5)
  })

  test("unknown option keys are ignored", () => {
    const config = VerifierConfigSchema.parse({ mystery: true, numCandidates: 2 })

    expect(config.numCandidates).toBe(2)
    expect((config as Record<string, unknown>).mystery).toBeUndefined()
  })
})

describe("createVerifierState (anti-recursion lock)", () => {
  test("acquire/release semantics", () => {
    const state = createVerifierState()

    expect(state.isLocked("s1")).toBe(false)
    expect(state.acquire("s1")).toBe(true)
    expect(state.isLocked("s1")).toBe(true)
    expect(state.acquire("s1")).toBe(false)

    state.release("s1")
    expect(state.isLocked("s1")).toBe(false)
    expect(state.acquire("s1")).toBe(true)
  })

  test("sessions are isolated", () => {
    const state = createVerifierState()

    expect(state.acquire("a")).toBe(true)
    expect(state.acquire("b")).toBe(true)
    expect(state.isLocked("a")).toBe(true)
    state.release("a")
    expect(state.isLocked("b")).toBe(true)
    expect(state.isLocked("a")).toBe(false)
  })

  test("activeSessions exposes the underlying registry", () => {
    const state = createVerifierState()
    state.acquire("sX")

    expect([...state.activeSessions]).toEqual(["sX"])
  })
})

describe("verifier plugin (V2 registration)", () => {
  test("registers execute.before hook and the custom tool (never the V1 hook name)", async () => {
    const { hooks, tools } = await setup({}, async () => RANK_OK)

    expect(typeof hooks["execute.before"]).toBe("function")
    // Regression lock for the V1->V2 scope trap: the "tool." prefix must
    // never appear in a hook registration.
    expect(hooks["tool.execute.before"]).toBeUndefined()

    const toolDef = tools[TOOL_NAME]
    expect(toolDef).toBeDefined()
    expect(toolDef.description).toContain("LLM-as-a-Verifier")
    const input = toolDef.input as { required: string[]; properties: Record<string, unknown> }
    expect(input.required).toEqual(["task", "code"])
    expect(Object.keys(input.properties)).toEqual(["task", "code", "testCommand"])
  })

  test("legacy { providerID, modelID } ref maps to V2 { providerID, id }; variant forwarded", async () => {
    const legacy = await setup(
      { numCandidates: 2, model: { providerID: "acme", modelID: "reasoner" } },
      async () => RANK_OK,
    )
    await legacy.tools[TOOL_NAME]!.execute({ task: "t", code: "c" }, makeExecuteContext("s1"))
    expect(legacy.seenModels[0]).toEqual({ providerID: "acme", id: "reasoner" })

    const native = await setup(
      { numCandidates: 2, model: { providerID: "acme", id: "reasoner" }, variant: "high" },
      async () => RANK_OK,
    )
    await native.tools[TOOL_NAME]!.execute({ task: "t", code: "c" }, makeExecuteContext("s1"))
    expect(native.seenModels[0]).toEqual({ providerID: "acme", id: "reasoner", variant: "high" })
  })

  test("model ref reaches generate.text on first sampling call", async () => {
    const seen: number[] = []
    const { tools, seenModels } = await setup(
      { numCandidates: 2, temperatures: [0.5, 0.9], model: { providerID: "acme", id: "reasoner" } },
      samplingStub(seen),
    )

    const result = await tools[TOOL_NAME]!.execute(
      { task: "do thing", code: "baseline-snippet" },
      makeExecuteContext("s1"),
    )

    expect(seen.sort()).toEqual([0.5, 0.9])
    expect(result.content).toContain("Verification complete.")
    expect(result.metadata?.bestIndex).toBe(0)
    expect(result.metadata?.ranking).toEqual([0, 1])
    expect(result.metadata?.bestCode).toBe("sample-0.5")
    expect(result.metadata?.sampledCandidates).toBe(2)
    expect(result.metadata?.l1).toEqual([])
    expect(seenModels[0]).toEqual({ providerID: "acme", id: "reasoner" })
  })

  test("re-entrant execution within a locked session is rejected; other sessions proceed", async () => {
    let unblockGated!: (value: string) => void
    const gated = new Promise<string>((resolve) => {
      unblockGated = resolve
    })

    let generationCalls = 0
    const textImpl = async (fullPrompt: string) => {
      if (fullPrompt.includes("comparative judge")) return RANK_OK
      generationCalls += 1
      if (fullPrompt.includes("BLOCK-ME")) return gated
      const temperature = routedTemperature(fullPrompt)
      return `\`\`\`\nfast@${temperature}\n\`\`\``
    }

    const { state, tools } = await setup({ numCandidates: 2, temperatures: [0.5, 0.9] }, textImpl)
    const toolDef = tools[TOOL_NAME]!

    // Sampling requests park on the gated promise; progress reporting is
    // async, so flush before asserting they launched.
    const first = toolDef.execute({ task: "BLOCK-ME please", code: "c" }, makeExecuteContext("s1"))
    await new Promise((r) => setTimeout(r, 0))
    expect(generationCalls).toBe(2)
    expect(state.isLocked("s1")).toBe(true)

    const second = await toolDef.execute({ task: "x", code: "c" }, makeExecuteContext("s1"))
    expect(second.metadata?.rejected).toBe(true)

    const otherSession = await toolDef.execute({ task: "go", code: "c" }, makeExecuteContext("s2"))
    expect(otherSession.metadata?.rejected).toBe(false)

    unblockGated("```ts\nlate-winner\n```")
    const firstResult = await first
    expect(firstResult.metadata?.bestIndex).toBe(0)
    expect(state.isLocked("s1")).toBe(false)

    const again = await toolDef.execute({ task: "y", code: "c" }, makeExecuteContext("s1"))
    expect(again.metadata?.rejected).toBe(false)
  })

  test("total LLM failure degrades gracefully to the baseline fallback and releases the lock", async () => {
    const { state, tools } = await setup({}, async () => {
      throw new Error("provider exploded")
    })

    const result = await tools[TOOL_NAME]!.execute(
      { task: "t", code: "baseline-code" },
      makeExecuteContext("s9"),
    )

    expect(result.content).toContain("#0")
    expect(result.metadata?.bestCode).toBe("baseline-code")
    expect(result.metadata?.sampledCandidates).toBe(1)
    expect(String(result.metadata?.critique)).toContain("fell back to input order")
    expect(state.isLocked("s9")).toBe(false)
  })

  test("unexpected pipeline errors return a structured failure and release the lock in finally", async () => {
    const { state, tools } = await setup({}, async () => "unused")

    const explodingProgress = async () => {
      throw new Error("progress channel broke")
    }
    const result = await tools[TOOL_NAME]!.execute(
      { task: "t", code: "c" },
      makeExecuteContext("s8", explodingProgress),
    )

    expect(result.content).toContain("pipeline error")
    expect(result.metadata?.error).toContain("progress channel broke")
    expect(state.isLocked("s8")).toBe(false)
  })

  test("invalid tool args are rejected without touching the lock", async () => {
    const { state, tools } = await setup({}, async () => RANK_OK)

    const result = await tools[TOOL_NAME]!.execute({ task: "", code: "c" }, makeExecuteContext("s1"))

    expect(result.content).toContain("invalid args")
    expect(result.metadata?.rejected).toBe(true)
    expect(state.isLocked("s1")).toBe(false)
  })

  test("execute.before hook blocks verify_and_optimize only while the session is locked", async () => {
    const { state, hooks } = await setup({}, async () => RANK_OK)
    const guard = hooks["execute.before"]!

    expect(state.acquire("s7")).toBe(true)
    // The V2 hook callback is synchronous: it throws in-band when blocked.
    expect(() => guard({ tool: TOOL_NAME, sessionID: "s7" })).toThrow(/recursion/)
    expect(guard({ tool: "read", sessionID: "s7" })).toBeUndefined()
    expect(guard({ tool: TOOL_NAME, sessionID: "other" })).toBeUndefined()
    state.release("s7")
  })
})
