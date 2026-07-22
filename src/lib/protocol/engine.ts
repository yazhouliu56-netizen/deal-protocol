import type { ProtocolDef, TransitionCtx } from "./types"
import { protocolRegistry } from "./registry"

// ── 延迟同步到 DB（第一次 getEngine 时触发）──

let syncFired = false
function fireDbSync(): void {
  if (syncFired) return
  syncFired = true
  import("./bootstrap").then((m) => m.syncBuiltinsToDb()).catch(console.warn)
}

/**
 * ProtocolEngine — 协议状态机引擎
 *
 * 不认识任何协议内容，只按 ProtocolDef 数据执行。
 * 状态机逻辑：
 *   - 资金状态（fundStatus）：由 transitions 中的 from/to 定义
 *   - 服务阶段（serviceStage）：由 transitions 中的 serviceStage 定义
 *   - 谁在什么情况下可以做什么：由 roles + guards 定义
 */
export class ProtocolEngine {
  private def: ProtocolDef
  private stageIndex: Record<string, number> | null = null

  constructor(def: ProtocolDef) {
    this.def = def
    if (def.serviceStages) {
      this.stageIndex = Object.fromEntries(def.serviceStages.map((s, i) => [s, i]))
    }
  }

  /** 获取协议定义 */
  getDefinition(): ProtocolDef {
    return this.def
  }

  /** 获取所有资金状态名 */
  getStates(): string[] {
    return this.def.states.map((s) => s.name)
  }

  /** 获取所有服务阶段名 */
  getServiceStages(): string[] | null {
    return this.def.serviceStages ?? null
  }

  /** 获取某角色的可用操作列表 */
  getAllowedActions(fromState: string, role: string): string[] {
    return this.def.transitions
      .filter((t) => t.from === fromState && t.allowedRoles.some((r) => r.toLowerCase() === role.toLowerCase()))
      .map((t) => t.action)
  }

  /**
   * 验证一个操作是否合法
   * 返回 null = 合法，string = 拒绝原因
   */
  validateTransition(action: string, ctx: TransitionCtx): string | null {
    const def = this.def.transitions.find((t) => t.action === action)
    if (!def) return `未知操作: ${action}`

    // 检查资金状态
    if (def.from !== ctx.contract.fundStatus) {
      return `当前状态 ${ctx.contract.fundStatus} 不允许执行 ${action}`
    }

    // 检查角色权限（大小写不敏感）
    if (!def.allowedRoles.some((r) => r.toLowerCase() === ctx.actor.role.toLowerCase())) {
      return `${ctx.actor.role} 角色无权执行此操作`
    }

    // 如果定义了服务阶段前置条件，检查
    if (def.serviceStage?.from !== undefined) {
      if (ctx.contract.serviceStage !== def.serviceStage.from) {
        const stageName = this.def.serviceStages?.[def.serviceStage.from] ?? `阶段 ${def.serviceStage.from}`
        return `当前服务阶段不允许执行 ${action}，需要处于 ${stageName}`
      }
    }

    // 执行自定义 guard
    if (def.guard) {
      return def.guard(ctx)
    }

    return null
  }

  /** 获取操作执行后的下一个资金状态 */
  getNextFundStatus(action: string): string | null {
    const def = this.def.transitions.find((t) => t.action === action)
    return def?.to ?? null
  }

  /** 获取操作执行后的下一个服务阶段 */
  getNextServiceStage(action: string): number | null {
    const def = this.def.transitions.find((t) => t.action === action)
    if (!def?.serviceStage?.to) return null
    return def.serviceStage.to
  }

  /**
   * 计算退款金额
   * 根据协议 refundRules + 当前服务阶段
   */
  calcRefund(serviceStage: number, amount: number): { provider: number; customer: number } {
    if (amount <= 0) return { provider: 0, customer: 0 }

    const rules = this.def.refundRules
    if (!rules) {
      // 无退款规则：默认全退
      return { provider: 0, customer: amount }
    }

    // 找到最匹配的规则（精确匹配，或最接近的较低阶段）
    let rule = rules.find((r) => r.stage === serviceStage)
    if (!rule) {
      const sorted = [...rules].sort((a, b) => b.stage - a.stage)
      rule = sorted.find((r) => r.stage <= serviceStage)
    }
    if (!rule) {
      return { provider: 0, customer: amount }
    }

    if (rule.customerGets === "all") {
      return { provider: 0, customer: amount }
    }

    // providerRatio + providerMax 组合
    let providerAmount = 0
    if (rule.providerRatio !== undefined) {
      providerAmount = Math.round(amount * rule.providerRatio * 10000) / 10000
    }
    if (rule.providerMax !== undefined) {
      providerAmount = Math.min(providerAmount, rule.providerMax)
    }

    // 兜底：只有 max 没有 ratio（固定费用）
    if (rule.providerRatio === undefined && rule.providerMax !== undefined) {
      providerAmount = Math.min(rule.providerMax, amount)
    }

    const customerAmount = Math.max(0, amount - providerAmount)
    return { provider: providerAmount, customer: customerAmount }
  }

  /** 判断一个操作是否是服务阶段变化（from === to 的 fund transit） */
  isServiceStageOnlyAction(action: string): boolean {
    const def = this.def.transitions.find((t) => t.action === action)
    return def !== undefined && def.from === def.to
  }

  /**
   * 派生动作表：从复合状态（fundStatus + disputeStatus + role）推导可执行的动作
   * 返回 { action, description?, toStatus?, toStage? }[]
   */
  deriveNextActions(
    fundStatus: string,
    disputeStatus: string | null,
    serviceStage: number,
    role: string,
  ): Array<{ action: string; toFundStatus?: string; toStage?: number }> {
    return this.def.transitions
      .filter((t) => {
        if (t.from !== fundStatus) return false
        if (!t.allowedRoles.some((r) => r.toLowerCase() === role.toLowerCase())) return false
        if (t.serviceStage?.from !== undefined && t.serviceStage.from !== serviceStage) return false
        return true
      })
      .map((t) => ({
        action: t.action,
        toFundStatus: t.from !== t.to ? t.to : undefined,
        toStage: t.serviceStage?.to,
      }))
  }
}

// ── 快捷工厂 ──

const engineCache = new Map<string, ProtocolEngine>()

/** 根据协议ID获取引擎实例 */
export function getEngine(protocolId: string): ProtocolEngine | null {
  if (engineCache.has(protocolId)) return engineCache.get(protocolId)!

  fireDbSync()

  const def = protocolRegistry.get(protocolId)
  if (!def) return null

  const engine = new ProtocolEngine(def)
  engineCache.set(protocolId, engine)
  return engine
}

/** 清除引擎缓存（协议更新后调用） */
export function clearEngineCache(): void {
  engineCache.clear()
}
