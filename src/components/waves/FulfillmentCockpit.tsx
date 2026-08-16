"use client";

import type { AtomicFiveState } from "@/types/ammo-schema";
import StatusCapsule from "@/components/oto-ui/StatusCapsule";
import HousekeepingSlot, { type HousekeepingSlotProps } from "./slots/HousekeepingSlot";
import MeetupSlot, { type MeetupSlotProps } from "./slots/MeetupSlot";
import CompanionSlot, { type CompanionSlotProps } from "./slots/CompanionSlot";
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

export type CockpitScenario = "housekeeping" | "meetup" | "companion";

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
}

/** 场景 → 主题微色元数据（5.7 维度 1 的 Token 投影）。 */
export const SCENARIO_THEME_META: Record<
  CockpitScenario,
  { themeClass: string; accent: string; label: string }
> = {
  housekeeping: { themeClass: "theme-housekeeping", accent: "#3884ff", label: "清洁蓝 · 重入户" },
  meetup: { themeClass: "theme-meetup", accent: "#f97316", label: "活力橙 · 轻履约" },
  companion: { themeClass: "theme-companion", accent: "#a78bfa", label: "夜幕紫 · 高人身风险" },
};

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
  cursor:pointer;color:#05060f;transition:transform .15s,filter .15s}
.cockpit-cta:hover{transform:translateY(-1px);filter:brightness(1.1)}
.cockpit-cta:active{transform:scale(.98)}
.cockpit-safety{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:12px;
  font-size:11px;font-weight:600;border:1px solid}
.cockpit-safety-guarded{color:#4ade80;background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.3)}
.cockpit-safety-attention{color:#fbbf24;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.3)}
.cockpit-safety-threat{color:#f87171;background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.4)}
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
  }
}

/** S3 SAFE_MONITOR 安全徽标元数据（安全守护状态 → 文案/类名/图标）。 */
export const SAFETY_PILL_META = {
  GUARDED: { label: "🛡️ 安全守护中 · 全维度零威胁", className: "cockpit-safety-guarded" },
  ATTENTION: { label: "⚠️ 安全守护 · 有告警待确认", className: "cockpit-safety-attention" },
  THREAT: { label: "🚨 安全守护 · 威胁已联动风控", className: "cockpit-safety-threat" },
} as const;

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
  onTriggerFakeCall,
  onAcceptQuote,
  onConfirmSplit,
  onDial,
  onChat,
  onComplete,
  safetyReport,
  housekeepingCap,
}: FulfillmentCockpitProps) {
  const theme = SCENARIO_THEME_META[scenario];
  const cta = describeCompletionCta(scenario);
  const safetyPill = safetyReport ? describeSafetyPill(safetyReport) : null;

  return (
    <div className="cockpit" data-scenario={scenario} data-theme={theme.themeClass}>
      <style>{COCKPIT_CSS}</style>
      <div className="cockpit-capsule">
        <StatusCapsule status={status} options={capsule} />
      </div>

      <div className="cockpit-theme" data-theme-label>
        🎨 场景主题 · {theme.label}
      </div>

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

      <button
        type="button"
        className="cockpit-cta"
        data-action="complete"
        style={{ background: `linear-gradient(135deg, ${theme.accent}, #7b61ff)` }}
        onClick={onComplete}
      >
        {cta}
      </button>
    </div>
  );
}
