"use client";
import type { ReactNode } from "react";

/** Filter pill: Duo 3D green when active, white card when idle. */
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
      className={`flex items-center gap-1.5 px-3.5 py-2 min-h-10 rounded-full text-xs font-medium transition-all ${
        active
          ? "bg-[#58cc02] border-b-2 border-[#58a700] text-white"
          : "bg-white border border-[#e5e5e5] shadow-sm text-[#777777] hover:text-[#4b4b4b]"
      }`}
    >
      {children}
    </button>
  );
}
