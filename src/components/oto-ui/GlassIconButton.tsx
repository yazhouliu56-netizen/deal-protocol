"use client";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Size = "sm" | "md";

const SIZE_CLASS: Record<Size, string> = {
  sm: "w-10 h-10 rounded-full",
  md: "w-11 h-11 rounded-2xl",
};

/** Duo icon button（极简多邻国：白底 + 2px Swan 边框 + 底部厚唇，无 blur；触感只给可按的）。 */
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
      className={`duo-3d-button bg-white border-2 border-[var(--color-duo-swan)] ${SIZE_CLASS[size]} flex items-center justify-center shrink-0 active:translate-y-px ${
        tone === "cyan"
          ? "text-[var(--color-duo-blue)] hover:border-[var(--color-duo-blue)]"
          : "text-[var(--color-duo-wolf)] hover:border-[var(--color-duo-hare)] hover:text-[var(--color-duo-eel)]"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
