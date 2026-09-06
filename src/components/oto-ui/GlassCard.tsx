"use client";
import type { HTMLAttributes } from "react";

type GlassVariant = "panel" | "interactive" | "active";

const VARIANT_CLASS: Record<GlassVariant, string> = {
  panel: "bg-white border border-[#e5e5e5] shadow-sm",
  interactive: "bg-white border border-[#e5e5e5] shadow-sm",
  active: "bg-white border border-[#58cc02]/50 shadow-sm",
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
