"use client";

import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DuoPillTone = "blue" | "green" | "yellow" | "red" | "orange" | "neutral";

const TONE: Record<DuoPillTone, string> = {
  blue: "bg-[var(--color-duo-blue)]/10 border-[var(--color-duo-blue)]/40 text-[var(--color-duo-blue-ink)]",
  green: "bg-[var(--color-duo-green)]/10 border-[var(--color-duo-green)]/40 text-[var(--color-duo-green-ink)]",
  yellow:
    "bg-[var(--color-duo-yellow)]/10 border-[var(--color-duo-yellow-dark)]/50 text-[var(--color-duo-yellow-ink)]",
  red: "bg-[var(--color-duo-red)]/10 border-[var(--color-duo-red)]/40 text-[var(--color-duo-red-dark)]",
  orange: "bg-[var(--color-duo-orange)]/10 border-[var(--color-duo-orange)]/40 text-[var(--color-duo-orange)]",
  neutral: "bg-[var(--color-duo-polar)] border-[var(--color-duo-swan)] text-[var(--color-duo-hare)]",
};

/** 暗底演绎（ProofCamera 鉴真徽标家族；rgba 非 Token，暗岛收拢于此一处） */
const TONE_DARK: Record<DuoPillTone, string> = {
  blue: "bg-black/45 border-white/20 text-slate-200",
  green: "bg-[rgba(34,197,94,.18)] border-[rgba(34,197,94,.4)] text-green-200",
  yellow: "bg-[rgba(251,191,36,.18)] border-[rgba(251,191,36,.45)] text-amber-200",
  red: "bg-[rgba(239,68,68,.22)] border-[rgba(239,68,68,.6)] text-red-200",
  orange: "bg-[rgba(249,115,22,.18)] border-[rgba(249,115,22,.5)] text-orange-200",
  neutral: "bg-black/45 border-white/20 text-slate-200",
};

/** 实心演绎（亮底深色字；2026-09-11 对比度裁决，neutral-900 全员 ≥4.9） */
const TONE_SOLID: Record<DuoPillTone, string> = {
  blue: "bg-[var(--color-duo-blue)] border-[var(--color-duo-blue-dark)] text-neutral-900",
  green: "bg-[var(--color-duo-green)] border-[var(--color-duo-green-dark)] text-neutral-900",
  yellow: "bg-[var(--color-duo-yellow)] border-[var(--color-duo-yellow-dark)] text-[var(--color-duo-eel)]",
  red: "bg-[var(--color-duo-red)] border-[var(--color-duo-red-dark)] text-neutral-900",
  orange: "bg-[var(--color-duo-orange)] border-[var(--color-duo-orange-dark)] text-neutral-900",
  neutral: "bg-[var(--color-duo-swan)] border-[var(--color-duo-hare)] text-[var(--color-duo-eel)]",
};

export type DuoPillVariant = "soft" | "solid" | "dark";

interface DuoPillProps {
  tone?: DuoPillTone;
  /** soft 浅底（默认）/ solid 实心 / dark 暗底（照片/深色浮层） */
  variant?: DuoPillVariant;
  /** 结构附加（ml-auto/align-middle/whitespace-nowrap…；cn 合并，冲突以后者赢） */
  className?: string;
  children: ReactNode;
  testId?: string;
  /** data-* 透传（ProofCamera data-forgery-badge/data-sha-tag） */
  dataAttrs?: Record<string, string | number | undefined>;
  /** 多态：span（默认）/ button（胶囊 CTA；press 态各站经 className 保留） */
  as?: "span" | "button";
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  ariaLabel?: string;
}

/**
 * 胶囊徽章（P9-6）：收敛 ~30 处浅色 tone badge + ProofCamera 4 暗 badge。
 * 正典 inline-flex/border-2/px-2/py-0.5/text-xs/font-bold（border-1→2、/15→/10 归一）；
 * 实心 pills（白字 button 系）与圆点/头像/进度条不在收敛域。
 */
export default function DuoPill({ tone = "blue", variant = "soft", className, children, testId, dataAttrs, as = "span", onClick, ariaLabel }: DuoPillProps) {
  const toneCls = variant === "solid" ? TONE_SOLID[tone] : variant === "dark" ? TONE_DARK[tone] : TONE[tone];
  const cls = cn(
    "inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-xs font-bold",
    variant === "dark" && "backdrop-blur",
    toneCls,
    className,
  );
  if (as === "button") {
    return (
      <button
        type="button"
        className={cls}
        data-testid={testId}
        onClick={onClick}
        aria-label={ariaLabel}
        {...dataAttrs}
      >
        {children}
      </button>
    );
  }
  return (
    <span
      className={cls}
      data-testid={testId}
      {...dataAttrs}
    >
      {children}
    </span>
  );
}
