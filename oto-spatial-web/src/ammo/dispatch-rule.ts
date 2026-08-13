/**
 * 弹药属性表 · 分发权重（C4）— 每类目可配的派单/抢单打分规则。
 * 底座 broadcast/matches 按此表驱动，新增类目只填配置。
 */

export interface DispatchRule {
  /** 打分权重（距离/信用/定制覆盖/验证加分）。 */
  weights: {
    distance: number;
    credit: number;
    custom: number;
    verifiedBonus: number;
  };
  /** 硬门槛：进家类目必须实名。 */
  requiresVerified?: string[];
  /** 星级加成：★≥x 且完成率≥y 时加分。 */
  starBonus?: { starMin: number; completionMin: number; bonus: number };
}

/** 需求局默认（沿用 broadcast.ts 现状：30/30/25 + 5）。 */
export const DEFAULT_DISPATCH: DispatchRule = {
  weights: { distance: 30, credit: 30, custom: 25, verifiedBonus: 5 },
  requiresVerified: ["陪诊陪护", "家政保洁", "厨师", "上门"],
  starBonus: { starMin: 4, completionMin: 0.9, bonus: 5 },
};

export const CATEGORY_DISPATCH: Record<string, Partial<DispatchRule>> = {
  // 家政类目：进家硬门槛收得更紧，距离权重更高（就近响应）
  "家政保洁": {
    weights: { distance: 40, credit: 25, custom: 20, verifiedBonus: 5 },
    requiresVerified: ["家政保洁", "上门"],
  },
  "水电维修": {
    weights: { distance: 35, credit: 30, custom: 20, verifiedBonus: 5 },
    requiresVerified: ["上门"],
  },
  "搬家": {
    weights: { distance: 20, credit: 35, custom: 30, verifiedBonus: 5 },
  },
};

export function dispatchRuleFor(category: string): DispatchRule {
  const over = CATEGORY_DISPATCH[category];
  if (!over) return DEFAULT_DISPATCH;
  return {
    weights: { ...DEFAULT_DISPATCH.weights, ...over.weights },
    requiresVerified: over.requiresVerified ?? DEFAULT_DISPATCH.requiresVerified,
    starBonus: over.starBonus ?? DEFAULT_DISPATCH.starBonus,
  };
}
