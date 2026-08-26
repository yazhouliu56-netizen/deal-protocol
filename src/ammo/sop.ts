/**
 * 弹药属性表 · SOP 参数（ADR-0007 §一：爽约保障险/有效期/容量默认值）。
 * 每类目一行：新弹药填此表或直接热注弹药（战役 3：无表行回落弹自带 SOP）。
 */

import { DYNAMIC_AMMO_POOL } from "./factory.ts";

export interface SopParams {
  /** 爽约保障险（押金）默认开启。 */
  depositDefault?: boolean;
  /** 有效期 TTL 默认值（ms）。 */
  expiresInMs?: number;
  /** 默认容量（1 = 单对单，≥2 = 多人拼单局拼位）。 */
  capacityDefault?: number;
  /** 拼位缓冲名额（发起人 no-show buff 默认值）。 */
  buffSeats?: number;
  /** 磋商轮次上限。 */
  maxRounds?: number;
  /** 验收窗（ms，超时自动好评/放款）。 */
  reviewWindowMs?: number;
  /** 爽约保障险保费占单比例（0-1）。 */
  depositRate?: number;
}

/** 需求局默认（沿用 wave.ts 现状：无险默认关/3h 过期/单对单/3 轮磋商）。 */
export const DEFAULT_SOP: SopParams = {
  depositDefault: false,
  expiresInMs: 3 * 3600_000,
  capacityDefault: 1,
  buffSeats: 0,
  maxRounds: 3,
  reviewWindowMs: 72 * 3600_000,
  depositRate: 0,
};

export const CATEGORY_SOP: Record<string, Partial<SopParams>> = {
  // 进家类目：默认押金 + 短有效期 + 严格验收窗
  "家政保洁": {
    depositDefault: true,
    expiresInMs: 2 * 3600_000,
    capacityDefault: 1,
    reviewWindowMs: 48 * 3600_000,
    depositRate: 0.2,
  },
  "厨师 · 上门做饭": {
    depositDefault: true,
    expiresInMs: 2 * 3600_000,
    capacityDefault: 1,
    depositRate: 0.2,
  },
  "羽毛球": {
    depositDefault: false,
    expiresInMs: 6 * 3600_000,
    capacityDefault: 4,
    buffSeats: 1,
    maxRounds: 2,
  },
  // UI 热词别名：与「羽毛球」同配置（sopForCategory 命中即预填）
  "羽毛球约局": {
    depositDefault: false,
    expiresInMs: 6 * 3600_000,
    capacityDefault: 4,
    buffSeats: 1,
    maxRounds: 2,
  },
  "麻将": {
    depositDefault: true,
    expiresInMs: 4 * 3600_000,
    capacityDefault: 4,
    maxRounds: 2,
  },
  // Phase 3：遛狗新弹药
  "遛狗遛弯": {
    depositDefault: false,
    expiresInMs: 90 * 60_000,
    capacityDefault: 1,
    reviewWindowMs: 12 * 3600_000,
    depositRate: 0.1,
  },
};

export function sopForCategory(category: string): SopParams {
  const over = CATEGORY_SOP[category];
  // 战役 3 · 弹药优先（三层合并）：默认 ⊕ 弹药自带 SOP ⊕ 表行覆盖。
  // 存量有表行者逐字节不变；动态新弹零表编辑自动生效。
  const ammoSop = DYNAMIC_AMMO_POOL.get(category)?.sop;
  if (!over && !ammoSop) return DEFAULT_SOP;
  return {
    ...DEFAULT_SOP,
    ...(ammoSop ?? {}),
    ...(over ?? {}),
  };
}