/**
 * 发现推荐动态化（B4 · 行为驱动的兴趣匹配，用户拍板）。
 *
 * 军规：发现推荐＝概率猜测，推错零成本（划过）。可履约/资质门禁住在
 * 匹配派单阶段，不住这里。本模块只做三件事：
 * 1. 胶囊排序：新用户（有效行为 < 3）图纸教育序；老用户复购优先；
 * 2. 先验衰减（B5 并入）：先验权重随行为稀释，行为接管；
 * 3. 输入联想：前缀/包含匹配模板别名。
 * 推荐开关：默认开（optOut=false），可关；关＝永远图纸原序。
 * Pure + unit-testable; no runtime imports. 画像由调用方持久化
 *（localStorage `oto-discovery-v1`，见同目录 profile 注释）。
 */

export const DISCOVERY_COLD_BEHAVIORS = 3;

export interface DiscoveryProfile {
  /** 订单类目计数（复购真值；订单完成回路写入）。 */
  orderCounts: Record<string, number>;
  /** 胶囊点击计数（兴趣信号；首页点击写入）。 */
  pillClicks: Record<string, number>;
  /** 推荐开关（true＝关闭个性化，只走图纸序）。 */
  optOut: boolean;
}

export const EMPTY_PROFILE: DiscoveryProfile = {
  orderCounts: {},
  pillClicks: {},
  optOut: false,
};

/** 先验权重（B5）：max(0, 1 - behaviors/N)，N＝3（已拍）。 */
export function priorWeight(behaviorCount: number, n: number = DISCOVERY_COLD_BEHAVIORS): number {
  if (n <= 0) return 0;
  return Math.max(0, 1 - behaviorCount / n);
}

/** 有效行为数（订单＋点击；点击半权：兴趣≠复购）。 */
export function behaviorCountOf(profile: DiscoveryProfile): number {
  const orders = Object.values(profile.orderCounts).reduce((a, b) => a + b, 0);
  const clicks = Object.values(profile.pillClicks).reduce((a, b) => a + b, 0);
  return orders + clicks * 0.5;
}

export interface PillLike {
  ammoId: string;
  category: string;
}

/**
 * 胶囊排序（稳定排序，无记录保原序）：
 * - optOut → 图纸原序；
 * - 新用户（有效行为 < 3）→ featured 教育序（缺席回落保序）＋其余；
 * - 老用户 → 订单分×2＋点击分 降序，零分保原序。
 */
export function orderPills<T extends PillLike>(
  pills: T[],
  profile: DiscoveryProfile,
  featuredAmmoIds: string[],
): T[] {
  if (profile.optOut) return [...pills];
  const scoreOf = (p: T): number =>
    (profile.orderCounts[p.category] ?? 0) * 2 + (profile.pillClicks[p.category] ?? 0);
  if (behaviorCountOf(profile) < DISCOVERY_COLD_BEHAVIORS) {
    const rank = new Map(featuredAmmoIds.map((id, i) => [id, i]));
    return [...pills].sort((a, b) => (rank.get(a.ammoId) ?? 999) - (rank.get(b.ammoId) ?? 999));
  }
  return [...pills]
    .map((p, i) => ({ p, i, s: scoreOf(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p);
}

export interface SuggestEntry {
  alias: string;
  category: string;
  label: string;
}

/** 输入联想：前缀优先＋包含兜底，去重，限 N（默认 5）。空输入返回 []。 */
export function suggestByPrefix(
  input: string,
  entries: SuggestEntry[],
  limit = 5,
): SuggestEntry[] {
  const q = input.trim().toLowerCase();
  if (!q) return [];
  const starts: SuggestEntry[] = [];
  const contains: SuggestEntry[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const a = e.alias.toLowerCase();
    if (seen.has(e.category)) continue;
    if (a.startsWith(q)) {
      starts.push(e);
      seen.add(e.category);
    } else if (a.includes(q)) {
      contains.push(e);
      seen.add(e.category);
    }
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit);
}
