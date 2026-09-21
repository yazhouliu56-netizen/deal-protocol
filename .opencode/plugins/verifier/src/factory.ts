import { z } from "zod"

import { Plugin } from "@opencode/plugin"

import { runVerification } from "./pipeline"
import {
  TOOL_NAME,
  VerifierConfigSchema,
  type LlmComplete,
  type VerifierConfig,
} from "./types"

export interface VerifierState {
  /** SessionIDs with a verification currently in flight. */
  readonly activeSessions: Set<string>
  isLocked(sessionID: string): boolean
  /** Atomically claim the session; false when already locked. */
  acquire(sessionID: string): boolean
  release(sessionID: string): void
}

/**
 * Anti-recursion state lock: an in-memory registry of active verification
 * sessions used to reject any re-entrant invocation within the same session.
 */
export function createVerifierState(): VerifierState {
  const activeSessions = new Set<string>()
  return {
    activeSessions,
    isLocked: (sessionID) => activeSessions.has(sessionID),
    acquire: (sessionID) => {
      if (activeSessions.has(sessionID)) return false
      activeSessions.add(sessionID)
      return true
    },
    release: (sessionID) => {
      activeSessions.delete(sessionID)
    },
  }
}

interface ModelRef {
  providerID: string
  id: string
  variant?: string
}

/**
 * Accept the legacy V1 `{ providerID, modelID }` shape as well as the native
 * V2 `{ providerID, id }` shape; an optional top-level `variant` string is
 * forwarded as the V2 model variant.
 */
function parseModelRef(value: unknown, variant: unknown): ModelRef | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.providerID !== "string") return undefined
  const id = record.id ?? record.modelID
  if (typeof id !== "string") return undefined
  return {
    providerID: record.providerID,
    id,
    ...(typeof variant === "string" && variant.length > 0 ? { variant } : {}),
  }
}

const VerifierArgsSchema = z.object({
  task: z.string().min(1).describe("Description of the feature or bug to solve."),
  code: z.string().describe("Current implementation or baseline snippet."),
  testCommand: z.string().optional().describe("Command executed for L1 validation."),
})

type VerifierArgs = z.infer<typeof VerifierArgsSchema>

const TOOL_INPUT_SCHEMA = {
  type: "object",
  properties: {
    task: {
      type: "string",
      minLength: 1,
      description: "Description of the feature or bug to solve.",
    },
    code: {
      type: "string",
      description: "Current implementation or baseline snippet.",
    },
    testCommand: {
      type: "string",
      description: "Command executed for L1 validation (e.g. 'npm run test:units').",
    },
  },
  required: ["task", "code"],
  additionalProperties: false,
} as const

const TOOL_DESCRIPTION =
  "LLM-as-a-Verifier pipeline: runs deterministic checks (tests/lint/types), samples N candidate solutions in parallel across a temperature ladder, then comparatively ranks them with an LLM judge and returns the winner."

/**
 * Default LLM transport built on the V2 `generate.text` API: stateless,
 * tool-free single-shot inference, which matches the sampler's semantics.
 * `generate.text` exposes no system/temperature knobs, so both are folded
 * into the prompt text (same emulation the V1 transport used).
 */
function createGenerateLlm(ctx: Plugin.Context, model?: ModelRef): LlmComplete {
  return async ({ prompt, system, temperature }) => {
    const full = [system, prompt, `Response diversity target: temperature ${temperature}.`]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join("\n\n")
    const response = await ctx.generate.text({
      prompt: full,
      ...(model ? { model } : {}),
    })
    return response.text
  }
}

function executeArgs(input: unknown): VerifierArgs | undefined {
  const parsed = VerifierArgsSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}

/**
 * Build the V2 plugin definition. `state` is injectable for testing;
 * production instances share one state per loaded plugin.
 */
export function defineVerifierPlugin(state: VerifierState = createVerifierState()): Plugin.Plugin {
  return Plugin.define({
    id: "verifier",
    async setup(ctx) {
      const rawOptions = (ctx.options ?? {}) as Record<string, unknown>
      const config: VerifierConfig = VerifierConfigSchema.parse(rawOptions)
      const model = parseModelRef(rawOptions.model, rawOptions.variant)
      const llm = typeof rawOptions.llm === "function"
        ? (rawOptions.llm as LlmComplete)
        : createGenerateLlm(ctx, model)
      // Project-local plugins load at the project root, which is also the
      // correct working directory for L1 commands such as `npm run test:units`.
      const cwd = ctx.location.directory

      await ctx.tool.hook("execute.before", (event) => {
        if (event.tool !== TOOL_NAME) return
        if (state.isLocked(event.sessionID)) {
          throw new Error(
            `[${TOOL_NAME}] a verification is already running for this session; re-entrant invocation rejected to prevent infinite recursion.`,
          )
        }
      })

      await ctx.tool.transform((editor) => {
        editor.add({
          name: TOOL_NAME,
          description: TOOL_DESCRIPTION,
          input: TOOL_INPUT_SCHEMA,
          execute: async (input, context) => {
            const args = executeArgs(input)
            if (!args) {
              return {
                content: `[${TOOL_NAME}] invalid args: expected { task: string, code: string, testCommand?: string }.`,
                metadata: { rejected: true },
              }
            }
            if (!state.acquire(context.sessionID)) {
              return {
                content: `[${TOOL_NAME}] rejected: a verification is already in progress for this session.`,
                metadata: { rejected: true, sessionID: context.sessionID },
              }
            }
            try {
              const result = await runVerification(args, {
                config,
                llm,
                cwd,
                onProgress: async (status) => {
                  await context.progress({ title: status })
                },
              })
              return { content: result.output, metadata: result.metadata }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error)
              return {
                content: `[${TOOL_NAME}] pipeline error: ${message}`,
                metadata: { rejected: false, error: message },
              }
            } finally {
              state.release(context.sessionID)
            }
          },
        })
      })
    },
  })
}
