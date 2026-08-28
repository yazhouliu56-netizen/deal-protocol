"use client";

import * as React from "react";

export type DuoPathStatus = "completed" | "current" | "locked";

export interface DuoPathNodeProps {
  status: DuoPathStatus;
  step?: number;
  title?: string;
  offsetX?: number;
}

const ICON: Record<DuoPathStatus, string> = {
  completed: "✓",
  current: "⚡",
  locked: "🔒",
};

const COLOR: Record<DuoPathStatus, string> = {
  completed: "bg-[#ffc800] border-[#e5b400] text-white",
  current: "bg-[#58cc02] border-[#46a302] text-white shadow-[0_0_18px_rgba(88,204,2,.45)]",
  locked: "bg-[#e5e5e5] border-[#d4d4d4] text-[#9ca3af]",
};

export function DuoPathNode({ status, step, title, offsetX = 0 }: DuoPathNodeProps) {
  return (
    <div
      data-testid="duo-path-node"
      data-status={status}
      data-step={step}
      className="relative flex flex-col items-center gap-1.5"
      style={offsetX ? { transform: `translateX(${offsetX}px)` } : undefined}
    >
      <span
        data-testid="duo-path-icon"
        className={[
          "flex h-12 w-12 items-center justify-center rounded-full border-b-[4px] border-x border-t text-[18px] font-extrabold",
          status === "current" ? "animate-[duo-breathe_1.6s_ease-in-out_infinite]" : "",
          COLOR[status],
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {step != null ? step : ICON[status]}
      </span>
      {title && (
        <span className="max-w-[92px] text-center text-xs font-bold leading-tight text-slate-700">{title}</span>
      )}
      {status === "current" && (
        <span className="absolute -top-1 -right-1 rounded-full bg-[#1cb0f6] px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
          进行中
        </span>
      )}
      <style>{`@keyframes duo-breathe{0%,100%{transform:scale(1);box-shadow:0 0 18px rgba(88,204,2,.45)}50%{transform:scale(1.06);box-shadow:0 0 28px rgba(88,204,2,.65)}}`}</style>
    </div>
  );
}

export default DuoPathNode;
