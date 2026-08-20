/**
 * 弹药注册表 · 存量聚合器 + 运行时动态弹药池（P0-1 AmmoRunner 前置，宪法 #3/#4/#5）。
 *
 * 把既有 `src/ammo/` 散装四表（pricing-formula / dispatch-rule / risk-rule /
 * sop）无损聚合成符合 `IAmmoDefinition` 规范的弹药对象——
 * 不修改任何既有表文件（856 测试基线零影响），纯函数只读聚合。
 * 未配置类目自动应用默认保底弹药（Default Ammo，零防护兜底）。
 *
 * 运行时动态弹药池（AmmoFactory 热注册，2026-08-16）：
 * `src/ammo/factory.ts` 的 registerDynamicAmmo 把装配出厂的不可变弹药按
 * category 注入 DYNAMIC_AMMO_POOL；getAmmoDefinition / getAmmoById 检索
 * 链路为「动态池 → 官方硬编码 → 四表聚合 → 默认保底」——热注册弹药
 * 即时生效，未命中自动回落官方弹药与默认保底（零回归）。
 */

import type {
  IAmmoDefinition,
  IAmmoSopOverrides,
  IDispatchRule,
  IWorkerRequirement,
  PricingModel,
} from "../types/ammo-schema.ts";
import type { IFuzePolicy } from "../types/fuze-policy.ts";
import type { ScenarioTheme } from "../types/ui-viewport.ts";
import { DEFAULT_FUZE_POLICY, IMPACT_FUZE_TEMPLATE } from "../types/fuze-policy.ts";
import { pricingForCategory, CATEGORY_PRICING, type PricingFormula } from "./pricing-formula.ts";
import { dispatchRuleFor, CATEGORY_DISPATCH } from "./dispatch-rule.ts";
import { CATEGORY_RISK } from "./risk-rule.ts";
import { sopForCategory, CATEGORY_SOP } from "./sop.ts";
import { housekeepingAmmo } from "./housekeeping.ammo.ts";
import { meetupAmmo } from "./meetup.ammo.ts";
import { companionAmmo } from "./companion.ammo.ts";
import { applianceRepairAmmo } from "./appliance_repair.ammo.ts";

const hasKey = (table: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(table, key);

import { DYNAMIC_AMMO_POOL } from "./factory.ts";
/**
 * 运行时动态弹药池（AmmoFactory 热注册写入位）：
 * Map<category, IAmmoDefinition>，工厂 `registerDynamicAmmo` 把审查通过、
 * 全图冻结的弹药注入本池；检索链路动态池优先（见 getAmmoDefinition）。
 * 本池定义在装配层 factory.ts（循环依赖治理，见 factory.ts 头部说明），
 * 此处 import + re-export 保持既有消费方（getAmmoDefinition / factory.test.ts）导入面不变。
 */
export { DYNAMIC_AMMO_POOL };

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
 * 四大标杆业务弹药（家政 / 组局 / 陪玩 / 家电维修）大满贯：
 *   housekeeping-v1（💥 碰炸）/ meetup-social-v1（⏳延期 + 📡近炸）/
 *   companion-v1（纯 📡 近炸）/ appliance-repair-v1（💥 碰炸 · 全仓首枚
 *   C3_TECH_B2B 技术资产聚类）；dating / escort 同人风险类目归 companion。
 * 命中即整弹返回（含声明式钩子），不再走散装表聚合。
 * 注：四枚弹药均已按 8 维全息配置（IHolographicAmmoConfig）经 AmmoFactory
 *   assembleAmmo 流水线静态审查出厂（模块加载期强制门禁，详见各弹药文件），
 *   本表直挂其出厂产物；动态弹药经 DYNAMIC_AMMO_POOL 热注册优先命中。
 */
export const OFFICIAL_AMMO: Record<string, IAmmoDefinition> = {
  housekeeping: housekeepingAmmo,
  meetup: meetupAmmo,
  dating: companionAmmo,
  escort: companionAmmo,
  companion: companionAmmo,
  social: meetupAmmo,
  // 首枚 C3_TECH_B2B 品类弹药双键挂载：`appliance_repair` 为中文别名归一化
  // 直拨键（CATEGORY_TO_OFFICIAL → OFFICIAL_AMMO），`APPLIANCE_REPAIR` 为
  // 类目大写检索键（getAmmoDefinition('APPLIANCE_REPAIR') 精确命中整弹），
  // 两键同一出厂产物引用（deepFreeze 后只读）。
  appliance_repair: applianceRepairAmmo,
  APPLIANCE_REPAIR: applianceRepairAmmo,
};

/**
 * 中文品类 → 官方弹药 key 归一化（W1 总装：发布弹层以中文品类发单，
 * 需直挂官方弹药才能在 Wave 上写入 housekeeping-v1 / meetup-social-v1，
 * 供履约座舱按 ammoId 装载场景插槽——白皮书 §5.7 scenario 键直挂）。
 */
export const CATEGORY_TO_OFFICIAL: Record<string, string> = {
   "家政保洁": "housekeeping",
   保洁: "housekeeping",
   打扫: "housekeeping",
   做卫生: "housekeeping",
   扫地: "housekeeping",
   擦玻璃: "housekeeping",
  羽毛球约局: "meetup",
  羽毛球: "meetup",
  约局: "meetup",
  组局: "meetup",
  "组局社交": "meetup",
  桌游: "meetup",
  拼桌: "meetup",
  陪玩: "companion",
  交友: "companion",
  "陪伴交友": "companion",
  约会: "companion",
  "摄影师约拍": "companion",
  约拍: "companion",
  摄影: "companion",
  "家电维修": "appliance_repair",
  维修: "appliance_repair",
  修空调: "appliance_repair",
  修洗衣机: "appliance_repair",
  修冰箱: "appliance_repair",
  修油烟机: "appliance_repair",
  "水电维修": "appliance_repair",
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
 * 弹药注册表查询（纯函数）：动态热注册池优先，其次官方弹药直挂，再次按
 * 类目聚合四表。官方弹药（housekeeping-v1 / meetup-social-v1）：整弹直接返回；
 * 已配置类目：四表逐项聚合（缺表自动走各表默认值）；
 * 未配置类目：返回默认保底弹药（保留传入类目名）。
 */
export function getAmmoDefinition(category: string): IAmmoDefinition {
  const dynamic = DYNAMIC_AMMO_POOL.get(category);
  if (dynamic) return dynamic;
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

/**
 * 动态弹药池发布端检索（纯函数只读）：精确 class key 优先，其次按
 * 弹药声明的中文类目别名（D8 aliases）遍历只读匹配。全图冻结弹药
 * 只走读操作（Map.get / Array.includes），无任何写入路径。
 * 未命中返回 undefined → 调用方回落官方映射 / 四表聚合 / 默认保底。
 */
export function resolveDynamicAmmoByInput(input: string): IAmmoDefinition | undefined {
  const exact = DYNAMIC_AMMO_POOL.get(input);
  if (exact) return exact;
  for (const ammo of DYNAMIC_AMMO_POOL.values()) {
    const aliases = ammo.holographic?.aliases;
    if (aliases && aliases.includes(input)) return ammo;
  }
  return undefined;
}

/**
 * W1 总装：发布链路弹药标识解析（PublishSheet 发单时写入 Wave.ammoId）。
 *
 * 检索链：动态弹药池（精确 key + 中文类目别名直拨）→ 中文类目归一化
 * 官方弹药（CATEGORY_TO_OFFICIAL）→ getAmmoDefinition（聚合 / 保底）。
 * 动态长尾弹药（registerDynamicAmmo 热注）经 aliases 中文直拨优先命中，
 * 官方三大标杆弹药中文映射语义零改动。
 */
export function resolveAmmoIdForPublish(category: string): string {
  const dynamic = resolveDynamicAmmoByInput(category);
  if (dynamic) return dynamic.ammoId;
  const officialKey = CATEGORY_TO_OFFICIAL[category];
  const official = OFFICIAL_AMMO[officialKey ?? category];
  if (official) return official.ammoId;
  return getAmmoDefinition(category).ammoId;
}

/**
 * 自由文本 → 弹药（首页 AI 拟物草稿卡原地展开的检索链，弹药表驱动零硬编码）：
 * 动态池中文类目别名（D8 aliases 只读扫描）→ 中文类目词表（CATEGORY_TO_OFFICIAL 键
 * 子串命中，首命即止）。未命中返回 null（调用方回落全类目 default 弹药草稿）。
 */
export function resolveAmmoByFreeText(
  text: string,
): { key: string; ammoId: string; label: string } | null {
  for (const ammo of DYNAMIC_AMMO_POOL.values()) {
    const aliases = ammo.holographic?.aliases;
    if (!aliases) continue;
    const hit = aliases.find((a) => text.includes(a));
    if (hit) {
      return { key: ammo.category ?? ammo.ammoId, ammoId: ammo.ammoId, label: hit };
    }
  }
  for (const [category, officialKey] of Object.entries(CATEGORY_TO_OFFICIAL)) {
    if (text.includes(category)) {
      const official = OFFICIAL_AMMO[officialKey];
      if (official) return { key: officialKey, ammoId: official.ammoId, label: category };
    }
  }
  return null;
}

/**
 * W5 总装：按 ammoId 反查整弹（履约座舱核销时装载钩子）。
 * 检索链路：动态热注册池 → 官方弹药（housekeeping-v1 / meetup-social-v1）
 * 整弹直挂；未命中时回落类目聚合（兼容无 ammoId 的存量 Wave，category
 * 中文名走四表聚合）。
 */
export function getAmmoById(ammoId: string): IAmmoDefinition {
  const dynamic = [...DYNAMIC_AMMO_POOL.values()].find((a) => a.ammoId === ammoId);
  if (dynamic) return dynamic;
  const hit = Object.values(OFFICIAL_AMMO).find((a) => a.ammoId === ammoId);
  if (hit) return hit;
  return getAmmoDefinition(ammoId);
}

/**
 * 首页品类胶囊展示元数据（唯一弹药 → 胶囊名 / 拟物图标；注册表即单一真理源，
 * 严禁 .tsx 页面手写品类数组——工厂热注新弹药后首页自动长出新入口）。
 */
const PILL_META: Record<string, { label: string; icon: string }> = {
  "housekeeping-v1": { label: "家政保洁", icon: "🧽" },
  "meetup-social-v1": { label: "组局社交", icon: "🏸" },
  "companion-v1": { label: "陪伴交友", icon: "📷" },
  "appliance-repair-v1": { label: "家电维修", icon: "🔧" },
};

/**
 * 弹药主题令牌归一（注册表侧与 D-8 视界契约同语义：白名单四弹 + default 直通，
 * 未知/缺失安全回落 default——供胶囊主题色投影）。
 */
function pillThemeOf(ammo: IAmmoDefinition): ScenarioTheme {
  const t = ammo.holographic?.theme;
  return t === "housekeeping" || t === "meetup" || t === "companion" || t === "tech"
    ? t
    : "default";
}

/**
 * 全量注册弹药聚合（单一真理源，演示/工作台/首页共用）：
 * 官方标杆弹药按 ammoId 去重（别名键不重复计）+ DYNAMIC_AMMO_POOL 全部热注弹药。
 */
export function listRegisteredAmmos(): IAmmoDefinition[] {
  const seen = new Set<string>();
  const out: IAmmoDefinition[] = [];
  const push = (ammo: IAmmoDefinition) => {
    if (seen.has(ammo.ammoId)) return;
    seen.add(ammo.ammoId);
    out.push(ammo);
  };
  for (const ammo of Object.values(OFFICIAL_AMMO)) push(ammo);
  for (const ammo of DYNAMIC_AMMO_POOL.values()) push(ammo);
  return out;
}

/**
 * 首页品类胶囊描述符（弹药表驱动零硬编码）：
 * 官方四枚（图标/中文名取注册表元数据）在前，动态池弹药随注册顺序追加
 * （图标缺省 ⚡，中文名取弹药声明的第一个别名，主题令牌经 pillThemeOf 归一）。
 * `limit` 控制首页展示上限（默认 8：官方 4 + 动态池前 4，杜绝长尾爆棚）。
 */
export function listAmmoPillDescriptors(
  limit = 8,
): Array<{ ammoId: string; category: string; label: string; icon: string; theme: ScenarioTheme }> {
  return listRegisteredAmmos()
    .slice(0, limit)
    .map((ammo) => {
      const meta = PILL_META[ammo.ammoId];
      return {
        ammoId: ammo.ammoId,
        category: ammo.category,
        label:
          meta?.label ??
          ammo.holographic?.aliases?.[0] ??
          ammo.category ??
          ammo.ammoId,
        icon: meta?.icon ?? "⚡",
        theme: pillThemeOf(ammo),
      };
    });
}

/**
 * 订单服务文本 → 弹药准入门槛（工作台订单级判定，注册表单一真理源）：
 * 中文类目映射键子串命中（「深度保洁」→ 家政门槛）→ 官方弹药门槛；
 * 动态池弹药中文别名子串命中 → 动态门槛；未命中无门槛（通用可接单）。
 */
export function resolveAmmoRequirementForText(
  text: string,
): IWorkerRequirement | undefined {
  for (const [category, officialKey] of Object.entries(CATEGORY_TO_OFFICIAL)) {
    if (category && text.includes(category)) {
      return OFFICIAL_AMMO[officialKey]?.workerRequirement;
    }
  }
  for (const ammo of DYNAMIC_AMMO_POOL.values()) {
    const aliases = ammo.holographic?.aliases;
    if (aliases && aliases.some((a) => text.includes(a))) {
      return ammo.workerRequirement;
    }
  }
  return undefined;
}
