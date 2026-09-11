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
          ? "bg-[var(--color-duo-green)] border-b-2 border-[var(--color-duo-green-dark)] text-neutral-900"
          : "bg-white border border-[var(--color-duo-swan)] shadow-sm text-[var(--color-duo-wolf)] hover:text-[var(--color-duo-eel)]"
      }`}
    >
      {children}
    </button>
  );
}
