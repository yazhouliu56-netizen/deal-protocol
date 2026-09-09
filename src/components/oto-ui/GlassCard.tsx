"use client";
import type { HTMLAttributes } from "react";

type GlassVariant = "panel" | "interactive" | "active";

const VARIANT_CLASS: Record<GlassVariant, string> = {
  panel: "bg-white border border-[var(--color-duo-swan)] shadow-sm",
  interactive: "bg-white border border-[var(--color-duo-swan)] shadow-sm",
  active: "bg-white border border-[var(--color-duo-green)]/50 shadow-sm",
};

/** Base card: panel / interactive / active (Feather Duo white-card dialect). */
export default function GlassCard({
  variant = "panel",
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement> & { variant?: GlassVariant }) {
  return (
    <div
      className={`${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    />
  );
}
