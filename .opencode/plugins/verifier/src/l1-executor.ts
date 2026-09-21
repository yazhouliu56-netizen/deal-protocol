import { spawn } from "node:child_process"

import type { L1CheckResult } from "./types"

export interface SpawnOutcome {
  stdout: string
  stderr: string
  exitCode: number
}

export type SpawnFn = (
  command: string,
  cwd: string,
  options: { timeoutMs?: number },
) => Promise<SpawnOutcome>

const DEFAULT_TIMEOUT_MS = 120_000

function platformSpawn(
  command: string,
  cwd: string,
  { timeoutMs }: { timeoutMs?: number },
): Promise<SpawnOutcome> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (outcome: SpawnOutcome) => {
      if (settled) return
      settled = true
      if (timer !== undefined) clearTimeout(timer)
      resolve(outcome)
    }

    let child
    try {
      child = spawn(command, {
        cwd,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      finish({ stdout: "", stderr: message, exitCode: -1 })
      return
    }

    let stdout = ""
    let stderr = ""
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk)
    })

    const timer =
      timeoutMs && timeoutMs > 0
        ? setTimeout(() => {
            child.kill()
            finish({ stdout, stderr, exitCode: -1 })
          }, timeoutMs)
        : undefined

    child.on("error", (error) => {
      finish({ stdout, stderr: `${stderr}${String(error)}`, exitCode: -1 })
    })
    child.on("close", (code) => {
      finish({ stdout, stderr, exitCode: code ?? -1 })
    })
  })
}

/**
 * Run a deterministic verification command inside `cwd`.
 *
 * - `passed` mirrors `exitCode === 0`.
 * - Spawn failures are caught and reported as a failed check (`exitCode: -1`)
 *   instead of throwing.
 * - A custom `spawn` implementation can be injected for testing.
 */
export async function runL1Check(options: {
  command: string
  cwd: string
  timeoutMs?: number
  spawn?: SpawnFn
}): Promise<L1CheckResult> {
  const { command, cwd, timeoutMs = DEFAULT_TIMEOUT_MS, spawn = platformSpawn } = options

  try {
    const outcome = await spawn(command, cwd, { timeoutMs })
    return {
      passed: outcome.exitCode === 0,
      command,
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      exitCode: outcome.exitCode,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      passed: false,
      command,
      stdout: "",
      stderr: `L1 executor failed to spawn command: ${message}`,
      exitCode: -1,
    }
  }
}
