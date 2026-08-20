"use client";

/**
 * 同城陪玩特化插槽（Companion Slot · 夜幕紫 theme-companion）。
 *
 * 白皮书 §五 5.7 对比矩阵 · 陪玩列（高人身风险）：
 * - 履约核心：隐私防骚扰盾（虚拟号保护 + 实时行程守护，PROXIMITY 引信 privacy/sos 投影）；
 * - 核销完工：300m 安全距离脱离自动停表（departureDistanceMeters，默认 300m）；
 * - 争议售后：📱 伪装假电话一键脱身（IStealthCalculator 同源掩护哲学）+ 敏感词一键拉黑。
 * 契约：`ICompanionSlotProps`（src/types/ui-viewport.ts）。
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

const SLOT_CSS = `
.cp-slot{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;
  background:linear-gradient(135deg,rgba(167,139,250,.16),rgba(167,139,250,.05));
  border:1px solid rgba(167,139,250,.32);color:#e2e8f0;font-size:14px;line-height:1.5}
.cp-slot h4{margin:0 0 6px;font-size:15px;font-weight:600;color:#c4b5fd}
.cp-shield{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-radius:12px;
  background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);font-weight:500}
.cp-shield-armed{color:#4ade80;font-size:13px;font-weight:600}
.cp-fakecall{width:100%;padding:11px 0;border-radius:14px;border:none;font-size:15px;font-weight:800;
  cursor:pointer;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;
  box-shadow:0 6px 20px rgba(124,58,237,.4)}
.cp-fakecall:active{transform:scale(.98)}
.cp-distance{display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-radius:12px;
  background:rgba(255,255,255,.06);border:1px dashed rgba(167,139,250,.4);font-weight:500}
.cp-block{width:100%;padding:9px 0;border-radius:12px;border:1px solid rgba(239,68,68,.45);
  background:rgba(239,68,68,.1);color:#fca5a5;font-size:14px;font-weight:700;cursor:pointer}
`;

/** 同城陪玩插槽：隐私盾 + 伪装假电话 + 300m 距离指示 + 一键拉黑。 */
export default function CompanionSlot({
  isPrivacyShieldArmed,
  onTriggerFakeCall,
  departureDistanceMeters = 300,
  onBlockUser,
}: CompanionSlotProps) {
  return (
    <div className="cp-slot" data-slot="companion">
      <style>{SLOT_CSS}</style>
      <div className="cp-shield">
        <span>🛡️ 隐私防骚扰盾</span>
        <span className="cp-shield-armed">
          {isPrivacyShieldArmed ? "虚拟号保护中 · 行程守护" : "未武装 ⚠️"}
        </span>
      </div>
      {onTriggerFakeCall && (
        <button
          type="button"
          className="cp-fakecall"
          data-action="fake-call"
          onClick={onTriggerFakeCall}
        >
          📱 伪装假电话 · 紧急脱身
        </button>
      )}
      <div className="cp-distance">
        <span>📡 安全距离 {departureDistanceMeters}m</span>
        <span style={{ color: "#cbd5e1" }}>超出自动停表/结账</span>
      </div>
      {onBlockUser && (
        <button type="button" className="cp-block" data-action="block-user" onClick={onBlockUser}>
          🚫 敏感词一键拉黑
        </button>
      )}
    </div>
  );
}
