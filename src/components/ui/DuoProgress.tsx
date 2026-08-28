"use client";

import { motion } from "framer-motion";

export interface DuoProgressProps {
  value: number;
  max?: number;
  className?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function DuoProgress({ value, max = 100, className = "" }: DuoProgressProps) {
  const pct = clamp((value / max) * 100, 0, 100);

  return (
    <div
      data-testid="duo-progress"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={[
        "relative h-4 w-full overflow-hidden rounded-full",
        "bg-slate-200",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <motion.div
        data-testid="duo-progress-bar"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 420, damping: 30 }}
        className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-duo-green)]"
        style={{ borderBottom: "3px solid var(--color-duo-green-dark)" }}
      >
        <span className="absolute inset-x-0 top-0 h-[6px] rounded-full bg-white/40" aria-hidden="true" />
      </motion.div>
    </div>
  );
}

export default DuoProgress;
