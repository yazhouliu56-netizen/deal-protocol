/**
 * 触控靶区三轨（P9-7 单源）：全仓触控最小尺寸唯一真理源。
 *
 * - compact 40（min-h-10）：胶囊/次级 pill/输入框行高（BiddingSandboxCard、HomePage、WaveFeed…）
 * - standard 44（min-h-11）：WCAG 2.2 AA 下限，通用可点元素基线（AmmoPillBar tiles、ChatPage…）
 * - primary 48（min-h-12 / min-h-[48px]）：主 CTA 与关键动作（支付/拍照/授权/表单输入…）
 *
 * 例外：SENIOR_HOTSPOT_PX=75（长辈模式专属放大，不在此三轨内）。
 * Tailwind 类侧（min-h-10/11/12）为档位表达，不做常量替换；style 内联魔法数必须走本表。
 */
export const TOUCH_TARGET = {
  compact: 40,
  standard: 44,
  primary: 48,
} as const;

export type TouchTargetTier = keyof typeof TOUCH_TARGET;
