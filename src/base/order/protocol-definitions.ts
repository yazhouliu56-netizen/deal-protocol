import type { ProtocolDef, ProtocolEntry, TransitionCtx } from "./protocol-types"
import { OFFICIAL_AMMO } from "@/ammo/registry"
import type { IAmmoDefinition } from "@/types/ammo-schema"
import {
  HOUSEKEEPING_REFUND_RULES,
  HOUSEKEEPING_EVIDENCE,
} from "@/ammo/housekeeping.ammo"
import { MEETUP_REFUND_RULES, MEETUP_EVIDENCE } from "@/ammo/meetup.ammo"

/* ══════════════════════════════════════════════════════════════════════
 * 协议注册表 · P1 步骤二（旧垂直协议旧轨完全收敛）→ D-5 Phase E 资产归位 Base
 *
 * 事实源收敛：本文件不再引用 `./protocols/*` 三个旧文件（base/housekeeping/
 * dating，合计 535 行历史重复代码已物理删除）。旧垂直协议仅为 ammo 弹药的
 * 一次「投影视图」：三枚官方弹药（housekeeping-v1 / meetup-social-v1 /
 * companion-v1，出处注释见各 ammo 文件头部「存量资产升级仪式」）经
 * OFFICIAL_AMMO 直挂读取，由投影适配器投影为标准 `ProtocolDef`。
 *
 * D-5 Phase E（参谋部裁决 1）：协议定义资产化常驻 Base——纯数据+纯函数，
 * 零 DB 热配（bootstrap/syncBuiltinsToDb 已退役）；@/ammo 为纯数据资产层
 * （红线 3 仅禁 DB/UI/Store），base→ammo-data 单向依赖经收敛登记背书。
 *
 * 投影分层：
 *   ① 动态数值 —— 全部取自 ammo 八维配置（D6 违约阶梯 → refundRules、
 *      D7 分账 → funding.fees、超时代验收 → completion.autoTimeoutSeconds、
 *      D4 传感 → evidence、派单硬门槛 → classificationKeywords、SOP → stages）；
 *   ② 静态行业语义 —— 角色 / 资金状态机 / 评价维度 / 争议通道（ammo 参数
 *      无此维度的领域骨架），由适配器合表声明，与 ammo 单向投影、不双轨。
 * ══════════════════════════════════════════════════════════════════════ */

/** guard：角色白名单（ammo 无禁令语义，用于资金状态机动作的角色校验）。 */
const roleGuard = (allowed: string[]) => (ctx: TransitionCtx) => {
  if (!allowed.includes(ctx.actor.role)) return `${ctx.actor.role} 角色无权执行此操作`
  return null
}

/** guard：绑定到合约参与方实人（含 ADMIN 放行），与旧 housekeeping/dating 语义一致。 */
const idGuard = (expectedRole: string, expectedId: string, message: string) => (ctx: TransitionCtx) => {
  const id = expectedRole === "customer" ? ctx.contract.customerId : ctx.contract.providerId
  if (ctx.actor.id !== id && ctx.actor.role !== "ADMIN") return message
  return null
}

const contractPartyGuard = (message: string) => (ctx: TransitionCtx) => {
  if (ctx.actor.id !== ctx.contract.customerId && ctx.actor.id !== ctx.contract.providerId) return message
  return null
}

/** 服务阶段六态（存量 STAGE 0-5 枚举 · 索引即序号）。 */
const SERVICE_STAGES = ["NOT_ACCEPTED", "ACCEPTED", "DEPARTED", "ARRIVED", "IN_PROGRESS", "DONE"]

/**
 * SLA 全局默认阶段纪律（秒）——Microkernel 2.0 战役 1（P1-4）。
 * 弹药未声明 slaPhases 或部分缺键时逐键回落至此；数值与退役前的
 * sla-enforcer 全局硬编码等值迁移（ACCEPTED 30min / DEPARTED 60min）。
 */
export const DEFAULT_SLA_PHASES: Record<string, number> = {
  ACCEPTED: 1800,
  DEPARTED: 3600,
}

/** 解析协议生效 SLA 阶段表：默认底表 + 弹药声明覆盖合并（纯函数）。 */
export function resolveSlaPhases(def?: { slaPhases?: Record<string, number> }): Record<string, number> {
  return { ...DEFAULT_SLA_PHASES, ...(def?.slaPhases ?? {}) }
}

/* ══════════════════════════════════════════════════════════════════════
 * 基准协议骨架（旧 protocols/base.ts 收敛内联）
 * ══════════════════════════════════════════════════════════════════════ */

const BASE_PROTOCOL_DEF: ProtocolDef = {
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

  evidence: [{ type: "chat_log", label: "聊天记录", required: false }],

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

/* ══════════════════════════════════════════════════════════════════════
 * 投影适配器：ammo 弹药 → ProtocolDef
 * ══════════════════════════════════════════════════════════════════════ */

/** D7 分账 → 平台佣金（资金守恒 1.0：佣金 = 1 - 服务方占比；无分账配置时默认 0.15）。 */
function projectCommission(ammo: IAmmoDefinition): number {
  const ratio = ammo.holographic?.splitRules?.providerRatio
  if (typeof ratio !== "number") return 0.15
  const commission = 1 - ratio
  return Math.max(0, Math.min(1, Math.round(commission * 1e6) / 1e6))
}

/** D7 超时代验收 → 完成超时（秒）。缺省 24h（ammo 契约默认）。 */
function projectAutoTimeoutSeconds(ammo: IAmmoDefinition): number {
  const hours = ammo.autoAcceptanceTimeoutHours ?? 24
  return hours * 3600
}

/** D6 违约阶梯 → refundRules（demanderRefundRatio → providerRatio = 1 - 退还比；补偿金 → providerMax）。 */
function projectRefundRules(ammo: IAmmoDefinition): ProtocolDef["refundRules"] {
  const tiers = ammo.holographic?.cancellationTiers
  if (!tiers || tiers.length === 0) return undefined
  const stageByTier: Record<string, number> = {
    BEFORE_MATCH: 0,
    AFTER_MATCH_EN_ROUTE: 2,
    ON_SITE: 3,
    IN_SERVICE: 4,
  }
  const rules = tiers.map((t) => {
    const stage = stageByTier[t.stage]
    if (stage === undefined) return null
    if (t.demanderRefundRatio >= 1) return { stage, customerGets: "all" as const }
    return {
      stage,
      providerRatio: Math.max(0, 1 - t.demanderRefundRatio),
      providerMax: t.providerCompensationYuan > 0 ? t.providerCompensationYuan : undefined,
      customerGets: "rest" as const,
    }
  })
  return rules.filter((r): r is NonNullable<typeof r> => r !== null)
}

/** D4 传感名单 → 证据契约（requiredSensors → evidence 类型）。 */
function projectSensorsToEvidence(ammo: IAmmoDefinition): ProtocolDef["evidence"] {
  const sensors = ammo.holographic?.requiredSensors ?? []
  const map: Record<string, { type: string; label: string }> = {
    GPS_GEOFENCE: { type: "gps_track", label: "定位记录" },
    WATERMARK_CAMERA: { type: "photo", label: "水印照片" },
    REAL_TIME_AUDIO: { type: "audio_recording", label: "实时录音" },
  }
  const out: ProtocolDef["evidence"] = []
  for (const s of sensors) {
    const m = map[s]
    if (m) out.push({ type: m.type, label: m.label, required: false })
  }
  return out
}

/** 派单硬门槛实名关键词 → 分类关键词（ammo 语义源）。 */
function projectKeywords(ammo: IAmmoDefinition): string[] {
  const kw = new Set<string>()
  for (const k of ammo.dispatchRule?.hardGates?.requiresVerified ?? []) kw.add(k)
  return [...kw]
}

/**
 * 投影适配器主函数：ammo 八维配置 → ProtocolDef。
 * ① 动态数值（分账/违约阶梯/超时/证据/关键词）取 ammo；② 静态行业语义合表。
 */
function projectAmmoToProtocol(
  ammo: IAmmoDefinition,
  meta: {
    id: string
    name: string
    description: string
    category: string
    classificationKeywords: string[]
    roles: ProtocolDef["roles"]
    funding: ProtocolDef["funding"] & { mode: ProtocolDef["funding"]["mode"] }
    states: ProtocolDef["states"]
    transitions: ProtocolDef["transitions"]
    completion: ProtocolDef["completion"]
    default: ProtocolDef["default"]
    evidence: ProtocolDef["evidence"]
    review: ProtocolDef["review"]
    dispute: ProtocolDef["dispute"]
    refundRules?: ProtocolDef["refundRules"]
    autoReleaseTimeout?: number
  },
): ProtocolDef {
  return {
    id: meta.id,
    name: meta.name,
    description: meta.description,
    category: meta.category,
    version: ammo.version,
    extends: "protocol_base",
    classificationKeywords: [...new Set([...projectKeywords(ammo), ...meta.classificationKeywords])],

    roles: meta.roles,
    funding: {
      ...meta.funding,
      fees: {
        ...meta.funding.fees,
        platform_commission: projectCommission(ammo),
      },
      autoReleaseTimeout: meta.autoReleaseTimeout ?? projectAutoTimeoutSeconds(ammo),
    },
    states: meta.states,
    transitions: meta.transitions,
    serviceStages: SERVICE_STAGES,
    // Microkernel 2.0 战役 1（P1-4）：SLA 阶段时间纪律随弹药全息镜像投影
    slaPhases: ammo.holographic?.slaPhases,
    refundRules: meta.refundRules ?? projectRefundRules(ammo),
    completion: {
      ...meta.completion,
      autoTimeoutSeconds: projectAutoTimeoutSeconds(ammo),
    },
    default: meta.default,
    review: meta.review,
    evidence: meta.evidence,
    dispute: meta.dispute,
  }
}

/* ══════════════════════════════════════════════════════════════════════
 * 三枚官方弹药投影（静态行业语义合表）
 * ══════════════════════════════════════════════════════════════════════ */

/** 家政 · housekeeping-v1 → protocol_housekeeping（老 protocol_housekeeping 语义等价）。 */
const projectHousekeeping = (): ProtocolDef => {
  const ammo = OFFICIAL_AMMO.housekeeping
  return projectAmmoToProtocol(
    ammo,
    {
      id: "protocol_housekeeping",
      name: "家政",
      description: "家庭维修/保洁/安装等上门服务",
      category: "life_service",
      classificationKeywords: ["维修", "保洁", "按摩", "家政", "其他"],

      roles: {
        customer: { min: 1, max: 1, description: "买方/发起方（业主）" },
        provider: { min: 1, max: 1, description: "卖方/响应方（上门师傅）" },
        platform: { min: 1, max: 1, description: "平台" },
        observer: { min: 0, max: 10, description: "观察者（担保人/助手）" },
      },

      funding: {
        mode: "full_prepay",
        hold: "platform_escrow",
        release: ["on_confirm", "auto_timeout"],
        fees: {
          platform_commission: 0.15,
          satisfaction_hold: 0.1,
        },
      },

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
          guard: contractPartyGuard("只有参与者能取消"),
        },
        {
          action: "settle_cancelled",
          from: "CANCELLED", to: "SETTLED",
          allowedRoles: ["system", "admin"],
          guard: roleGuard(["system", "admin"]),
        },
        // ── 师傅流程（服务阶段变化，资金状态不变）──
        {
          action: "provider_accept",
          from: "HELD", to: "HELD",
          allowedRoles: ["provider"],
          serviceStage: { from: 0, to: 1 },
          guard: idGuard("provider", "providerId", "只有接单师傅能操作"),
        },
        {
          action: "provider_depart",
          from: "HELD", to: "HELD",
          allowedRoles: ["provider"],
          serviceStage: { from: 1, to: 2 },
          guard: idGuard("provider", "providerId", "只有师傅能操作"),
        },
        {
          action: "provider_arrive",
          from: "HELD", to: "HELD",
          allowedRoles: ["provider"],
          serviceStage: { from: 2, to: 3 },
          guard: idGuard("provider", "providerId", "只有师傅能操作"),
        },
        {
          action: "start_service",
          from: "HELD", to: "HELD",
          allowedRoles: ["provider"],
          serviceStage: { from: 3, to: 4 },
          guard: idGuard("provider", "providerId", "只有师傅能操作"),
        },
        {
          action: "request_complete",
          from: "HELD", to: "HELD",
          allowedRoles: ["provider"],
          serviceStage: { from: 4, to: 5 },
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
          guard: roleGuard(["system", "admin"]),
        },
        {
          action: "release_satisfaction",
          from: "SATISFACTION_HELD", to: "SETTLED",
          allowedRoles: ["system", "admin"],
          guard: roleGuard(["system", "admin"]),
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

      completion: {
        trigger: "on_confirm",
        requiredEvidence: ["after_photo"],
      },

      default: {
        types: ["no_show", "incomplete", "quality_issue", "misconduct"],
        requiredEvidence: ["before_photo", "after_photo", "chat_log", "gps_track"],
      },

      evidence: [
        {
          type: "before_photo",
          label: HOUSEKEEPING_EVIDENCE.beforePhoto.label,
          required: HOUSEKEEPING_EVIDENCE.beforePhoto.required,
          maxCount: HOUSEKEEPING_EVIDENCE.beforePhoto.maxCount,
        },
        {
          type: "after_photo",
          label: HOUSEKEEPING_EVIDENCE.afterPhoto.label,
          required: HOUSEKEEPING_EVIDENCE.afterPhoto.required,
          maxCount: HOUSEKEEPING_EVIDENCE.afterPhoto.maxCount,
        },
        { type: "chat_log", label: "聊天记录", required: false },
        { type: "gps_track", label: "轨迹记录", required: false },
        { type: "receipt", label: "票据", required: false, maxCount: 3 },
      ],

      review: {
        type: "objective",
        dimensions: [
          { name: "quality", label: "修好了吗", weight: 0.4, type: "yesno" },
          { name: "punctuality", label: "按时到达", weight: 0.2, type: "1to5" },
          { name: "price_clarity", label: "价格透明", weight: 0.15, type: "1to5" },
          { name: "attitude", label: "沟通态度", weight: 0.15, type: "1to5" },
          { name: "cleanliness", label: "现场整洁", weight: 0.1, type: "1to5" },
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

      // D6 违约阶梯已含 0/2/3/4 档；1/5 档由 engine.calcRefund「最接近较低档」兜底
      refundRules: HOUSEKEEPING_REFUND_RULES.map((r) => ({ ...r })),
      autoReleaseTimeout: 7 * 86400,
    },
  )
}

/** 组局 · meetup-social-v1 → protocol_meetup（出处 dating.ts 双押金 AA 保障金资产投影）。 */
const projectMeetup = (): ProtocolDef => {
  const ammo = OFFICIAL_AMMO.meetup
  return projectAmmoToProtocol(
    ammo,
    {
      id: "protocol_meetup",
      name: "组局",
      description: "同城组局 AA 保障金锁定，按时到场自动释放",
      category: "social",
      classificationKeywords: ["社交", "组局", "拼桌", "桌游"],

      roles: {
        customer: { min: 1, max: 1, description: "组织者/发起方" },
        provider: { min: 1, max: 1, description: "场地方/响应方" },
        platform: { min: 1, max: 1, description: "平台" },
      },

      funding: {
        mode: "commitment",
        hold: "platform_escrow",
        release: ["on_confirm", "auto_timeout"],
        fees: {
          platform_commission: 0.12,
          satisfaction_hold: 0,
        },
      },

      states: [
        { name: "PENDING", description: "等待各方保障金到账" },
        { name: "HELD", description: "保障金已冻结" },
        { name: "COMPLETED", description: "已完成（保障金释放）" },
        { name: "CANCELLED", description: "已取消" },
        { name: "DISPUTED", description: "争议中（一方未到）" },
        { name: "SETTLED", description: "已结算", terminal: true },
      ],

      transitions: [
        // ── 组织者支付保障金 ──
        {
          action: "customer_pay",
          from: "PENDING", to: "HELD",
          allowedRoles: ["customer"],
          guard: idGuard("customer", "customerId", "只有组织者能支付"),
        },
        // ── 响应方支付保障金 ──
        {
          action: "provider_pay",
          from: "PENDING", to: "HELD",
          allowedRoles: ["provider"],
          guard: idGuard("provider", "providerId", "只有场地方能支付"),
        },
        // ── 取消（保障金全退）──
        {
          action: "cancel_before_pay",
          from: "PENDING", to: "CANCELLED",
          allowedRoles: ["customer", "provider"],
          guard: contractPartyGuard("只有参与者能取消"),
        },
        {
          action: "mutual_cancel",
          from: "HELD", to: "CANCELLED",
          allowedRoles: ["customer", "provider"],
          guard: contractPartyGuard("只有参与者能取消"),
        },
        // ── 确认到场（围栏解锁）：服务阶段推进 ──
        {
          action: "confirm_arrival",
          from: "HELD", to: "HELD",
          allowedRoles: ["customer", "provider"],
          serviceStage: { from: 0, to: 3 },
          guard: contractPartyGuard("只有参与者能确认"),
        },
        // ── 双方确认完成 ──
        {
          action: "confirm_complete",
          from: "HELD", to: "COMPLETED",
          allowedRoles: ["customer", "provider"],
          guard: contractPartyGuard("只有参与者能确认"),
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
        // ── 系统结算（6h 超时自动成局/关闭）──
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
          guard: roleGuard(["system", "admin"]),
        },
        {
          action: "settle_cancelled",
          from: "CANCELLED", to: "SETTLED",
          allowedRoles: ["system", "admin"],
          guard: roleGuard(["system", "admin"]),
        },
      ],

      completion: {
        trigger: "mutual_confirm",
        requiredEvidence: ["gps_track"],
      },

      default: {
        types: ["no_show", "misconduct"],
        requiredEvidence: ["gps_track", "chat_log"],
      },

      evidence: [
        {
          type: "gps_track",
          label: MEETUP_EVIDENCE.arrivalGps.label,
          required: MEETUP_EVIDENCE.arrivalGps.required,
        },
        { type: "scan_check", label: "双方扫码确认到场", required: false, maxCount: 1 },
        { type: "photo", label: "活动现场照片", required: false, maxCount: 3 },
      ],

      review: {
        type: "subjective",
        dimensions: [
          { name: "punctuality", label: "准时到达", weight: 0.35, type: "1to5" },
          { name: "organization", label: "组局体验", weight: 0.25, type: "1to5" },
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

      // 语义转译：full-refund → 全退；no-show-penalty → 爽约方保障金全失归守约方
      refundRules: MEETUP_REFUND_RULES.map((r) => {
        if (r.policy === "full-refund") return { stage: r.stage, customerGets: "all" as const }
        if (r.policy === "no-show-penalty") return { stage: r.stage, providerRatio: 1, customerGets: "rest" as const }
        if (r.policy === "arrived-refund") return { stage: r.stage, providerRatio: 1, customerGets: "rest" as const }
        return { stage: r.stage, providerRatio: 0.5, customerGets: "rest" as const }
      }),
      autoReleaseTimeout: 6 * 3600,
    },
  )
}

/** 陪玩/约会 · companion-v1 → protocol_dating（老 protocol_dating 语义等价保留）。 */
const projectDating = (): ProtocolDef => {
  const ammo = OFFICIAL_AMMO.dating
  return projectAmmoToProtocol(
    ammo,
    {
      id: "protocol_dating",
      name: "陪玩/约会",
      description: "同城陪玩/约会防鸽子，各自押金锁定，按时到场自动释放",
      category: "social",
      classificationKeywords: ["社交", "约会", "陪玩"],

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
          platform_commission: 0.15,
          satisfaction_hold: 0,
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
          guard: contractPartyGuard("只有参与者能取消"),
        },
        {
          action: "mutual_cancel",
          from: "HELD", to: "CANCELLED",
          allowedRoles: ["customer", "provider"],
          guard: contractPartyGuard("只有参与者能取消"),
        },
        // ── 确认到场（300m 安全距离 / 围栏解锁）──
        {
          action: "confirm_arrival",
          from: "HELD", to: "HELD",
          allowedRoles: ["customer", "provider"],
          serviceStage: { from: 0, to: 3 },
          guard: contractPartyGuard("只有参与者能确认"),
        },
        // ── 双方确认完成 ──
        {
          action: "confirm_complete",
          from: "HELD", to: "COMPLETED",
          allowedRoles: ["customer", "provider"],
          guard: contractPartyGuard("只有参与者能确认"),
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
        // ── 系统结算（2h 超时自动代结）──
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
          guard: roleGuard(["system", "admin"]),
        },
        {
          action: "settle_cancelled",
          from: "CANCELLED", to: "SETTLED",
          allowedRoles: ["system", "admin"],
          guard: roleGuard(["system", "admin"]),
        },
      ],

      completion: {
        trigger: "mutual_confirm",
        requiredEvidence: ["gps_track"],
      },

      default: {
        types: ["no_show", "misconduct"],
        requiredEvidence: ["gps_track", "chat_log"],
      },

      evidence: [
        ...projectSensorsToEvidence(ammo),
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
    },
  )
}

/* ══════════════════════════════════════════════════════════════════════
 * 注册表（对外 API 与旧签名完全一致）
 * ══════════════════════════════════════════════════════════════════════ */

/** 内置基准协议映射：id → def（ammo 投影父级池）。 */
const baseProtocols = new Map<string, ProtocolDef>()

function registerBase(def: ProtocolDef): void {
  baseProtocols.set(def.id, def)
}

registerBase(BASE_PROTOCOL_DEF)

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

/* ══════════════════════════════════════════════════════════════════════
 * 内置协议（ammo 投影注册）
 * ══════════════════════════════════════════════════════════════════════ */

function initBuiltinProtocols(): void {
  protocolRegistry.register(projectHousekeeping())
  protocolRegistry.register(projectMeetup())
  protocolRegistry.register(projectDating())
}

initBuiltinProtocols()

/** 只读协议字典（id → 已解析 def），与旧导出签名一致。 */
export const PROTOCOLS: Record<string, ProtocolDef> = Object.fromEntries(
  protocolRegistry.getAll().map((d) => [d.id, d]),
)

/** 按协议 id 取解析后的协议定义（旧签名：未命中返回 undefined）。 */
export function getProtocol(id: string): ProtocolDef | undefined {
  return protocolRegistry.get(id)
}