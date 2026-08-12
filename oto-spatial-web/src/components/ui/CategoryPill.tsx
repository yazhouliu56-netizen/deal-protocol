"use client";
import type { ReactNode } from "react";

/** Filter pill: gradient primary when active, glass when idle. */
export default function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 min-h-10 rounded-full text-[11px] font-medium transition-all ${
        active
          ? "btn-primary text-white glow-purple-strong"
          : "glass-panel text-white/60 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
