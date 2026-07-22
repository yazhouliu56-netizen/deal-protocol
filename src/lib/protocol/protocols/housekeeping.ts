import type { ProtocolDef, TransitionCtx } from "../types"

// 服务阶段枚举（索引即序号）
const STAGE = {
  NOT_ACCEPTED: 0,
  ACCEPTED: 1,
  DEPARTED: 2,
  ARRIVED: 3,
  IN_PROGRESS: 4,
  DONE: 5,
} as const

const roleGuard = (allowed: string[]) => (ctx: TransitionCtx) => {
  if (!allowed.includes(ctx.actor.role)) return `${ctx.actor.role} 角色无权执行此操作`
  return null
}

const idGuard = (expectedRole: string, expectedId: string, message: string) => (ctx: TransitionCtx) => {
  const id = expectedRole === "customer" ? ctx.contract.customerId : ctx.contract.providerId
  if (ctx.actor.id !== id && ctx.actor.role !== "ADMIN") return message
  return null
}

export const housekeepingProtocol: ProtocolDef = {
  id: "protocol_housekeeping",
  name: "家政",
  description: "家庭维修/保洁/安装等上门服务",
  category: "life_service",
  version: "1.0.0",
  extends: "protocol_base",
  classificationKeywords: ["维修", "保洁", "按摩", "家政", "其他"],

  roles: {
    observer: { min: 0, max: 10, description: "观察者（担保人/助手）" },
  },

  funding: {
    mode: "full_prepay",
    hold: "platform_escrow",
    release: ["on_confirm", "auto_timeout"],
    fees: {
      platform_commission: 0.15,
      satisfaction_hold: 0.10,
    },
    autoReleaseTimeout: 7 * 86400,
  },

  serviceStages: ["NOT_ACCEPTED", "ACCEPTED", "DEPARTED", "ARRIVED", "IN_PROGRESS", "DONE"],

  states: [
    { name: "PENDING_HELD", description: "待冻结" },
    { name: "HELD", description: "已冻结" },
    { name: "COMPLETED", description: "已完成" },
    { name: "DISPUTED", description: "争议中" },
    { name: "CANCELLED", description: "已取消" },
    { name: "SATISFACTION_HELD", description: "暂存款排队中" },
    { name: "SETTLED", description: "已结算", terminal: true },
  ],

  transitions: [
    // ── 支付 ──
    {
      action: "pay",
      from: "PENDING_HELD", to: "HELD",
      allowedRoles: ["customer"],
      guard: idGuard("customer", "customerId", "只有客户能支付"),
    },
    // ── 取消 ──
    {
      action: "cancel_before_pay",
      from: "PENDING_HELD", to: "CANCELLED",
      allowedRoles: ["customer"],
      guard: idGuard("customer", "customerId", "只有客户能取消"),
    },
    {
      action: "cancel_during_service",
      from: "HELD", to: "CANCELLED",
      allowedRoles: ["customer", "provider"],
      guard: (ctx) => {
        if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.id !== ctx.contract.providerId) return "只有参与者能取消"
        return null
      },
    },
    {
      action: "settle_cancelled",
      from: "CANCELLED", to: "SETTLED",
      allowedRoles: ["system", "admin"],
      guard: () => null,
    },
    // ── 师傅流程（服务阶段变化，资金状态不变）──
    {
      action: "provider_accept",
      from: "HELD", to: "HELD",
      allowedRoles: ["provider"],
      serviceStage: { from: STAGE.NOT_ACCEPTED, to: STAGE.ACCEPTED },
      guard: idGuard("provider", "providerId", "只有接单师傅能操作"),
    },
    {
      action: "provider_depart",
      from: "HELD", to: "HELD",
      allowedRoles: ["provider"],
      serviceStage: { from: STAGE.ACCEPTED, to: STAGE.DEPARTED },
      guard: idGuard("provider", "providerId", "只有师傅能操作"),
    },
    {
      action: "provider_arrive",
      from: "HELD", to: "HELD",
      allowedRoles: ["provider"],
      serviceStage: { from: STAGE.DEPARTED, to: STAGE.ARRIVED },
      guard: idGuard("provider", "providerId", "只有师傅能操作"),
    },
    {
      action: "start_service",
      from: "HELD", to: "HELD",
      allowedRoles: ["provider"],
      serviceStage: { from: STAGE.ARRIVED, to: STAGE.IN_PROGRESS },
      guard: idGuard("provider", "providerId", "只有师傅能操作"),
    },
    {
      action: "request_complete",
      from: "HELD", to: "HELD",
      allowedRoles: ["provider"],
      serviceStage: { from: STAGE.IN_PROGRESS, to: STAGE.DONE },
      guard: idGuard("provider", "providerId", "只有师傅能操作"),
    },
    // ── 完成 ──
    {
      action: "confirm_complete",
      from: "HELD", to: "COMPLETED",
      allowedRoles: ["customer", "admin"],
      guard: (ctx) => {
        if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.role !== "ADMIN") return "只有客户能确认完成"
        return null
      },
    },
    {
      action: "auto_complete",
      from: "HELD", to: "COMPLETED",
      allowedRoles: ["system"],
      guard: (ctx) => {
        if (!ctx.contract.autoCompleteAt) return "未设置自动完成时间"
        if (new Date() < ctx.contract.autoCompleteAt) return "未到自动完成时间"
        return null
      },
    },
    // ── 满意度暂存 ──
    {
      action: "hold_satisfaction",
      from: "COMPLETED", to: "SATISFACTION_HELD",
      allowedRoles: ["system", "admin"],
      guard: () => null,
    },
    {
      action: "release_satisfaction",
      from: "SATISFACTION_HELD", to: "SETTLED",
      allowedRoles: ["system", "admin"],
      guard: () => null,
    },
    // ── 争议 ──
    {
      action: "open_dispute",
      from: "HELD", to: "HELD",
      allowedRoles: ["customer"],
      guard: (ctx) => {
        if (ctx.contract.disputeStatus) return "争议已存在"
        if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.role !== "ADMIN") return "只有客户能发起争议"
        return null
      },
    },
    {
      action: "open_dispute_after_complete",
      from: "SATISFACTION_HELD", to: "SATISFACTION_HELD",
      allowedRoles: ["customer"],
      guard: (ctx) => {
        if (ctx.contract.disputeStatus) return "争议已存在"
        if (!ctx.payload?.qualityClaim) return "需提供质保相关争议说明"
        return null
      },
    },
    {
      action: "resolve_dispute",
      from: "HELD", to: "HELD",
      allowedRoles: ["admin"],
      guard: (ctx) => {
        if (ctx.contract.disputeStatus !== "OPEN") return "无待处理的争议"
        if (!ctx.payload?.resolution) return "需提供仲裁裁决"
        return null
      },
    },
    {
      action: "settle_after_dispute",
      from: "HELD", to: "SETTLED",
      allowedRoles: ["admin"],
      guard: (ctx) => {
        if (ctx.contract.disputeStatus !== "RESOLVED") return "争议未解决，无法结算"
        return null
      },
    },
  ],

  // 退款规则（按服务阶段）
  refundRules: [
    { stage: 0, customerGets: "all" },
    { stage: 1, customerGets: "all" },
    { stage: 2, providerRatio: 0.1, providerMax: 30, customerGets: "rest" },
    { stage: 3, providerRatio: 0.15, providerMax: 50, customerGets: "rest" },
    { stage: 4, providerRatio: 0.5, customerGets: "rest" },
    { stage: 5, providerRatio: 0.5, customerGets: "rest" },
  ],

  completion: {
    trigger: "on_confirm",
    requiredEvidence: ["after_photo"],
    autoTimeoutSeconds: 7 * 86400,
  },

  default: {
    types: ["no_show", "incomplete", "quality_issue", "misconduct"],
    requiredEvidence: ["before_photo", "after_photo", "chat_log", "gps_track"],
  },

  evidence: [
    { type: "before_photo", label: "服务前照片", required: true, maxCount: 5 },
    { type: "after_photo", label: "服务后照片", required: true, maxCount: 5 },
    { type: "chat_log", label: "聊天记录", required: false },
    { type: "gps_track", label: "轨迹记录", required: false },
    { type: "receipt", label: "票据", required: false, maxCount: 3 },
  ],

  review: {
    type: "objective",
    dimensions: [
      { name: "quality", label: "修好了吗", weight: 0.40, type: "yesno" },
      { name: "punctuality", label: "按时到达", weight: 0.20, type: "1to5" },
      { name: "price_clarity", label: "价格透明", weight: 0.15, type: "1to5" },
      { name: "attitude", label: "沟通态度", weight: 0.15, type: "1to5" },
      { name: "cleanliness", label: "现场整洁", weight: 0.10, type: "1to5" },
    ],
    labelExtraction: true,
  },

  dispute: {
    channels: {
      green: { maxAmount: 200, llmHours: 2, resolveHours: 24 },
      yellow: { minAmount: 200, maxAmount: 500, llmHours: 2, resolveHours: 48 },
      red: { minAmount: 500, llmHours: 4, resolveHours: 72 },
    },
    autoTimeoutDays: 14,
  },
}
