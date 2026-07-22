import type { ProtocolDef } from "../types"

export const baseProtocol: ProtocolDef = {
  id: "protocol_base",
  name: "基准协议",
  description: "所有协议的通用骨架，被继承后不单独使用",
  category: "base",
  version: "1.0.0",

  roles: {
    customer: { min: 1, max: 1, description: "买方/发起方" },
    provider: { min: 1, max: 1, description: "卖方/响应方" },
    platform: { min: 1, max: 1, description: "平台" },
  },

  funding: {
    mode: "full_prepay",
    hold: "platform_escrow",
    release: ["on_confirm"],
    fees: {
      platform_commission: 0.15,
      satisfaction_hold: 0,
    },
    autoReleaseTimeout: 7 * 86400,
  },

  states: [
    { name: "PENDING", description: "待处理" },
    { name: "HELD", description: "已冻结" },
    { name: "COMPLETED", description: "已完成" },
    { name: "SATISFACTION_HELD", description: "暂存评估" },
    { name: "CANCELLED", description: "已取消" },
    { name: "DISPUTED", description: "争议中" },
    { name: "SETTLED", description: "已结算", terminal: true },
  ],

  transitions: [
    { action: "pay", from: "PENDING", to: "HELD", allowedRoles: ["customer"] },
    { action: "cancel_before_pay", from: "PENDING", to: "CANCELLED", allowedRoles: ["customer"] },
    { action: "cancel_during_service", from: "HELD", to: "CANCELLED", allowedRoles: ["customer", "provider"] },
    { action: "confirm_complete", from: "HELD", to: "COMPLETED", allowedRoles: ["customer"] },
    { action: "auto_complete", from: "HELD", to: "COMPLETED", allowedRoles: ["system"] },
    { action: "hold_satisfaction", from: "COMPLETED", to: "SATISFACTION_HELD", allowedRoles: ["system", "admin"] },
    { action: "release_satisfaction", from: "SATISFACTION_HELD", to: "SETTLED", allowedRoles: ["system", "admin"] },
    { action: "settle", from: "COMPLETED", to: "SETTLED", allowedRoles: ["system", "admin"] },
    { action: "settle_cancelled", from: "CANCELLED", to: "SETTLED", allowedRoles: ["system", "admin"] },
    { action: "open_dispute", from: "HELD", to: "CANCELLED", allowedRoles: ["customer"] },
    { action: "resolve_dispute", from: "CANCELLED", to: "CANCELLED", allowedRoles: ["admin"] },
    { action: "settle_after_dispute", from: "CANCELLED", to: "SETTLED", allowedRoles: ["admin"] },
  ],

  completion: {
    trigger: "on_confirm",
    requiredEvidence: [],
    autoTimeoutSeconds: 7 * 86400,
  },

  default: {
    types: ["default"],
    requiredEvidence: [],
  },

  evidence: [
    { type: "chat_log", label: "聊天记录", required: false },
  ],

  review: {
    type: "objective",
    dimensions: [],
    labelExtraction: false,
  },

  dispute: {
    channels: {
      green: { maxAmount: 200, llmHours: 2, resolveHours: 24 },
      yellow: { minAmount: 200, maxAmount: 500, llmHours: 2, resolveHours: 48 },
      red: { minAmount: 500, llmHours: 4, resolveHours: 72 },
    },
    autoTimeoutDays: 14,
  },

  classificationKeywords: [],
}
