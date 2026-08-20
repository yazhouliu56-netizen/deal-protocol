"use client";

import type { AtomicFiveState, INormalizedCustomIntent, IDressCodeType, IAmmoDefinition } from "@/types/ammo-schema";
import type { ScenarioTheme } from "@/types/ui-viewport";
import StatusCapsule from "@/components/oto-ui/StatusCapsule";
import HousekeepingSlot, { type HousekeepingSlotProps } from "./slots/HousekeepingSlot";
import MeetupSlot, { type MeetupSlotProps } from "./slots/MeetupSlot";
import CompanionSlot, { type CompanionSlotProps } from "./slots/CompanionSlot";
import DynamicAmmoSlot, {
  normalizeAmmoTheme,
  type DynamicAmmoSlotProps,
} from "./slots/DynamicAmmoSlot";
import type { IRuntimeSafetyReport } from "@/base/safe/runtime-monitor";

/**
 * 通用五态履约主屏（Universal Fulfillment Cockpit · 白皮书 §五 5.6.2）。
 *
 * 三区组装：
 * 1. 外骨骼顶栏 —— StatusCapsule（五态进度 + LBS 距离 + 离线徽标 + SOS 按钮）；
 * 2. 服务者通用卡片 —— 头像 / 实名 / 六维信用分（trustScore）/ 一键虚拟通话与隐私聊天；
 * 3. 动态视口插槽区 —— 按 scenario 毫秒级切换 Housekeeping / Meetup / Companion 插槽
 *    （外骨骼零改动，差异全收敛插槽区，红线 2 + 5.4.4 验收标准）；
 * 4. 底部物理核销 CTA —— 家政 NFC 碰碰 / 组局组织者解冻 / 陪玩 300m 脱离自动完成。
 *
 * 主题微色（白皮书 5.7 维度 1）：housekeeping 清洁蓝 / meetup 活力橙 / companion 夜幕紫。
 */

export type CockpitScenario = "housekeeping" | "meetup" | "companion" | "dynamic";

export interface CockpitProvider {
  /** 头像（emoji 兜底或 URL）。 */
  avatar: string;
  /** 称呼（脱敏展示）。 */
  name: string;
  /** 实名认证徽章。 */
  verified: boolean;
  /** 六维信用分 0-100（对齐 base/trust 信用飞轮）。 */
  trustScore: number;
}

export interface FulfillmentCockpitProps {
  /** 当前五态（由 toAtomicFiveState 投影）。 */
  status: AtomicFiveState;
  /** 场景键（决定插槽与主题微色；弹药表配置后可由 ammoId 解析）。 */
  scenario: CockpitScenario;
  /** 外骨骼顶栏选项（透传 StatusCapsule）。 */
  capsule?: { isOffline?: boolean; distanceMeters?: number; onSosClick?: () => void };
  /** 服务者通用卡片数据。 */
  provider: CockpitProvider;
  /** 家政插槽透传。 */
  housekeeping?: Omit<HousekeepingSlotProps, "onClaimDamage"> & { onClaimDamage?: () => void };
  /** 组局插槽透传。 */
  meetup?: MeetupSlotProps;
  /** 陪玩插槽透传（onTriggerFakeCall 兜底走 Cockpit 级回调）。 */
  companion?: CompanionSlotProps;
  /** 长尾动态弹药插槽透传（非三大制式的动态/长尾弹药通用履约视口）。 */
  dynamic?: DynamicAmmoSlotProps;
  /** 当前弹药整弹（D-8 主题注入：dynamic 场景按弹药 `holographic.theme` 精准挂载 data-theme）。 */
  ammo?: IAmmoDefinition;
  /** Cockpit 级事件（测试/接入点）。 */
  onTriggerFakeCall?: () => void;
  onAcceptQuote?: () => void;
  onConfirmSplit?: () => void;
  /** P0 接电：服务者卡通讯按钮真实回调（一键虚拟通话 / 隐私聊天）。 */
  onDial?: () => void;
  onChat?: () => void;
  /** 底部物理核销 CTA（三场景特化）。 */
  onComplete?: () => void;
  /** S3 SAFE_MONITOR 实时安全报告（缺省 = 不渲染安全守护徽标）。 */
  safetyReport?: IRuntimeSafetyReport;
  /** 家政插槽防坐地起价展示（基础金额 + 上限比例）。 */
  housekeepingCap?: { baseAmountYuan: number; maxSurchargeRatio?: number };
  /**
   * 需求方非标定制要求（阶段3 语义驯化产物 · 阶段4 座舱可视化）：
   * 存在且含 cleanText 时渲染中性化定制需求标签（如 [工作着装: 女仆主题]）。
   */
  customRequirements?: INormalizedCustomIntent;
  /**
   * 引信自适应升级标记（阶段3 PROXIMITY_ENHANCED 投影）：true 时渲染
   * 强化安全守护条（强制虚拟号/行程守护/敏感词实时监听）。
   */
  forceArmed?: boolean;
  /** 强化安全守护徽标文案（运行时多因子评分 ≥ 阈值时由上层注入，缺省走常量）。 */
  safetyBadge?: string;
}

/** 场景 → 主题微色元数据（5.7 维度 1 的 Token 投影）。 */
export const SCENARIO_THEME_META: Record<
  CockpitScenario,
  { themeClass: string; accent: string; label: string }
> = {
  housekeeping: { themeClass: "theme-housekeeping", accent: "#3884ff", label: "清洁蓝 · 重入户" },
  meetup: { themeClass: "theme-meetup", accent: "#f97316", label: "活力橙 · 轻履约" },
  companion: { themeClass: "theme-companion", accent: "#a78bfa", label: "夜幕紫 · 高人身风险" },
  dynamic: { themeClass: "theme-dynamic", accent: "#00f0ff", label: "自适应 · 长尾动态弹药" },
};

/**
 * D-8 视口主题作用域键解析：`data-theme` 只携带弹药主题令牌键
 * （housekeeping/meetup/companion/tech/default——对应 globals.css 5 大主题作用域）。
 * 制式场景直映主题键；dynamic 场景按弹药 `holographic.theme` 精准挂载，
 * 未传弹药 / 未声明 / 未知主题 → 安全回落 default（红线 6 + 兜底不白屏）。
 */
export function resolveCockpitTheme(
  scenario: CockpitScenario,
  ammo?: IAmmoDefinition,
): ScenarioTheme {
  switch (scenario) {
    case "housekeeping":
      return "housekeeping";
    case "meetup":
      return "meetup";
    case "companion":
      return "companion";
    case "dynamic":
      return normalizeAmmoTheme(ammo?.holographic?.theme);
  }
}

const COCKPIT_CSS = `
.cockpit{max-width:460px;border-radius:22px;padding:14px;color:#e2e8f0;font-size:13px;
  display:flex;flex-direction:column;gap:12px}
.cockpit-capsule{display:flex;justify-content:center}
.cockpit-theme{font-size:11px;color:#94a3b8;text-align:center}
.cockpit-provider{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.cockpit-avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:22px;background:rgba(255,255,255,.12)}
.cockpit-provider-info{display:flex;flex-direction:column;gap:2px}
.cockpit-trust{display:inline-flex;gap:6px;font-size:11px;color:#94a3b8}
.cockpit-actions{margin-left:auto;display:flex;gap:6px}
.cockpit-pill{padding:5px 10px;border-radius:999px;font-size:11px;font-weight:600;border:1px solid rgba(255,255,255,.18);
  background:rgba(255,255,255,.08);cursor:pointer;color:#cbd5e1}
.cockpit-cta{width:100%;padding:13px 0;border-radius:16px;border:none;font-size:15px;font-weight:800;
  cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--theme-primary),var(--theme-primary-active));
  box-shadow:0 8px 24px var(--theme-glow);transition:transform .15s,filter .15s}
.cockpit-cta:hover{transform:translateY(-1px);filter:brightness(1.1)}
.cockpit-cta:active{transform:scale(.98)}
.cockpit-safety{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:12px;
  font-size:11px;font-weight:600;border:1px solid}
.cockpit-safety-guarded{color:#4ade80;background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.3)}
.cockpit-safety-attention{color:#fbbf24;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.3)}
.cockpit-safety-threat{color:#f87171;background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.4)}
.cockpit-armed{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:14px;
  font-size:12px;font-weight:800;color:#34d399;background:linear-gradient(135deg,rgba(52,211,153,.16),rgba(251,191,36,.12));
  border:1px solid rgba(52,211,153,.45);box-shadow:0 0 18px rgba(52,211,153,.18)}
.cockpit-custom{display:flex;flex-wrap:wrap;gap:6px}
.cockpit-custom-tag{font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;
  background:rgba(123,97,255,.14);border:1px solid rgba(123,97,255,.4);color:#c4b5fd}
`;

/** 六维信用雷达预览（trustScore 拆分展示）。 */
export function sixDimensionScores(trustScore: number): { label: string; value: number }[] {
  const dims = ["守时", "专业", "礼貌", "沟通", "诚信", "复购"];
  return dims.map((label, i) => {
    const jitter = ((i * 7) % 5) - 2;
    const value = Math.max(0, Math.min(100, trustScore + jitter));
    return { label, value };
  });
}

/** 底部核销 CTA 文案（5.7 维度 5：场景特化完工动作）。 */
export function describeCompletionCta(scenario: CockpitScenario): string {
  switch (scenario) {
    case "housekeeping":
      return "🤝 双方碰一碰 NFC · 验收清单打钩";
    case "meetup":
      return "🛡️ 组织者点选到场成员 · 解冻定金";
    case "companion":
      return "📡 300m 脱离自动完成 · 或手动确认";
    case "dynamic":
      return "✳️ 按弹药契约核销 · 或手动确认";
  }
}

/** S3 SAFE_MONITOR 安全徽标元数据（安全守护状态 → 文案/类名/图标）。 */
export const SAFETY_PILL_META = {
  GUARDED: { label: "🛡️ 安全守护中 · 全维度零威胁", className: "cockpit-safety-guarded" },
  ATTENTION: { label: "⚠️ 安全守护 · 有告警待确认", className: "cockpit-safety-attention" },
  THREAT: { label: "🚨 安全守护 · 威胁已联动风控", className: "cockpit-safety-threat" },
} as const;

/** 阶段4 强化守护徽标默认文案（上层未注入 safetyBadge 时兜底）。 */
export const ENHANCED_SAFETY_BADGE_DEFAULT = "🛡️ 强化安全守护中（虚拟号通话 + 全程行程守护 + 敏感词实时监听）";

/** 定制着装类型 → 中性标签（结构化投影，杜绝原始粗糙词直显）。 */
export const DRESS_CODE_TYPE_LABEL: Record<IDressCodeType, string> = {
  THEMED_MAID: "女仆主题",
  THEMED_COSPLAY: "角色扮演/制服",
  FORMAL_UNIFORM: "正装/礼服",
  CUSTOM: "指定着装",
};

/** 定制契约 → 中性化标签列表（纯函数，供测试直接断言）。 */
export function describeCustomRequirementTags(
  custom?: INormalizedCustomIntent,
): string[] {
  if (!custom) return [];
  const tags: string[] = [];
  if (custom.dressCode?.required && custom.dressCode.type) {
    tags.push(`[工作着装: ${DRESS_CODE_TYPE_LABEL[custom.dressCode.type]}]`);
  }
  if (custom.ageRange) {
    tags.push(`[期望年龄: ${custom.ageRange[0]}-${custom.ageRange[1]}岁]`);
  }
  if (custom.genderPreference && custom.genderPreference !== "ANY") {
    tags.push(`[性别偏好: ${custom.genderPreference === "FEMALE" ? "女性" : "男性"}]`);
  }
  return tags;
}

/** 安全报告 → 徽标元数据投影（纯函数，供测试直接断言）。 */
export function describeSafetyPill(
  report: IRuntimeSafetyReport,
): { label: string; className: string; status: "GUARDED" | "ATTENTION" | "THREAT" } {
  const meta = SAFETY_PILL_META[report.securityPillStatus];
  return { ...meta, status: report.securityPillStatus };
}

/** 通用五态履约主屏：外骨骼顶栏 + 服务者卡 + 场景插槽 + 核销 CTA。 */
export default function FulfillmentCockpit({
  status,
  scenario,
  capsule,
  provider,
  housekeeping,
  meetup,
  companion,
  dynamic,
  ammo,
  onTriggerFakeCall,
  onAcceptQuote,
  onConfirmSplit,
  onDial,
  onChat,
  onComplete,
  safetyReport,
  housekeepingCap,
  customRequirements,
  forceArmed,
  safetyBadge,
}: FulfillmentCockpitProps) {
  const theme = SCENARIO_THEME_META[scenario];
  const cockpitTheme = resolveCockpitTheme(scenario, ammo);
  const cta = describeCompletionCta(scenario);
  const safetyPill = safetyReport ? describeSafetyPill(safetyReport) : null;
  const armed = forceArmed === true;
  const customTags = describeCustomRequirementTags(customRequirements);
  const customCleanText = customRequirements?.cleanText ?? "";

  return (
    <div className="cockpit" data-scenario={scenario} data-theme={cockpitTheme}>
      <style>{COCKPIT_CSS}</style>
      <div className="cockpit-capsule">
        <StatusCapsule status={status} options={capsule} />
      </div>

      <div className="cockpit-theme" data-theme-label>
        🎨 场景主题 · {theme.label}
      </div>

      {/* 阶段4：引信自适应升级（PROXIMITY_ENHANCED）→ 强化安全守护条 */}
      {armed && (
        <section
          className="cockpit-armed"
          data-force-armed="true"
          data-testid="cockpit-armed-banner"
        >
          {safetyBadge ?? ENHANCED_SAFETY_BADGE_DEFAULT}
          <span style={{ opacity: 0.7, fontSize: 10.5, fontWeight: 600 }}>
            虚拟号 · 行程守护 · 敏感词监听 已强制开启
          </span>
        </section>
      )}

      {safetyPill && (
        <section
          className={`cockpit-safety ${safetyPill.className}`}
          data-safety={safetyReport?.securityPillStatus}
          data-safety-count={safetyReport?.activeThreats.length ?? 0}
        >
          {safetyPill.label}
          {safetyReport && safetyReport.activeThreats.length > 0 && (
            <span style={{ opacity: 0.75 }}>
              · {safetyReport.activeThreats.join(" / ")}
            </span>
          )}
        </section>
      )}

      {/* 阶段4：定制需求标签栏（仅渲染清洗后的中性化契约，杜绝原始粗糙词直显） */}
      {(customTags.length > 0 || customCleanText) && (
        <section className="cockpit-custom" data-testid="cockpit-custom-requirements" data-custom-requirements>
          {customTags.map((tag) => (
            <span key={tag} className="cockpit-custom-tag" data-custom-tag>
              {tag}
            </span>
          ))}
          {customCleanText && !customTags.some((t) => t.includes("工作着装")) && (
            <span className="cockpit-custom-tag" data-custom-tag data-clean-text>
              {customCleanText}
            </span>
          )}
        </section>
      )}

      <section className="cockpit-provider">
        <span className="cockpit-avatar">{provider.avatar}</span>
        <div className="cockpit-provider-info">
          <strong>
            {provider.name}
            {provider.verified && <span style={{ color: "#38bdf8", marginLeft: 4 }}>✓ 实名</span>}
          </strong>
          <span className="cockpit-trust">
            信用 {provider.trustScore} 分
            {sixDimensionScores(provider.trustScore).map((d) => (
              <span key={d.label} title={`${d.label} ${d.value}`}>
                {d.label} {d.value}
              </span>
            ))}
          </span>
        </div>
        <div className="cockpit-actions">
          <button type="button" className="cockpit-pill" aria-label="一键虚拟通话" data-action="dial" onClick={onDial}>
            📞
          </button>
          <button type="button" className="cockpit-pill" aria-label="隐私聊天" data-action="chat" onClick={onChat}>
            💬
          </button>
        </div>
      </section>

      {scenario === "housekeeping" && (
        <HousekeepingSlot
          quote={housekeeping?.quote}
          photos={housekeeping?.photos}
          onAcceptQuote={onAcceptQuote ?? housekeeping?.onAcceptQuote}
          onRejectQuote={housekeeping?.onRejectQuote}
          onClaimDamage={housekeeping?.onClaimDamage}
          baseAmountYuan={housekeepingCap?.baseAmountYuan ?? 0}
          maxSurchargeRatio={housekeepingCap?.maxSurchargeRatio ?? 0.5}
          customRequirements={customRequirements}
        />
      )}
      {scenario === "meetup" && (
        <MeetupSlot
          seats={meetup?.seats ?? []}
          fenceMeters={meetup?.fenceMeters}
          onScanArrival={meetup?.onScanArrival}
          split={meetup?.split}
          onConfirmSplit={onConfirmSplit ?? meetup?.onConfirmSplit}
          onDisputeNoShow={meetup?.onDisputeNoShow}
        />
      )}
      {scenario === "companion" && (
        <CompanionSlot
          isPrivacyShieldArmed={companion?.isPrivacyShieldArmed ?? true}
          departureDistanceMeters={companion?.departureDistanceMeters}
          onTriggerFakeCall={companion?.onTriggerFakeCall ?? onTriggerFakeCall}
          onBlockUser={companion?.onBlockUser}
        />
      )}
      {scenario === "dynamic" && dynamic && (
        <DynamicAmmoSlot {...dynamic} customRequirements={customRequirements} />
      )}

      <button
        type="button"
        className="cockpit-cta"
        data-action="complete"
        onClick={onComplete}
      >
        {cta}
      </button>
    </div>
  );
}
