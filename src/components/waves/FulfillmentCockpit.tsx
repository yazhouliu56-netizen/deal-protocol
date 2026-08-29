"use client";

import type {
  AtomicFiveState,
  INormalizedCustomIntent,
  IDressCodeType,
  IAmmoDefinition,
} from "@/types/ammo-schema";
import StatusCapsule from "@/components/oto-ui/StatusCapsule";
import { CockpitAmmoSlot, type CockpitSlotActions } from "./slots/DynamicAmmoSlot";
import { useEffect, useState } from "react";
import DuoButton from "@/components/ui/DuoButton";
import DuoProgress from "@/components/ui/DuoProgress";
import DuoPathNode from "@/components/ui/DuoPathNode";
import { playDuoSound } from "@/lib/duo-audio";
import { fireDuoConfetti } from "@/lib/duo-confetti";
import { useMountedNow } from "@/lib/use-mounted-now";
import SettlementLootModal from "./_components/SettlementLootModal";
import {
  SCENARIO_THEME_META,
  describeCompletionCta,
  resolveCockpitTheme,
  scenarioFromAmmo,
} from "./slots/cockpit-scenario";
import type { IRuntimeSafetyReport } from "@/base/safe/runtime-monitor";
import MilestoneLadder, { type MilestoneLadderInput } from "./MilestoneLadder";

/**
 * 通用五态履约主屏（Universal Fulfillment Cockpit · 白皮书 §五 5.6.2）。
 *
 * 三区组装：
 * 1. 外骨骼顶栏 —— StatusCapsule（五态进度 + LBS 距离 + 离线徽标 + SOS 按钮）；
 * 2. 服务者通用卡片 —— 头像 / 实名 / 六维信用分（trustScore）/ 一键虚拟通话与隐私聊天；
 * 3. 动态视口插槽区 —— CockpitAmmoSlot 唯一装配入口：按弹药 D9 行动 Schema
 *    动态装配预置模板皮肤（官方标杆弹）或通用六模块宿主（长尾动态弹），
 *    零品类硬编码分支（战役 4 · 场景联合类型与分叉 Props 已物理消灭）；
 * 4. 底部物理核销 CTA —— 文案由场景派生纯函数给出。
 *
 * 主题微色（白皮书 5.7 维度 1）：由弹药 holographic.theme 经场景元数据投影。
 */

export type { CockpitScenario } from "./slots/cockpit-scenario";
export {
  SCENARIO_THEME_META,
  describeCompletionCta,
  resolveCockpitTheme,
} from "./slots/cockpit-scenario";

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
  /**
   * 当前弹药整弹（座舱唯一数据源）：主题微色、场景派生、插槽装配全部
   * 由其 D9 行动 Schema 与全息声明驱动（战役 4 · 零品类硬编码）。
   */
  ammo: IAmmoDefinition;
  /** 外骨骼顶栏选项（透传 StatusCapsule）。 */
  capsule?: { isOffline?: boolean; distanceMeters?: number; onSosClick?: () => void };
  /** 服务者通用卡片数据。 */
  provider: CockpitProvider;
  /** 插槽行动载荷全集（六原子模块数据与回调，由装配中心按弹药声明供给）。 */
  actions?: CockpitSlotActions;
  /** P0 接电：服务者卡通讯按钮真实回调（一键虚拟通话 / 隐私聊天）。 */
  onDial?: () => void;
  onChat?: () => void;
  /** 底部物理核销 CTA。 */
  onComplete?: () => void;
  /** S3 SAFE_MONITOR 实时安全报告（缺省 = 不渲染安全守护徽标）。 */
  safetyReport?: IRuntimeSafetyReport;
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
  /**
   * 方向 1 接线 C：分期托管里程碑声明（协议 funding.mode=milestone_staged 时由
   * 上层从弹药/协议配置投影传入；缺省不渲染阶梯）。状态与金额由
   * base/money/milestone-escrow 纯函数驱动（红线 1）。
   */
  milestones?: {
    totalAmountYuan: number;
    items: MilestoneLadderInput[];
    defaultTimeoutHours?: number;
  };
  /** 完工礼遇：用于确定性礼遇派生的 waveId（缺省回落 ammo.ammoId）。 */
  waveId?: string;
}

const COCKPIT_CSS = `
.cockpit{max-width:460px;border-radius:22px;padding:14px;color:#e2e8f0;font-size:14px;
  display:flex;flex-direction:column;gap:12px;line-height:1.5}
.cockpit-capsule{display:flex;justify-content:center}
.cockpit-theme{font-size:12px;color:rgba(255,255,255,.68);text-align:center;font-weight:500}
.cockpit-provider{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:16px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12)}
.cockpit-provider-info strong{font-size:15px;font-weight:700;color:#f1f5f9}
.cockpit-avatar{width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-size:22px;background:rgba(255,255,255,.12)}
.cockpit-provider-info{display:flex;flex-direction:column;gap:2px}
.cockpit-trust{display:inline-flex;gap:6px;font-size:12px;color:#cbd5e1;font-weight:500}
.cockpit-actions{margin-left:auto;display:flex;gap:6px}
.cockpit-pill{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid rgba(255,255,255,.18);
  background:rgba(255,255,255,.08);cursor:pointer;color:#e2e8f0}
.cockpit-cta{width:100%;padding:13px 0;border-radius:16px;border:none;font-size:16px;font-weight:800;
  cursor:pointer;color:#fff;background:linear-gradient(135deg,var(--theme-primary),var(--theme-primary-active));
  box-shadow:0 8px 24px var(--theme-glow);transition:transform .15s,filter .15s}
.cockpit-cta:hover{transform:translateY(-1px);filter:brightness(1.1)}
.cockpit-cta:active{transform:scale(.98)}
.cockpit-safety{display:flex;align-items:center;gap:6px;padding:7px 11px;border-radius:12px;
  font-size:12px;font-weight:600;border:1px solid;line-height:1.5}
.cockpit-safety-guarded{color:#4ade80;background:rgba(74,222,128,.08);border-color:rgba(74,222,128,.3)}
.cockpit-safety-attention{color:#fbbf24;background:rgba(251,191,36,.08);border-color:rgba(251,191,36,.3)}
.cockpit-safety-threat{color:#f87171;background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.4)}
.cockpit-armed{display:flex;flex-direction:column;gap:4px;align-items:flex-start;padding:9px 12px;border-radius:14px;
  font-size:13px;font-weight:800;color:#34d399;background:linear-gradient(135deg,rgba(52,211,153,.16),rgba(251,191,36,.12));
  border:1px solid rgba(52,211,153,.45);box-shadow:0 0 18px rgba(52,211,153,.18);line-height:1.5}
.cockpit-custom{display:flex;flex-wrap:wrap;gap:6px}
.cockpit-custom-tag{font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;
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

/** 通用五态履约主屏：外骨骼顶栏 + 服务者卡 + 弹药驱动插槽 + 核销 CTA。 */
export default function FulfillmentCockpit({
  status,
  ammo,
  capsule,
  provider,
  actions,
  onDial,
  onChat,
  onComplete,
  safetyReport,
  customRequirements,
  forceArmed,
  safetyBadge,
  milestones,
  waveId,
}: FulfillmentCockpitProps) {
  const scenario = scenarioFromAmmo(ammo);
  const theme = SCENARIO_THEME_META[scenario];
  const cockpitTheme = resolveCockpitTheme(scenario, ammo);
  const cta = describeCompletionCta(scenario);
  const safetyPill = safetyReport ? describeSafetyPill(safetyReport) : null;
  const armed = forceArmed === true;
  const customTags = describeCustomRequirementTags(customRequirements);
  const customCleanText = customRequirements?.cleanText ?? "";
  const mounted = useMountedNow();
  const totalAmount = milestones?.totalAmountYuan ?? 0;
  const [lootOpen, setLootOpen] = useState(false);
  const lootWaveId = waveId ?? ammo.ammoId ?? "default";
  // Microkernel 4.4：仅在 SETTLED 终态自动弹出礼遇（避免在履约中途遮挡 NFC 等关键操作）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (status === "SETTLED") setLootOpen(true);
  }, [status]);

  return (
    <div className="cockpit" data-scenario={scenario} data-theme={cockpitTheme}>
      <style>{COCKPIT_CSS}</style>
      <div className="cockpit-capsule">
        <StatusCapsule status={status} options={capsule} />
      </div>

      <div className="cockpit-theme" data-theme-label>
        🎨 场景主题 · {theme.label}
      </div>

      {/* Phase 1.3 Feather：天蓝资金守护盾 + 糖果进度 + 通关地图 */}
      {totalAmount > 0 && (
        <section
          data-testid="cockpit-asset-shield"
          className="rounded-2xl bg-[#ddf4ff] border border-[#1cb0f6] border-b-[4px] px-4 py-3 text-sm font-bold text-slate-700 shadow-sm"
        >
          💼 Deal 官方资金全额托管中 · ¥{totalAmount} (未完工不放款 🛡️)
        </section>
      )}
      {mounted && milestones && milestones.items.length > 0 && (
        <section data-testid="cockpit-sla-progress">
          <DuoProgress value={60} max={100} />
        </section>
      )}
      <section data-testid="cockpit-path" className="flex items-center justify-between gap-2">
        <DuoPathNode status="completed" step={1} title="已接单" />
        <DuoPathNode status="current" step={2} title="履约中" offsetX={-2} />
        <DuoPathNode status="locked" step={3} title="待验收" offsetX={2} />
      </section>

      {/* 阶段4：引信自适应升级（PROXIMITY_ENHANCED）→ 强化安全守护条 */}
      {armed && (
        <section
          className="cockpit-armed"
          data-force-armed="true"
          data-testid="cockpit-armed-banner"
        >
          {safetyBadge ?? ENHANCED_SAFETY_BADGE_DEFAULT}
          <span style={{ opacity: 0.85, fontSize: 12, fontWeight: 600 }}>
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

      {/* 战役 4 · 弹药驱动插槽区：D9 行动 Schema 唯一装配入口（零品类分支） */}
      <CockpitAmmoSlot
        ammo={ammo}
        actions={{ ...actions, customRequirements }}
      />

      {/* 方向 1 接线 C：分期托管里程碑阶梯（milestone_staged 协议时渲染） */}
      {milestones && milestones.items.length > 0 && (
        <MilestoneLadder
          totalAmountYuan={milestones.totalAmountYuan}
          milestones={milestones.items}
          defaultTimeoutHours={milestones.defaultTimeoutHours}
        />
      )}

      <DuoButton
        variant="primary"
        size="lg"
        sound="correct"
        fullWidth
        data-action="complete"
        data-testid="complete-cta"
        onClick={() => {
          try {
            playDuoSound("correct");
          } catch {}
          try {
            fireDuoConfetti();
          } catch {}
          onComplete?.();
        }}
        className="rounded-2xl"
      >
        {cta}
      </DuoButton>
      {/* Microkernel 4.4：完工礼遇宝箱（仅 SETTLED 终态触发，确定性礼遇，0随机；测试态可穿透） */}
      <SettlementLootModal waveId={lootWaveId} open={lootOpen} onClose={() => setLootOpen(false)} />
    </div>
  );
}
