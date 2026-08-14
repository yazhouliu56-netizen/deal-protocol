"use client";
import type { HTMLAttributes } from "react";

type GlassVariant = "panel" | "interactive" | "active";

const VARIANT_CLASS: Record<GlassVariant, string> = {
  panel: "glass-panel",
  interactive: "glass-panel-interactive",
  active: "glass-panel-active",
};

/** Base glass material card: panel / interactive (hover glow edge) / active. */
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
