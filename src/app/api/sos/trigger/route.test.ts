import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => body,
    }),
  },
}))

const triggerSOSMock = vi.fn()
vi.mock("@/modules/m10-sos/sos-service", () => ({
  triggerSOS: (...args: unknown[]) => triggerSOSMock(...args),
}))

const insertMock = vi.fn()
const mockSupabase = {
  from: vi.fn(() => ({ insert: insertMock })),
}
vi.mock("@/lib/supabase-client", () => ({
  getServiceClient: () => mockSupabase,
}))

const { POST } = await import("./route")
const { computeEvidenceHash } = await import("@/base/safe/evidence-chain")

function makeReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/sos/trigger", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const SNAPSHOT = {
  snapshotId: "sos-3-abc-def12345",
  crisisId: "crisis-test-1",
  userId: "u-e2e",
  orderNo: "DP20260825001",
  level: 3,
  timestamp: 1720000000000,
  trajectoryPayload: {
    generatedAt: 1720000000000,
    pointCount: 2,
    lastPoint: { lat: 30.001, lng: 120.001, at: 1720000000000 },
    speedKmh: null,
    anomalyFlags: [],
    trail: "30.000000,120.000000|30.001000,120.001000",
  },
  audioEvidenceSummary: {
    chunkCount: 2,
    totalBytes: 512,
    fingerprints: ["aa11", "bb22"],
    integrityOk: true,
    failedChunkIds: [],
  },
}

describe("/api/sos/trigger · P1-3 权威存证路由", () => {
  beforeEach(() => {
    triggerSOSMock.mockReset()
    insertMock.mockReset()
  })

  it("有单成功态：服务端重算哈希与 evidence-chain 公式精确等价 + persisted:true", async () => {
    insertMock.mockResolvedValue({ error: null })

    const res = await POST(
      makeReq({ userId: "u-e2e", waveId: "DP20260825001", level: 3, note: "入户报警", snapshot: SNAPSHOT })
    )
    const json = (await res.json()) as {
      success: boolean
      forensic: { authoritativeHash: string; persisted: boolean; trajectoryPoints: number; audioChunks: number }
      crisis: { escalationPhase: string }
    }

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.forensic.persisted).toBe(true)
    expect(json.forensic.trajectoryPoints).toBe(2)
    expect(json.forensic.audioChunks).toBe(2)
    expect(json.crisis.escalationPhase).toBe("TRIGGERED")

    // A 写 B 验：捕获落盘行内的权威哈希，用同公式同时刻重算 → 精确等价（确定性数学锁定）
    expect(insertMock).toHaveBeenCalledTimes(1)
    const row = insertMock.mock.calls[0][0] as {
      order_no: string
      from_state: string
      to_state: string
      hook_payload: { authoritativeHash: string; timestamp: string; snapshot: unknown }
      idempotency_key: string
    }
    expect(row.order_no).toBe("DP20260825001")
    expect(row.from_state).toBe("SOS")
    expect(row.to_state).toBe("SOS")
    expect(row.idempotency_key).toBe(`sos:${SNAPSHOT.snapshotId}`)
    const expectedHash = computeEvidenceHash(
      "DP20260825001",
      "CRISIS_SOS_TRIGGERED",
      SNAPSHOT,
      "GENESIS",
      row.hook_payload.timestamp
    )
    expect(row.hook_payload.authoritativeHash).toBe(expectedHash)
    expect(json.forensic.authoritativeHash).toBe(expectedHash)
  })

  it("无单触发：跳过 M10 冻结、不触库，persisted:false 但仍 200 放行（红线 5）", async () => {
    const res = await POST(makeReq({ userId: "u-e2e", level: 3, note: "街头求助" }))
    const json = (await res.json()) as { success: boolean; forensic: { persisted: boolean } }

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.forensic.persisted).toBe(false)
    expect(triggerSOSMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it("DB 异常分支：insert 返回 error → persisted:false 且不阻断响应（宪法 #10）", async () => {
    insertMock.mockResolvedValue({ error: { message: "foreign key violation" } })

    const res = await POST(
      makeReq({ userId: "u-e2e", waveId: "DP-NONE", level: 3, snapshot: SNAPSHOT })
    )
    const json = (await res.json()) as { success: boolean; forensic: { persisted: boolean } }

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.forensic.persisted).toBe(false)
  })

  it("DB 抛异常分支：insert reject → 静默降级 persisted:false", async () => {
    insertMock.mockRejectedValue(new Error("relation order_state_logs does not exist"))

    const res = await POST(
      makeReq({ userId: "u-e2e", waveId: "DP-NONE", level: 3, snapshot: SNAPSHOT })
    )
    const json = (await res.json()) as { success: boolean; forensic: { persisted: boolean } }

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.forensic.persisted).toBe(false)
  })

  it("协议键兼容：protocolId 触发 M10 五步链冻结 + frozenAt 透传", async () => {
    triggerSOSMock.mockResolvedValue({ frozenAt: "2026-08-25T10:00:00.000Z" })
    insertMock.mockResolvedValue({ error: null })

    const res = await POST(
      makeReq({
        userId: "u-e2e",
        protocolId: "proto-1",
        latitude: 30.5,
        longitude: 120.5,
        level: 3,
      })
    )
    const json = (await res.json()) as { frozenAt: string | null }

    expect(triggerSOSMock).toHaveBeenCalledWith({
      userId: "u-e2e",
      protocolId: "proto-1",
      latitude: 30.5,
      longitude: 120.5,
    })
    expect(json.frozenAt).toBe("2026-08-25T10:00:00.000Z")
  })

  it("非法载荷：缺 userId → 400 拦截", async () => {
    const res = await POST(makeReq({ level: 3, note: "no user" }))
    expect(res.status).toBe(400)
    expect(triggerSOSMock).not.toHaveBeenCalled()
    expect(insertMock).not.toHaveBeenCalled()
  })
})
