"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Size = "sm" | "md";

const SIZE_CLASS: Record<Size, string> = {
  sm: "w-10 h-10 rounded-full",
  md: "w-11 h-11 rounded-2xl",
};

/** Small circular glass icon button (search actions, AR control column). */
export default function GlassIconButton({
  children,
  className = "",
  tone = "default",
  size = "md",
  onClick,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: "default" | "cyan";
  size?: Size;
}) {
  return (
    <button
      onClick={onClick}
      className={`glass-panel ${SIZE_CLASS[size]} flex items-center justify-center transition-colors shrink-0 ${
        tone === "cyan"
          ? "text-brandCyan hover:border-brandCyan/50 glow-cyan"
          : "text-white/70 hover:border-brandPurple/50 hover:text-white"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
