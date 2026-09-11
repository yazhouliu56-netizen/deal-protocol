"use client";

import DuoButton from "@/components/ui/DuoButton";
import DuoCardShell from "@/components/ui/DuoCardShell";
import DuoPill from "@/components/ui/DuoPill";

/**
 * 同城陪玩特化插槽（Companion Slot · 夜幕紫 theme-companion）。
 *
 * 白皮书 §五 5.7 对比矩阵 · 陪玩列（高人身风险）：
 * - 履约核心：隐私防骚扰盾（虚拟号保护 + 实时行程守护，PROXIMITY 引信 privacy/sos 投影）；
 * - 核销完工：300m 安全距离脱离自动停表（departureDistanceMeters，默认 300m）；
 * - 争议售后：📱 伪装假电话一键脱身（IStealthCalculator 同源掩护哲学）+ 敏感词一键拉黑。
 * 契约：`ICompanionSlotProps`（src/types/ui-viewport.ts）。
 *
 * Duo 化（Batch①首发 2026-09）：夜幕紫暗岛 `<style>` 去除，白底 DuoCardShell +
 * DuoButton/DuoPill；场景身份由父级 data-theme="companion" 承载，卡片本身纯 Duo。
 * 主行动收敛 Duo primary（对比度裁决 neutral-900），拉黑收敛 danger。
 * 契约与埋点不变：data-slot="companion" / data-action fake-call/block-user。
 */

export interface CompanionSlotProps {
  /** 隐私盾武装状态（虚拟号保护中 + 实时行程守护）。 */
  isPrivacyShieldArmed: boolean;
  /** 📱 伪装假电话一键触发（紧急脱身假来电弹层）。 */
  onTriggerFakeCall?: () => void;
  /** 离开安全距离（米），默认 300m。 */
  departureDistanceMeters?: number;
  /** 敏感词一键拉黑（争议售后入口）。 */
  onBlockUser?: () => void;
}

/** 同城陪玩插槽：隐私盾 + 伪装假电话 + 300m 距离指示 + 一键拉黑。 */
export default function CompanionSlot({
  isPrivacyShieldArmed,
  onTriggerFakeCall,
  departureDistanceMeters = 300,
  onBlockUser,
}: CompanionSlotProps) {
  return (
    <DuoCardShell
      className="p-3.5 space-y-2.5"
      dataAttrs={{ "data-slot": "companion" }}
    >
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] px-3 py-2">
        <span className="text-sm font-extrabold text-[var(--color-duo-eel)]">
          🛡️ 隐私防骚扰盾
        </span>
        <DuoPill
          tone={isPrivacyShieldArmed ? "green" : "yellow"}
          variant="solid"
          className="shrink-0 whitespace-nowrap text-xs"
        >
          {isPrivacyShieldArmed ? "虚拟号保护中 · 行程守护" : "未武装 ⚠️"}
        </DuoPill>
      </div>
      {onTriggerFakeCall && (
        <DuoButton
          variant="primary"
          fullWidth
          data-action="fake-call"
          onClick={onTriggerFakeCall}
        >
          📱 伪装假电话 · 紧急脱身
        </DuoButton>
      )}
      <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-[var(--color-duo-swan)] px-3 py-2">
        <span className="text-sm font-bold text-[var(--color-duo-eel)]">
          📡 安全距离 {departureDistanceMeters}m
        </span>
        <span className="text-xs text-[var(--color-duo-wolf)]">超出自动停表/结账</span>
      </div>
      {onBlockUser && (
        <DuoButton
          variant="danger"
          fullWidth
          data-action="block-user"
          onClick={onBlockUser}
        >
          🚫 敏感词一键拉黑
        </DuoButton>
      )}
    </DuoCardShell>
  );
}
