/**
 * Duo motion tokens（Batch③-0 立规矩）。
 * 取值对齐 Duolingo 官方动效语义：按压 180ms、进度/解锁 320ms、
 * back-out overshoot 曲线；长剧场式 reveal 另给 THEATER 档，须单处说明理由。
 *
 * 用法：framer-motion `transition={DUO_PRESS}` / `transition={DUO_SPRING_SOFT}`；
 * CSS：`transition-duration: ${DUO_MS.press}ms`。
 */
export const DUO_MS = {
  /** 按钮按压/态切换 */
  press: 180,
  /** 进度填充/解锁/屏切 */
  settle: 320,
  /** 剧场式 reveal（BlindReveal 类，需注释理由） */
  theater: 900,
} as const;

/** back-out 微过冲（Duo unlock 语义） */
export const DUO_EASE_BACK_OUT = [0.34, 1.56, 0.64, 1] as const;
/** 通用进出（屏切/浮层） */
export const DUO_EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const DUO_PRESS = { duration: DUO_MS.press / 1000, ease: DUO_EASE_OUT } as const;
export const DUO_SETTLE = { duration: DUO_MS.settle / 1000, ease: DUO_EASE_OUT } as const;
export const DUO_SPRING_SOFT = { type: "spring", stiffness: 320, damping: 28 } as const;
export const DUO_SPRING_SNAPPY = { type: "spring", stiffness: 400, damping: 30 } as const;
