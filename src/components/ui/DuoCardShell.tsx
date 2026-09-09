"use client";

import type { ReactNode } from "react";
import { motion as Motion } from "framer-motion";
import type { Transition } from "framer-motion";

/** 白卡 3D 正典（P9-4 收敛值；DuoEmpty 即此形 p-6 居中版） */
export const DUO_CARD_BASE =
  "bg-white rounded-3xl border-2 border-[var(--color-duo-swan)] border-b-[6px]";

export interface DuoCardMotion {
  initial?: Record<string, string | number>;
  animate?: Record<string, string | number>;
  transition?: Transition;
}

interface DuoCardShellProps {
  children: ReactNode;
  /** 布局附加（p-4/p-5/flex/space-y/hover… 原样透传，零视觉漂移） */
  className?: string;
  testId?: string;
  /** data-* 透传（GenericOrderCard 的 data-wave-id/data-now） */
  dataAttrs?: Record<string, string | number | undefined>;
  /** 入场动画透传（WorkerWorkbench/ProfilePage motion 卡；不传即静态 div） */
  motion?: DuoCardMotion;
}

/**
 * 白卡结构壳（P9-4）：收敛 6 处手工白卡 3D（正典底 + 布局/数据/动画透传）。
 * glass-cabin（HeroAiDemandCabin）非纯白卡，不在收敛域。
 */
export default function DuoCardShell({
  children,
  className = "",
  testId,
  dataAttrs,
  motion,
}: DuoCardShellProps) {
  const cls = `${DUO_CARD_BASE}${className ? ` ${className}` : ""}`;
  if (!motion) {
    return (
      <div className={cls} data-testid={testId} {...dataAttrs}>
        {children}
      </div>
    );
  }
  return (
    <Motion.div
      className={cls}
      data-testid={testId}
      {...dataAttrs}
      initial={motion.initial}
      animate={motion.animate}
      transition={motion.transition}
    >
      {children}
    </Motion.div>
  );
}
