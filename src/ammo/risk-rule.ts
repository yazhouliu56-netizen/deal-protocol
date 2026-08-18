/**
 * 弹药属性表 · 风控引信（C5）— 勾选即生效的规则开关。
 * 底座 risk 模块按此表决定启用哪些探针；新增风控规则先在此注册。
 */

export type RiskRuleName =
  | "anti-self-boost" // 防自刷（分享/回应计数按人去重）
  | "roam-guard" // 多开风控（同设备多身份）
  | "home-access-verification" // 进家品类实名硬门槛
  | "publish-fee-quota" // 发布费 + 每日免费配额
  | "age-required"; // 未成年人分级模式（儿童监护人同意 + 青少年资金闸）

export interface RiskRule {
  rule: RiskRuleName;
  enabled: boolean;
  /** 规则参数，如 roam 阈值 / 免费配额数 / 业务词表（string[]）。 */
  params?: Record<string, number | string | boolean | string[]>;
}

/** 全局引信表 — 所有弹药共享；业务类目级覆盖见 CATEGORY_RISK。 */
export const GLOBAL_RISK_RULES: RiskRule[] = [
  { rule: "anti-self-boost", enabled: true },
  { rule: "roam-guard", enabled: true, params: { freeBindings: 1, warnThreshold: 2, freezeThreshold: 3 } },
  {
    rule: "home-access-verification",
    enabled: true,
    // 进家/上门类目词表（弹药装填，底座仅做通用词表匹配）
    params: { homeAccessKeywords: ["家政", "保洁", "厨师", "上门", "陪诊", "按摩", "遛狗"] },
  },
  { rule: "publish-fee-quota", enabled: true, params: { freePerDay: 3, publishFee: 2 } },
  // §未成年人网络保护条例(2024) — 平台默认开启未成年人分级保护（宪法 #8 血液规则）
  { rule: "age-required", enabled: true, params: { guardianConsentUnder14: true, moneyActionBlockedUnder18: true } },
];

/** 类目级覆盖（可配风险偏好差异：如高风险类目开启更严引信）。 */
export const CATEGORY_RISK: Record<string, RiskRuleName[]> = {
  "水电维修": ["home-access-verification"],
  "家政保洁": ["home-access-verification"],
  // Phase 3：遛狗需进门取狗，进家引信开启
  "遛狗遛弯": ["home-access-verification"],
  // 成人专属/涉险类目：需成年才能参与（弹药化 age-required 引信）
  "夜骑巡航": ["age-required"],
  "夜爬登山": ["age-required"],
};

export function riskRulesFor(category: string): RiskRule[] {
  const extra = CATEGORY_RISK[category] ?? [];
  const names = new Set<RiskRuleName>([...extra]);
  return GLOBAL_RISK_RULES.map((r) =>
    names.has(r.rule) ? { ...r, enabled: true } : r
  );
}

export function isRuleEnabled(rules: RiskRule[], name: RiskRuleName): boolean {
  return rules.find((r) => r.rule === name)?.enabled ?? false;
}

/**
 * 进家/上门类目词表（home-access 引信参数，弹药装填）。
 * 底座 sentinel 探针只做通用词表匹配，具体业务词在此声明。
 *
 * 键 = 弹药类目键（housekeeping 等英文键）与中文类目名（家政保洁/遛狗遛弯…）。
 * 弹药层（housekeeping.ammo 等）与上层调用方经此映射显式装填词表；
 * 命中 MAP 即返回专属词表，未命中回落引信参数（GLOBAL_RISK_RULES 全局表），
 * 均未配置时回落空数组（零注入 → 零业务词，底座零加权）。
 */
export const HOME_ACCESS_KEYWORDS_MAP: Record<string, string[]> = {
  housekeeping: ["保洁", "上门", "入户", "打扫", "做卫生", "擦玻璃", "家政"],
  "家政保洁": ["保洁", "上门", "入户", "打扫", "做卫生", "擦玻璃", "家政"],
  "厨师 · 上门做饭": ["厨师", "上门", "做饭"],
  "遛狗遛弯": ["遛狗", "上门"],
  "水电维修": ["上门", "入户", "维修"],
  "陪诊陪护": ["陪诊", "陪护", "上门"],
  "按摩推拿": ["按摩", "上门"],
};

export function homeAccessKeywordsFor(category: string): string[] {
  const mapped = HOME_ACCESS_KEYWORDS_MAP[category];
  if (Array.isArray(mapped) && mapped.length > 0) return mapped;
  const rules = riskRulesFor(category);
  const params = rules.find((r) => r.rule === "home-access-verification")?.params;
  const list = params?.homeAccessKeywords;
  return Array.isArray(list) ? list : [];
}
