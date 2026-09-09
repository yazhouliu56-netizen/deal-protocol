"use client";

import * as React from "react";

import DuoPill from "@/components/ui/DuoPill";

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
  completed: "bg-[var(--color-duo-yellow)] border-[var(--color-duo-yellow-dark)] text-white",
  current: "bg-[var(--color-duo-green)] border-[var(--color-duo-green-dark)] text-white shadow-[0_0_18px_rgba(88,204,2,.45)]",
  locked: "bg-[var(--color-duo-swan)] border-[#d4d4d4] text-[#9ca3af]",
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
        <DuoPill tone="blue" variant="solid" className="absolute -top-1 -right-1 text-[10px] font-extrabold shadow-sm">
          进行中
        </DuoPill>
      )}
      <style>{`@keyframes duo-breathe{0%,100%{transform:scale(1);box-shadow:0 0 18px rgba(88,204,2,.45)}50%{transform:scale(1.06);box-shadow:0 0 28px rgba(88,204,2,.65)}}`}</style>
    </div>
  );
}

export default DuoPathNode;
