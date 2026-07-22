import type { ProtocolDef, TransitionCtx } from "../types"

const roleGuard = (allowed: string[]) => (ctx: TransitionCtx) => {
  if (!allowed.includes(ctx.actor.role)) return `${ctx.actor.role} 角色无权执行此操作`
  return null
}

const idGuard = (expectedRole: string, expectedId: string, message: string) => (ctx: TransitionCtx) => {
  const id = expectedRole === "customer" ? ctx.contract.customerId : ctx.contract.providerId
  if (ctx.actor.id !== id && ctx.actor.role !== "ADMIN") return message
  return null
}

export const datingProtocol: ProtocolDef = {
  id: "protocol_dating",
  name: "约会",
  description: "社交约会/见面防鸽子，双方押金锁定，按时到场自动释放",
  category: "social",
  version: "1.0.0",
  extends: "protocol_base",
  classificationKeywords: ["社交", "约会"],

  roles: {
    customer: { min: 1, max: 1, description: "邀约方（主动发起）" },
    provider: { min: 1, max: 1, description: "受邀方" },
    platform: { min: 1, max: 1, description: "平台" },
    observer: { min: 0, max: 0, description: "约会无观察者" },
  },

  funding: {
    mode: "commitment",
    hold: "platform_escrow",
    release: ["on_confirm", "auto_timeout"],
    fees: {
      platform_commission: 0.05,
      satisfaction_hold: 0,
    },
    autoReleaseTimeout: 4 * 3600,
    modifiers: {
      dualDeposit: {
        providerRatio: 1,
        customerRatio: 1,
      },
    },
  },

  states: [
    { name: "PENDING", description: "等待双方押金到账" },
    { name: "HELD", description: "双方押金已冻结" },
    { name: "COMPLETED", description: "已完成（押金释放）" },
    { name: "CANCELLED", description: "已取消" },
    { name: "DISPUTED", description: "争议中（一方未到）" },
    { name: "SETTLED", description: "已结算", terminal: true },
  ],

  transitions: [
    // ── 邀约方支付押金 ──
    {
      action: "customer_pay",
      from: "PENDING", to: "HELD",
      allowedRoles: ["customer"],
      guard: idGuard("customer", "customerId", "只有邀约方能支付"),
    },
    // ── 受邀方支付押金 ──
    {
      action: "provider_pay",
      from: "PENDING", to: "HELD",
      allowedRoles: ["provider"],
      guard: idGuard("provider", "providerId", "只有受邀方能支付"),
    },
    // ── 取消（押金全退）──
    {
      action: "cancel_before_pay",
      from: "PENDING", to: "CANCELLED",
      allowedRoles: ["customer", "provider"],
      guard: (ctx) => {
        if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.id !== ctx.contract.providerId) return "只有参与者能取消"
        return null
      },
    },
    {
      action: "mutual_cancel",
      from: "HELD", to: "CANCELLED",
      allowedRoles: ["customer", "provider"],
      guard: (ctx) => {
        if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.id !== ctx.contract.providerId) return "只有参与者能取消"
        return null
      },
    },
    // ── 确认到场 ──
    {
      action: "confirm_arrival",
      from: "HELD", to: "HELD",
      allowedRoles: ["customer", "provider"],
      guard: (ctx) => {
        if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.id !== ctx.contract.providerId) return "只有参与者能确认"
        return null
      },
    },
    // ── 双方确认完成 ──
    {
      action: "confirm_complete",
      from: "HELD", to: "COMPLETED",
      allowedRoles: ["customer", "provider"],
      guard: (ctx) => {
        if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.id !== ctx.contract.providerId) return "只有参与者能确认"
        return null
      },
    },
    // ── 一方未到 ──
    {
      action: "report_no_show",
      from: "HELD", to: "HELD",
      allowedRoles: ["customer", "provider"],
      guard: (ctx) => {
        if (ctx.contract.disputeStatus) return "争议已存在"
        if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.id !== ctx.contract.providerId) return "只有参与者能举报"
        return null
      },
    },
    // ── 仲裁 ──
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
    // ── 系统结算 ──
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
    {
      action: "settle",
      from: "COMPLETED", to: "SETTLED",
      allowedRoles: ["system", "admin"],
      guard: () => null,
    },
    {
      action: "settle_cancelled",
      from: "CANCELLED", to: "SETTLED",
      allowedRoles: ["system", "admin"],
      guard: () => null,
    },
  ],

  completion: {
    trigger: "mutual_confirm",
    requiredEvidence: ["gps_track"],
    autoTimeoutSeconds: 4 * 3600,
  },

  default: {
    types: ["no_show", "misconduct"],
    requiredEvidence: ["gps_track", "chat_log"],
  },

  evidence: [
    { type: "gps_track", label: "定位记录", required: false },
    { type: "chat_log", label: "聊天记录", required: false },
    { type: "photo", label: "现场照片", required: false, maxCount: 3 },
  ],

  review: {
    type: "subjective",
    dimensions: [
      { name: "punctuality", label: "准时到达", weight: 0.35, type: "1to5" },
      { name: "appearance", label: "与照片相符", weight: 0.25, type: "1to5" },
      { name: "conversation", label: "沟通体验", weight: 0.25, type: "1to5" },
      { name: "safety", label: "安全感", weight: 0.15, type: "yesno" },
    ],
    labelExtraction: true,
  },

  dispute: {
    channels: {
      green: { maxAmount: 500, llmHours: 1, resolveHours: 6 },
      yellow: { minAmount: 500, maxAmount: 2000, llmHours: 2, resolveHours: 24 },
      red: { minAmount: 2000, llmHours: 4, resolveHours: 48 },
    },
    autoTimeoutDays: 7,
  },
}
