"use client";
import type { ReactNode } from "react";

type BadgeTone = "purple" | "cyan" | "plain";

const TONE_CLASS: Record<BadgeTone, string> = {
  purple:
    "bg-linear-to-b from-[rgba(139,92,246,0.85)] to-[rgba(99,72,255,0.65)] border border-white/25 text-white shadow-[0_2px_14px_-2px_rgba(123,97,255,0.7),inset_0_1px_0_rgba(255,255,255,0.45)]",
  cyan: "bg-white/10 backdrop-blur-md border border-white/25 text-brandCyan glow-cyan",
  plain: "bg-white/10 backdrop-blur-md border border-white/25 text-white/90",
};

/** Small glass pill: AR tag, ratings, distance capsule. */
export default function Badge({
  tone = "purple",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full border text-xs font-bold ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
