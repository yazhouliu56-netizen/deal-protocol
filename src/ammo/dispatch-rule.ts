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
  /** 硬门槛（C4 契约结构化）：进家实名 / 黑名单 / 在线要求。 */
  hardGates: {
    requiresVerified?: string[];
    banned?: boolean;
    online?: boolean;
  };
  /** 星级加成：★≥x 且完成率≥y 时加分。 */
  starBonus?: { starMin: number; completionMin: number; bonus: number };
}

/** 需求局默认（沿用 broadcast.ts 现状：30/30/25 + 5）。 */
export const DEFAULT_DISPATCH: DispatchRule = {
  weights: { distance: 30, credit: 30, custom: 25, verifiedBonus: 5 },
  hardGates: {
    requiresVerified: ["陪诊陪护", "家政保洁", "厨师", "上门"],
    banned: true,
    online: true,
  },
  starBonus: { starMin: 4, completionMin: 0.9, bonus: 5 },
};

export const CATEGORY_DISPATCH: Record<string, Partial<DispatchRule>> = {
  // 家政类目：进家硬门槛收得更紧，距离权重更高（就近响应）
  "家政保洁": {
    weights: { distance: 40, credit: 25, custom: 20, verifiedBonus: 5 },
    hardGates: { requiresVerified: ["家政保洁", "上门"] },
  },
  "水电维修": {
    weights: { distance: 35, credit: 30, custom: 20, verifiedBonus: 5 },
    hardGates: { requiresVerified: ["上门"] },
  },
  "搬家": {
    weights: { distance: 20, credit: 35, custom: 30, verifiedBonus: 5 },
  },
  // Phase 3：遛狗新弹药 —— 重距离轻信用（现场直连商品），单人消费品
  "遛狗遛弯": {
    weights: { distance: 45, credit: 20, custom: 20, verifiedBonus: 5 },
    hardGates: { requiresVerified: ["遛狗遛弯", "上门"] },
  },
};

export function dispatchRuleFor(category: string): DispatchRule {
  const over = CATEGORY_DISPATCH[category];
  if (!over) return DEFAULT_DISPATCH;
  return {
    weights: { ...DEFAULT_DISPATCH.weights, ...over.weights },
    hardGates: { ...DEFAULT_DISPATCH.hardGates, ...over.hardGates },
    starBonus: over.starBonus ?? DEFAULT_DISPATCH.starBonus,
  };
}
