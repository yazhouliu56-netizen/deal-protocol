import { describe, expect, it } from "vitest"
import { protocolRegistry, getProtocol, PROTOCOLS } from "@/lib/protocol/registry"
import { getEngine } from "@/lib/protocol/engine"

describe("registry ammo 投影（P1 步骤二：旧轨收敛后契约锁定）", () => {
  it("三协议注册 + base 不对外注册 + PROTOCOLS/getProtocol 契约", () => {
    expect(Object.keys(PROTOCOLS).sort()).toEqual(["protocol_dating", "protocol_housekeeping", "protocol_meetup"])
    expect(getProtocol("protocol_base")).toBeUndefined()
    expect(getProtocol("protocol_housekeeping")).toBe(PROTOCOLS.protocol_housekeeping)
  })

  it("housekeeping 投影：7 态 17 转换 + 金额/时机与 ammo 一致", () => {
    const d = protocolRegistry.get("protocol_housekeeping")!
    expect(d.states.map((s) => s.name)).toEqual([
      "PENDING_HELD", "HELD", "COMPLETED", "DISPUTED", "CANCELLED", "SATISFACTION_HELD", "SETTLED",
    ])
    expect(d.transitions).toHaveLength(17)
    expect(d.serviceStages).toHaveLength(6)
    expect(d.funding.fees.platform_commission).toBe(0.15)
    expect(d.funding.fees.satisfaction_hold).toBe(0.1)
    expect(d.completion.autoTimeoutSeconds).toBe(24 * 3600)
    expect(d.refundRules).toHaveLength(6)
    const eng = getEngine("protocol_housekeeping")!
    expect(eng.calcRefund(5, 100)).toEqual({ provider: 50, customer: 50 })
    expect(eng.calcRefund(0, 100)).toEqual({ provider: 0, customer: 100 })
  })

  it("dating 投影：6 态 + commitment + companion 超时 2h", () => {
    const d = protocolRegistry.get("protocol_dating")!
    expect(d.states.map((s) => s.name)).toEqual(["PENDING", "HELD", "COMPLETED", "CANCELLED", "DISPUTED", "SETTLED"])
    expect(d.funding.mode).toBe("commitment")
    expect(d.completion.autoTimeoutSeconds).toBe(2 * 3600)
    expect(d.refundRules?.[0]).toMatchObject({ stage: 0, customerGets: "all" })
  })

  it("meetup 投影：6h 超时 + 分账 0.88 → 佣金 0.12", () => {
    const d = protocolRegistry.get("protocol_meetup")!
    expect(d.completion.autoTimeoutSeconds).toBe(6 * 3600)
    expect(d.funding.fees.platform_commission).toBeCloseTo(0.12, 5)
    expect(d.refundRules).toHaveLength(6)
  })
})