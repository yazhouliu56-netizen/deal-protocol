import { describe, expect, test } from "vitest"
import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { runL1Check } from "../src/l1-executor"
import type { SpawnFn } from "../src/l1-executor"

const IS_WIN = process.platform === "win32"
// Quote-free commands only: cmd.exe mangles nested quotes in spawn args.
const FAIL_CMD = IS_WIN ? "exit /b 3" : "exit 3"
const ECHO_CMD = "echo l1-hello"
const HERE = dirname(fileURLToPath(import.meta.url))

describe("runL1Check", () => {
  test("mocked success: passed mirrors exitCode === 0", async () => {
    const seen: Array<{ command: string; cwd: string }> = []
    const spawn: SpawnFn = async (command, cwd) => {
      seen.push({ command, cwd })
      return { stdout: "all good\n", stderr: "", exitCode: 0 }
    }

    const result = await runL1Check({ command: "bun test", cwd: "/tmp/project", spawn })

    expect(result.passed).toBe(true)
    expect(result.command).toBe("bun test")
    expect(result.stdout).toContain("all good")
    expect(result.stderr).toBe("")
    expect(result.exitCode).toBe(0)
    expect(seen).toEqual([{ command: "bun test", cwd: "/tmp/project" }])
  })

  test("mocked failure: non-zero exit marks check failed and carries stderr", async () => {
    const spawn: SpawnFn = async () => ({
      stdout: "",
      stderr: "error TS2345: Type 'x' is not assignable",
      exitCode: 1,
    })

    const result = await runL1Check({ command: "tsc --noEmit", cwd: "/tmp/project", spawn })

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("TS2345")
    expect(result.command).toBe("tsc --noEmit")
  })

  test("spawn throwing is caught gracefully instead of propagating", async () => {
    const spawn: SpawnFn = async () => {
      throw new Error("ENOENT: spawn boom")
    }

    const result = await runL1Check({ command: "missing-binary --flag", cwd: "/tmp", spawn })

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(-1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("L1 executor failed to spawn command")
    expect(result.stderr).toContain("ENOENT")
  })

  test("real spawn: failing command reports non-zero exit code", async () => {
    const result = await runL1Check({ command: FAIL_CMD, cwd: HERE })

    expect(result.passed).toBe(false)
    expect(result.exitCode).toBe(3)
  }, 20_000)

  test("real spawn: successful command captures stdout", async () => {
    const result = await runL1Check({ command: ECHO_CMD, cwd: HERE })

    expect(result.passed).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain("l1-hello")
  }, 20_000)
})
