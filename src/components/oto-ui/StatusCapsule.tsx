"use client";

import type { AtomicFiveState } from "@/types/ammo-schema";

/**
 * 顶部五态灵动状态胶囊（Top Status Capsule · 外骨骼层首件）。
 *
 * 白皮书 §五 5.4.2 法则二：五态灵动胶囊——状态机 `toAtomicFiveState`
 * 直接投影为顶部常驻呼吸胶囊，打消履约不确定感（跨品类 0 学习成本）。
 *
 * 职责：
 * - 五态自适应色彩与微动效（呼吸脉冲点 + 中文标签）；
 * - 右侧集成显性红色 SOS 报警触发按钮（法则五：隐形防御显性锚点）；
 * - 弱网离线告警徽标（宪法 #10：降级是设计的一部分）。
 */

export interface StatusCapsuleOptions {
  /** 弱网离线预警（离线时展示 📴 徽标）。 */
  isOffline?: boolean;
  /** 距服务者距离（米；展示 LBS 指示，如「距服务者 500m」）。 */
  distanceMeters?: number;
  /** SOS 触发回调（未提供则按钮仅展示可点态）。 */
  onSosClick?: () => void;
}

export interface StatusCapsuleProps {
  /** 当前五态（由投影桥 toAtomicFiveState 输出）。 */
  status: AtomicFiveState;
  options?: StatusCapsuleOptions;
}

/** 五态视觉元数据（色彩 → 脉冲动画 → 标签）。 */
export const STATUS_CAPSULE_META: Record<
  AtomicFiveState,
  { tone: string; dotColor: string; label: string }
> = {
  PUBLISHED: {
    tone: "status-published",
    dotColor: "#f5c518",
    label: "寻找服务者中...",
  },
  MATCHED: {
    tone: "status-matched",
    dotColor: "#38bdf8",
    label: "服务者已就位",
  },
  IN_SERVICE: {
    tone: "status-in-service",
    dotColor: "#a78bfa",
    label: "履约保护中 · GPS锁定",
  },
  INSPECTED: {
    tone: "status-inspected",
    dotColor: "#fb923c",
    label: "待验收与对账",
  },
  SETTLED: {
    tone: "status-settled",
    dotColor: "#34d399",
    label: "订单已圆满结算",
  },
};

/** 五态 Emoji 标记（视觉速认，对应白皮书色彩语言）。 */
export const STATUS_CAPSULE_EMOJI: Record<AtomicFiveState, string> = {
  PUBLISHED: "🟡",
  MATCHED: "🔵",
  IN_SERVICE: "🟣",
  INSPECTED: "🟠",
  SETTLED: "🟢",
};

const CAPSULE_CSS = `
.status-capsule{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;
  border-radius:999px;background:rgba(15,18,35,.72);border:1px solid rgba(255,255,255,.12);
  backdrop-filter:blur(18px) saturate(160%);font-size:13px;color:#e2e8f0;position:relative}
.status-capsule-dot{width:9px;height:9px;border-radius:50%;animation:status-pulse 1.6s ease-in-out infinite}
@keyframes status-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.35);opacity:.85}
  50%{box-shadow:0 0 0 5px rgba(255,255,255,0);opacity:1}}
.status-capsule-offline{margin-left:6px;display:inline-flex;align-items:center;gap:3px;
  font-size:11px;color:#fbbf24;border:1px solid rgba(251,191,36,.35);border-radius:999px;
  padding:1px 7px;animation:offline-blink 1.2s ease-in-out infinite}
@keyframes offline-blink{0%,100%{opacity:1}50%{opacity:.45}}
.status-capsule-sos{display:inline-flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#b91c1c);
  color:#fff;font-size:11px;font-weight:700;border:1px solid rgba(255,255,255,.35);
  box-shadow:0 0 10px rgba(239,68,68,.55);cursor:pointer;transition:transform .15s}
.status-capsule-sos:hover{transform:scale(1.12)}
.status-capsule-sos:active{transform:scale(.95)}
`;

/** 五态灵动状态胶囊：状态点 + 标签 + 距离指示 + SOS + 离线徽标。 */
export default function StatusCapsule({
  status,
  options,
}: StatusCapsuleProps) {
  const meta = STATUS_CAPSULE_META[status];
  const { isOffline, distanceMeters, onSosClick } = options ?? {};

  return (
    <div className="status-capsule" data-status={status} data-tone={meta.tone}>
      <style>{CAPSULE_CSS}</style>
      <span
        className="status-capsule-dot"
        style={{ backgroundColor: meta.dotColor }}
        aria-hidden="true"
      />
      <span className="status-capsule-emoji" aria-hidden="true">
        {STATUS_CAPSULE_EMOJI[status]}
      </span>
      <span className="status-capsule-label">
        {meta.label}
        {typeof distanceMeters === "number" && distanceMeters >= 0 && (
          <span className="status-capsule-distance" style={{ marginLeft: 6, color: "#94a3b8" }}>
            · 距服务者 {distanceMeters}m
          </span>
        )}
      </span>
      {isOffline && (
        <span className="status-capsule-offline" role="status">
          📴 离线
        </span>
      )}
      <button
        type="button"
        className="status-capsule-sos"
        aria-label="SOS 紧急求助"
        title="一键 SOS 紧急求助"
        onClick={onSosClick}
      >
        SOS
      </button>
    </div>
  );
}
