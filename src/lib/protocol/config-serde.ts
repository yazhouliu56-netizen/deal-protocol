import type { ProtocolDef } from "./types"

export interface SerializableTransition {
  action: string
  from: string
  to: string
  allowedRoles: string[]
  description?: string
  serviceStage?: { from?: number; to?: number }
}

export interface SerializableProtocolConfig {
  name: string
  description: string
  category: string
  version: string
  roles: Record<string, { min: number; max: number; description?: string }>
  funding: unknown
  states: Array<{ name: string; description?: string; terminal?: boolean }>
  transitions: SerializableTransition[]
  serviceStages?: string[]
  refundRules?: Array<{ stage: number; providerRatio?: number; providerMax?: number; customerGets: "all" | "rest" }>
  completion: { trigger: string; requiredEvidence: string[]; autoTimeoutSeconds?: number }
  default: { types: string[]; requiredEvidence: string[] }
  evidence: Array<{ type: string; label: string; required: boolean; maxCount?: number; description?: string }>
  review: unknown
  dispute: unknown
  conditions?: Array<{ trigger: string; action: string }>
}

export function serializeConfig(def: ProtocolDef): SerializableProtocolConfig {
  return {
    name: def.name,
    description: def.description,
    category: def.category,
    version: def.version,
    roles: Object.fromEntries(
      Object.entries(def.roles).map(([k, v]) => [k, { min: v.min, max: v.max, description: v.description }]),
    ),
    funding: def.funding,
    states: def.states.map((s) => ({ name: s.name, description: s.description, terminal: s.terminal })),
    transitions: def.transitions.map((t) => ({
      action: t.action,
      from: t.from,
      to: t.to,
      allowedRoles: t.allowedRoles,
      description: t.description,
      serviceStage: t.serviceStage ? { from: t.serviceStage.from, to: t.serviceStage.to } : undefined,
    })),
    serviceStages: def.serviceStages ? [...def.serviceStages] : undefined,
    refundRules: def.refundRules ? def.refundRules.map((r) => ({ ...r })) : undefined,
    completion: { ...def.completion },
    default: { ...def.default },
    evidence: def.evidence.map((e) => ({ type: e.type, label: e.label, required: e.required, maxCount: e.maxCount, description: e.description })),
    review: def.review,
    dispute: def.dispute,
    conditions: def.conditions?.map((c) => ({ trigger: c.trigger, action: c.action })),
  }
}
