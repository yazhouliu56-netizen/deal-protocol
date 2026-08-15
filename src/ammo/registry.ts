/**
 * 弹药注册表 · 存量聚合器（P0-1 AmmoRunner 前置，宪法 #3/#4/#5）。
 *
 * 把既有 `src/ammo/` 散装四表（pricing-formula / dispatch-rule / risk-rule /
 * sop）无损聚合成符合 `IAmmoDefinition` 规范的弹药对象——
 * 不修改任何既有表文件（856 测试基线零影响），纯函数只读聚合。
 * 未配置类目自动应用默认保底弹药（Default Ammo，零防护兜底）。
 */

import type {
  IAmmoDefinition,
  IAmmoSopOverrides,
  IDispatchRule,
  PricingModel,
} from "../types/ammo-schema.ts";
import type { IFuzePolicy } from "../types/fuze-policy.ts";
import { DEFAULT_FUZE_POLICY, IMPACT_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import { pricingForCategory, CATEGORY_PRICING, type PricingFormula } from "./pricing-formula.ts";
import { dispatchRuleFor, CATEGORY_DISPATCH } from "./dispatch-rule.ts";
import { CATEGORY_RISK } from "./risk-rule.ts";
import { sopForCategory, CATEGORY_SOP } from "./sop.ts";
import { housekeepingAmmo } from "./housekeeping.ammo.ts";
import { meetupAmmo } from "./meetup.ammo.ts";

const hasKey = (table: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(table, key);

/** 计价模型投影：有时薪档 → HOURLY（首档时薪）；否则 FIXED（起步价/地板价）。 */
export function toPricingModel(formula: PricingFormula): PricingModel {
  const hourly = formula.hourlyRates?.[1];
  if (typeof hourly === "number") {
    return { kind: "HOURLY", rateYuan: hourly, minHours: 1 };
  }
  return { kind: "FIXED", amountYuan: formula.baseRateYuan ?? formula.minPriceYuan ?? 0 };
}

/**
 * 引信聚合：类目覆盖表命中 home-access-verification（进家/上门高财产风险）
 * → 💥 碰炸引信模板；其余类目 → 零防护兜底（未声明引信 = 最低配置，弹药
 * 必须显式装填）。age-required 类目（夜骑/夜爬）引信模板无年龄位，
 * 合规由 base/safe/ageGate 域独立执行，此处不映射。
 */
export function toFuzePolicy(category: string): IFuzePolicy {
  const extra = CATEGORY_RISK[category] ?? [];
  if (extra.includes("home-access-verification")) return IMPACT_FUZE_TEMPLATE;
  return DEFAULT_FUZE_POLICY;
}

/** 派单规则聚合：四表 dispatch-rule 无损投影为 IDispatchRule（含默认兜底）。 */
export function toDispatchRule(category: string): IDispatchRule {
  const rule = dispatchRuleFor(category);
  return {
    weights: { ...rule.weights },
    hardGates: rule.hardGates ? { ...rule.hardGates } : undefined,
    starBonus: rule.starBonus ? { ...rule.starBonus } : undefined,
  };
}

/** 默认保底弹药（未配置类目兜底；零钩子 / 零防护 / 零 SOP 覆盖）。 */
export const DEFAULT_AMMO: IAmmoDefinition = {
  ammoId: "default-ammo",
  category: "default",
  version: "1.0.0",
  fiveStateHooks: [],
  pricingModel: { kind: "FIXED", amountYuan: 0 },
  fuzePolicy: DEFAULT_FUZE_POLICY,
  dispatchRule: {
    weights: { distance: 30, credit: 30, custom: 25, verifiedBonus: 5 },
    hardGates: { banned: true, online: true },
  },
  sop: {},
};

/**
 * 官方标准弹药直挂表（类目 → 官方弹药，优先级高于四表聚合）。
 * Phase 2 起官方弹药（housekeeping-v1 / meetup-social-v1）在此登记，
 * 命中即整弹返回（含声明式钩子），不再走散装表聚合。
 */
export const OFFICIAL_AMMO: Record<string, IAmmoDefinition> = {
  housekeeping: housekeepingAmmo,
  meetup: meetupAmmo,
  dating: meetupAmmo,
  social: meetupAmmo,
};

/** 四表任一命中即视为已配置类目（如「羽毛球」仅 SOP 表登记也算）。 */
export function isConfiguredCategory(category: string): boolean {
  return (
    hasKey(CATEGORY_PRICING, category) ||
    hasKey(CATEGORY_SOP, category) ||
    hasKey(CATEGORY_DISPATCH, category) ||
    hasKey(CATEGORY_RISK, category)
  );
}

/**
 * 弹药注册表查询（纯函数）：官方弹药直挂优先，其次按类目聚合四表。
 * 官方弹药（housekeeping-v1 / meetup-social-v1）：整弹直接返回；
 * 已配置类目：四表逐项聚合（缺表自动走各表默认值）；
 * 未配置类目：返回默认保底弹药（保留传入类目名）。
 */
export function getAmmoDefinition(category: string): IAmmoDefinition {
  const official = OFFICIAL_AMMO[category];
  if (official) return official;
  if (!isConfiguredCategory(category)) {
    return { ...DEFAULT_AMMO, category };
  }
  return {
    ammoId: category,
    category,
    version: "1.0.0",
    fiveStateHooks: [],
    pricingModel: toPricingModel(pricingForCategory(category)),
    fuzePolicy: toFuzePolicy(category),
    dispatchRule: toDispatchRule(category),
    sop: sopForCategory(category) as IAmmoSopOverrides,
  };
}
