import type { ProtocolDef, ProtocolEntry } from "./types"
import { baseProtocol } from "./protocols/base"
import { housekeepingProtocol } from "./protocols/housekeeping"
import { datingProtocol } from "./protocols/dating"

/** 内置基准协议映射：id → def */
const baseProtocols = new Map<string, ProtocolDef>()

function registerBase(def: ProtocolDef): void {
  baseProtocols.set(def.id, def)
}

registerBase(baseProtocol)

function resolveExtends(def: ProtocolDef): ProtocolDef {
  if (!def.extends) return def

  const parent = baseProtocols.get(def.extends)
  if (!parent) {
    console.warn(`[protocol] Base "${def.extends}" not found for "${def.id}", skipping`)
    return def
  }

  // 子协议完全覆盖 states / transitions; 其他字段级覆盖
  return {
    ...parent,
    ...def,
    extends: def.extends,
    states: def.states,
    transitions: def.transitions,
    roles: { ...parent.roles, ...def.roles },
    evidence: def.evidence.length > 0 ? def.evidence : parent.evidence,
    completion: { ...parent.completion, ...def.completion },
    default: { ...parent.default, ...def.default },
    review: { ...parent.review, ...def.review },
    dispute: { ...parent.dispute, ...def.dispute },
    funding: { ...parent.funding, ...def.funding, modifiers: { ...parent.funding.modifiers, ...def.funding.modifiers } },
    refundRules: def.refundRules ?? parent.refundRules,
    serviceStages: def.serviceStages ?? parent.serviceStages,
    conditions: def.conditions ?? parent.conditions,
  }
}

// ── 注册表 ──

class ProtocolRegistry {
  private protocols = new Map<string, ProtocolEntry>()

  register(def: ProtocolDef): void {
    if (this.protocols.has(def.id)) {
      throw new Error(`Protocol ${def.id} already registered`)
    }
    const resolved = resolveExtends(def)
    this.protocols.set(def.id, {
      def: resolved,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  get(id: string): ProtocolDef | undefined {
    return this.protocols.get(id)?.def
  }

  getAll(): ProtocolDef[] {
    return Array.from(this.protocols.values())
      .filter((e) => e.enabled)
      .map((e) => e.def)
  }

  enable(id: string): void {
    const entry = this.protocols.get(id)
    if (entry) entry.enabled = true
  }

  disable(id: string): void {
    const entry = this.protocols.get(id)
    if (entry) entry.enabled = false
  }

  getStates(protocolId: string): string[] {
    const def = this.get(protocolId)
    if (!def) return []
    return def.states.map((s) => s.name)
  }

  getTransitions(protocolId: string) {
    const def = this.get(protocolId)
    if (!def) return []
    return def.transitions
  }
}

export const protocolRegistry = new ProtocolRegistry()

// ── 内置协议 ──

function initBuiltinProtocols(): void {
  protocolRegistry.register(housekeepingProtocol)
  protocolRegistry.register(datingProtocol)
}

initBuiltinProtocols()
