import { describe, it, expect, vi } from "vitest"

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const { consumeTtsStreamWithDeadline } = await import("./route")

async function* fastStream(chunks: number[]): AsyncGenerator<Uint8Array> {
  for (const n of chunks) {
    yield new Uint8Array(n)
  }
}

async function* stalledStream(): AsyncGenerator<Uint8Array> {
  await new Promise(() => {
    /* 永不产出也永不结束 —— 复现 msedge-tts 空桩挂起形态 */
  })
}

describe("TTS 8s 看门狗：consumeTtsStreamWithDeadline", () => {
  it("停滞流 → 确定性超时（不悬挂），且触发 onTimeout 释放回调", async () => {
    const onTimeout = vi.fn()
    const start = Date.now()
    const outcome = await consumeTtsStreamWithDeadline(stalledStream(), 100, onTimeout)
    const elapsed = Date.now() - start
    expect(outcome.kind).toBe("timeout")
    expect(elapsed).toBeLessThan(1000)
    expect(onTimeout).toHaveBeenCalledTimes(1)
  })

  it("正常流 → ok + 字节按序拼接", async () => {
    const outcome = await consumeTtsStreamWithDeadline(fastStream([3, 2]), 1000, () => {})
    expect(outcome.kind).toBe("ok")
    if (outcome.kind === "ok") {
      expect([...outcome.bytes]).toEqual([0, 0, 0, 0, 0])
    }
  })

  it("空流 → empty（双链全灭语义）", async () => {
    const outcome = await consumeTtsStreamWithDeadline(fastStream([]), 1000, () => {})
    expect(outcome.kind).toBe("empty")
  })

  it("报错流 → error（流异常语义），而非悬挂", async () => {
    async function* errorStream(): AsyncGenerator<Uint8Array> {
      yield new Uint8Array(2)
      throw new Error("upstream stream broke")
    }
    const outcome = await consumeTtsStreamWithDeadline(errorStream(), 1000, () => {})
    expect(outcome.kind).toBe("error")
  })

  it("超时与消费竞速：先完成者胜，超时未触发则 onTimeout 不调用", async () => {
    const onTimeout = vi.fn()
    const outcome = await consumeTtsStreamWithDeadline(fastStream([4]), 1000, onTimeout)
    expect(outcome.kind).toBe("ok")
    expect(onTimeout).not.toHaveBeenCalled()
  })
})