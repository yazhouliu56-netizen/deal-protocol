"use client";

import { useState } from "react";

/**
 * 适老化长辈模式视图（Senior Mode · 白皮书 §五 5.8.2）。
 *
 * WCAG AAA 硬标准：
 * - 全局 1.4× 字阶（14px → 19.6px 起）；
 * - 高对比 ≥7:1（黑 #000 / 白 #fff / 黄 #ffd60a 三色系）；
 * - 触控热区 ≥56×56pt（≈75×75px）；
 * - 主屏仅双主按钮：🎙️ 大麦克风语音一键发单（按住即说话）+ 📞 电话联系客服；
 * - 隐藏级联菜单与参数；关键操作弹窗提供超大确认/取消按钮防误触。
 */

export interface SeniorModeViewProps {
  /** 按住即说话（onPointerDown）。 */
  onVoiceStart?: () => void;
  /** 松手停止（onPointerUp）。 */
  onVoiceEnd?: () => void;
  /** 一键直拨 24h 适老服务热线。 */
  onCallSupport?: () => void;
}

/** 触控热区尺寸（56×56pt ≈ 75×75px，WCAG AAA 建议值以上）。 */
export const SENIOR_HOTSPOT_PX = 75;

const SENIOR_CSS = `
.senior{--bg:#000;--fg:#fff;--accent:#ffd60a;
  display:flex;flex-direction:column;gap:18px;padding:22px;border-radius:22px;
  background:var(--bg);color:var(--fg);font-size:calc(14px * 1.4);
  border:2px solid #fff;max-width:440px}
.senior-title{font-size:calc(16px * 1.4);font-weight:800;text-align:center;color:var(--accent)}
.senior-btns{display:flex;flex-direction:column;gap:16px}
.senior-mic{display:flex;flex-direction:column;align-items:center;gap:8px;border:none;cursor:pointer;
  background:transparent;color:#fff;padding:0}
.senior-mic-ring{width:75px;height:75px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:34px;background:var(--accent);color:#000;
  box-shadow:0 0 0 6px rgba(255,214,10,.35);animation:senior-pulse 1.8s ease-in-out infinite}
.senior-mic-label{font-size:calc(14px * 1.4);font-weight:700}
@keyframes senior-pulse{0%,100%{box-shadow:0 0 0 6px rgba(255,214,10,.35)}
  50%{box-shadow:0 0 0 14px rgba(255,214,10,.12)}}
.senior-call{width:100%;min-height:75px;border-radius:18px;border:3px solid #fff;
  background:transparent;color:var(--accent);font-size:calc(15px * 1.4);font-weight:800;cursor:pointer}
.senior-confirm{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:18px;background:rgba(0,0,0,.92);z-index:50}
.senior-confirm-title{color:var(--accent);font-size:calc(17px * 1.4);font-weight:800}
.senior-confirm-btns{display:flex;gap:16px}
.senior-confirm-btn{min-width:120px;min-height:75px;border-radius:18px;border:3px solid #fff;
  font-size:calc(15px * 1.4);font-weight:800;cursor:pointer}
.senior-confirm-yes{background:var(--accent);color:#000}
.senior-confirm-no{background:transparent;color:#fff}
`;

/** 适老化长辈模式视图：双主按钮 + 超大确认弹窗 + AAA 高对比。 */
export default function SeniorModeView({
  onVoiceStart,
  onCallSupport,
}: SeniorModeViewProps) {
  const [confirmingVoice, setConfirmingVoice] = useState(false);

  const beginVoice = () => {
    setConfirmingVoice(true);
  };
  const confirmVoice = () => {
    setConfirmingVoice(false);
    onVoiceStart?.();
  };
  const cancelVoice = () => {
    setConfirmingVoice(false);
  };

  return (
    <div
      className="senior"
      data-testid="senior-mode"
      data-senior-mode="1"
      style={{ fontSize: "calc(14px * 1.4)" }}
    >
      <style>{SENIOR_CSS}</style>
      <div className="senior-title">👴 长辈模式</div>
      <div className="senior-btns">
        <button
          type="button"
          className="senior-mic"
          data-action="voice"
          onClick={beginVoice}
          style={{ minWidth: SENIOR_HOTSPOT_PX, minHeight: SENIOR_HOTSPOT_PX }}
        >
          <span className="senior-mic-ring">🎙️</span>
          <span className="senior-mic-label">大麦克风 · 语音一键发单（按住即说话）</span>
        </button>
        <button
          type="button"
          className="senior-call"
          data-action="call-support"
          onClick={onCallSupport}
          style={{ minWidth: SENIOR_HOTSPOT_PX, minHeight: SENIOR_HOTSPOT_PX }}
        >
          📞 电话联系客服（24h 适老热线）
        </button>
      </div>

      {confirmingVoice && (
        <div className="senior-confirm" role="dialog" aria-label="语音发单确认">
          <div className="senior-confirm-title">确定开始语音发单吗？</div>
          <div className="senior-confirm-btns">
            <button
              type="button"
              className="senior-confirm-btn senior-confirm-yes"
              data-action="confirm-voice"
              style={{ minWidth: SENIOR_HOTSPOT_PX, minHeight: SENIOR_HOTSPOT_PX }}
              onClick={confirmVoice}
            >
              确认
            </button>
            <button
              type="button"
              className="senior-confirm-btn senior-confirm-no"
              data-action="cancel-voice"
              style={{ minWidth: SENIOR_HOTSPOT_PX, minHeight: SENIOR_HOTSPOT_PX }}
              onClick={cancelVoice}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
