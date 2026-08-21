"use client";

import { useEffect, useRef, useState } from "react";

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
 * - 灵动 Peek HUD：状态跃迁时自动下拉 3s 浮动提示 + 触觉震动（navigator.vibrate 10ms）。
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

/** Peek HUD 文案（状态跃迁时 3s 浮动提示）。 */
export const STATUS_PEEK_TEXT: Record<AtomicFiveState, string> = {
  PUBLISHED: "🟡 正在寻找服务者 · 广播中",
  MATCHED: "🔵 服务者已接单 · 正在赶往现场",
  IN_SERVICE: "🟣 服务者已到达现场",
  INSPECTED: "🟠 待验收与对账 · 请确认服务结果",
  SETTLED: "🟢 订单已圆满结算 · 资金已分账",
};

const CAPSULE_CSS = `
.status-capsule-wrap{position:relative;display:inline-flex;flex-direction:column;align-items:center}
.status-capsule{display:inline-flex;align-items:center;gap:10px;padding:8px 14px;
  border-radius:999px;background:rgba(15,18,35,.72);border:1px solid rgba(255,255,255,.12);
  backdrop-filter:blur(18px) saturate(160%);font-size:14px;font-weight:500;color:#f1f5f9;position:relative}
.status-capsule-dot{width:9px;height:9px;border-radius:50%;animation:status-pulse 1.6s ease-in-out infinite}
@keyframes status-pulse{0%,100%{box-shadow:0 0 0 0 rgba(255,255,255,.35);opacity:.85}
  50%{box-shadow:0 0 0 5px rgba(255,255,255,0);opacity:1}}
.status-capsule-offline{margin-left:6px;display:inline-flex;align-items:center;gap:3px;
  font-size:12px;font-weight:600;color:#fbbf24;border:1px solid rgba(251,191,36,.35);border-radius:999px;
  padding:2px 8px;animation:offline-blink 1.2s ease-in-out infinite}
@keyframes offline-blink{0%,100%{opacity:1}50%{opacity:.45}}
.status-capsule-sos{display:inline-flex;align-items:center;justify-content:center;
  width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#b91c1c);
  color:#fff;font-size:12px;font-weight:700;border:1px solid rgba(255,255,255,.35);
  box-shadow:0 0 10px rgba(239,68,68,.55);cursor:pointer;transition:transform .15s}
.status-capsule-sos:hover{transform:scale(1.12)}
.status-capsule-sos:active{transform:scale(.95)}
.status-peek{position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);
  display:inline-flex;align-items:center;justify-content:center;
  padding:7px 14px;border-radius:999px;
  background:rgba(15,18,35,.88);border:1px solid rgba(255,255,255,.14);
  backdrop-filter:blur(16px) saturate(160%);font-size:12px;font-weight:700;color:#f1f5f9;
  white-space:nowrap;box-shadow:0 8px 24px rgba(0,0,0,.35),0 0 16px rgba(123,97,255,.25);
  pointer-events:none;will-change:transform,opacity}
.status-peek-enter{animation:peek-in .28s cubic-bezier(.16,1,.3,1) forwards}
.status-peek-exit{animation:peek-out .22s ease-in forwards}
@keyframes peek-in{from{opacity:0;transform:translateX(-50%) translateY(-8px) scale(.96)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes peek-out{from{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}to{opacity:0;transform:translateX(-50%) translateY(-6px) scale(.98)}}
`;

/** 五态灵动状态胶囊：状态点 + 标签 + 距离指示 + SOS + 离线徽标 + Peek HUD。 */
export default function StatusCapsule({
  status,
  options,
}: StatusCapsuleProps) {
  const meta = STATUS_CAPSULE_META[status];
  const { isOffline, distanceMeters, onSosClick } = options ?? {};
  const prevStatusRef = useRef<AtomicFiveState | null>(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const [peekText, setPeekText] = useState<string>("");
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  useEffect(() => {
    // 首帧不触发 Peek，仅监听后续状态跃迁
    if (prevStatusRef.current === null) {
      prevStatusRef.current = status;
      return;
    }
    if (prevStatusRef.current === status) return;
    prevStatusRef.current = status;

    // 清理旧定时器
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    setIsExiting(false);

    const text = STATUS_PEEK_TEXT[status] ?? `${STATUS_CAPSULE_EMOJI[status]} ${meta.label}`;
    setPeekText(text);
    setIsPeeking(true);

    // 触觉震动（10ms 轻震，SSR 安全）
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(10);
      } catch {
        // 忽略不支持或被拦截的震动
      }
    }

    // 3s 后平滑收缩
    timerRef.current = window.setTimeout(() => {
      setIsExiting(true);
      exitTimerRef.current = window.setTimeout(() => {
        setIsPeeking(false);
        setIsExiting(false);
      }, 220);
    }, 3000);

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, [status, meta.label]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (exitTimerRef.current !== null) window.clearTimeout(exitTimerRef.current);
    };
  }, []);

  return (
    <div className="status-capsule-wrap" data-status={status} data-tone={meta.tone}>
      <style>{CAPSULE_CSS}</style>
      <div className="status-capsule">
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
            <span className="status-capsule-distance" style={{ marginLeft: 6, color: "#cbd5e1" }}>
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
      {isPeeking && (
        <div
          className={`status-peek ${isExiting ? "status-peek-exit" : "status-peek-enter"}`}
          data-testid="status-peek"
          data-status={status}
          role="status"
          aria-live="polite"
        >
          {peekText}
        </div>
      )}
    </div>
  );
}
