"use client";

import * as React from "react";

import { playClick, playCorrect, playError } from "@/lib/duo-audio";

export type DuoButtonVariant = "primary" | "secondary" | "danger" | "warning" | "outline" | "ghost";
export type DuoSound = "click" | "correct" | "error" | "none";

const VARIANT: Record<DuoButtonVariant, string> = {
  primary:
    "bg-[var(--color-duo-green)] border-[var(--color-duo-green-dark)] text-white hover:brightness-[1.03]",
  secondary:
    "bg-[var(--color-duo-blue)] border-[var(--color-duo-blue-dark)] text-white hover:brightness-[1.03]",
  danger:
    "bg-[var(--color-duo-red)] border-[var(--color-duo-red-dark)] text-white hover:brightness-[1.03]",
  warning:
    "bg-[var(--color-duo-yellow)] border-[var(--color-duo-yellow-dark)] text-[var(--color-duo-eel)] hover:brightness-[1.03]",
  outline:
    "bg-white border-slate-200 text-slate-700 hover:bg-slate-50",
  ghost:
    "bg-transparent border-transparent text-slate-600 hover:bg-slate-100",
};

export interface DuoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: DuoButtonVariant;
  sound?: DuoSound;
}

export function DuoButton({
  variant = "primary",
  sound = "click",
  className = "",
  onClick,
  children,
  disabled,
  ...rest
}: DuoButtonProps) {
  const handleClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    if (sound !== "none") {
      try {
        if (sound === "correct") playCorrect();
        else if (sound === "error") playError();
        else playClick();
      } catch {}
    }
    onClick?.(e);
  };

  return (
    <button
      data-testid="duo-button"
      data-variant={variant}
      disabled={disabled}
      onClick={handleClick}
      className={[
        "duo-3d-button",
        "inline-flex items-center justify-center gap-2",
        "rounded-2xl border-b-4 border-x border-t px-5 py-3",
        "text-[15px] font-extrabold tracking-wide",
        "transition-[transform,filter]",
        "active:translate-y-1 active:border-b-0",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0 disabled:active:border-b-4",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-duo-blue)] focus-visible:ring-offset-2",
        VARIANT[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

export default DuoButton;
