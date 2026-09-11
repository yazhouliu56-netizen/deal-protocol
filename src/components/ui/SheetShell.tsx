"use client";

import { useEffect, type ReactNode } from "react";
import { motion as Motion } from "framer-motion";
import type { TargetAndTransition } from "framer-motion";

export interface SheetMotion {
  /** 进场位移（默认 40；PublishSheet 用 60，ScanMock 用 scale 代替） */
  y?: number;
  scale?: number;
  stiffness?: number;
  damping?: number;
}

interface SheetShellProps {
  onClose: () => void;
  children: ReactNode;
  /** 面板类名：整串替换默认（各弹层 bottom/z/padding 原样保留，零视觉漂移） */
  panelClassName?: string;
  maskClassName?: string;
  motion?: SheetMotion;
  /** 覆盖默认 animate（PublishSheet 拖拽 dismissing 离场态） */
  animateOverride?: TargetAndTransition;
  panelTestId?: string;
}

export const SHEET_PANEL_DEFAULT =
  "fixed inset-x-3 bottom-24 z-50 bg-white border-2 border-[var(--color-duo-swan)] border-b-[6px] rounded-3xl p-4";

const SHEET_MASK_DEFAULT = "fixed inset-0 z-40 bg-black/50";

/**
 * 白色底弹层结构壳（P9-2）：收敛 5 处白色底 Sheet 的遮罩/面板/motion 接线。
 * 只收结构不收视觉：panelClassName 整串替换，motion 参数透传；
 * `open` 门控留调用方（各弹层 AnimatePresence/exit 语义原样不动，e2e 时序零风险）；
 * 关闭键用 SheetClose 原子原位保留（各 header 布局不动，aria-label 原样守恒）。
 */
export default function SheetShell({
  onClose,
  children,
  panelClassName = SHEET_PANEL_DEFAULT,
  maskClassName = SHEET_MASK_DEFAULT,
  motion = {},
  animateOverride,
  panelTestId,
}: SheetShellProps) {
  const { y = 40, scale, stiffness = 320, damping = 28 } = motion;
  const initial = scale !== undefined ? { scale, opacity: 0 } : { y, opacity: 0 };
  const animate = animateOverride ?? (scale !== undefined ? { scale: 1, opacity: 1 } : { y: 0, opacity: 1 });
  const exit = scale !== undefined ? { scale, opacity: 0 } : { y, opacity: 0 };

  // Esc 关闭（各弹层统一可达；e2e 不按键，时序零风险）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <Motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={maskClassName}
        onClick={onClose}
        data-testid="sheet-mask"
      />
      <Motion.div
        initial={initial}
        animate={animate}
        exit={exit}
        transition={{ type: "spring", stiffness, damping }}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        data-testid={panelTestId}
      >
        {children}
      </Motion.div>
    </>
  );
}

/** 弹层标准关闭键（4 处 ✕ 同类，类名统一；aria-label 调用方原样透传，e2e 契约） */
export function SheetClose({ onClose, label, className }: { onClose: () => void; label: string; className?: string }) {
  return (
    <button
      onClick={onClose}
      aria-label={label}
      className={`text-[var(--color-duo-hare)] hover:text-[var(--color-duo-eel)]${className ? ` ${className}` : ""}`}
    >
      ✕
    </button>
  );
}
