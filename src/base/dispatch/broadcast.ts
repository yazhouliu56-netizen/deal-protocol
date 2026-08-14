/**
 * Broadcast matching — who should receive this demand ("谁合适谁来").
 *
 * Pure + unit-testable. Uses the same area→km heuristics as `match.ts`, but
 * swaps the weights towards what P2P broadcasting cares about (derived from
 * the 闲鱼/邻里 benchmark — 2km interaction peaks):
 *
 *   distance  (30) — weight was 10 in the provider path; local-first here
 *   custom    (25)  — how many custom conditions this responder covers
 *   credit    (30)  — reputation level (+ verification bonus)
 *
 * Hard filters (basic needs only, per product decision):
 *   - category: responder must declare it in capabilities
 *   - distance: beyond the wave's radius → excluded
 *   - online: responder must be accepting
 *
 * Custom conditions are soft (只提醒): responders with zero overlap still
 * appear, just ranked lower.
 *
 * NOTE: keeps zero runtime relative imports so `node --experimental-strip-types`
 * can run the tests directly (Next forbids `.ts` import suffixes; match.ts
 * gets away with it by using type-only imports only).
 */

export interface ResponderCapability {
  id: string;
  /** Display name (anonymous mask via identity layer). */
  nickname: string;
  /** Service categories, e.g. ["厨师 · 上门做饭", "羽毛球"]. */
  categories: string[];
  /** Capability tags — matched against custom condition keywords. */
  tags: string[];
  distanceKm?: number;
  rating?: number;
  /** 1-5 credit tier; 5 = top. */
  creditLevel?: number;
  /** Airtasker-style star level (1-5, from recent review mean). */
  star?: number;
  /** Completion rate 0-1 (fulfilled vs breached, last 20 claims). */
  completion?: number;
  /** Banned by moderation — hard-gated out of feeds and pushes. */
  banned?: boolean;
  verified?: boolean;
  online: boolean;
}

export interface WaveLike {
  id: string;
  basics: {
    category: string;
    time: string;
    area: string;
    radiusKm: number;
  };
  customs?: Array<{ text: string; tags?: string[] }>;
}

export interface BroadcastHit extends ResponderCapability {
  /** 0-100 fit score (orders the radar feed). */
  score: number;
  customHits: number;
  customTotal: number;
  reason: string;
}

/** Area string → max distance km. Mirrors `match.ts`'s areaDistanceKm. */
export function areaToKm(area: string): number | null {
  const m = area.match(/附近\s*(\d+(?:\.\d+)?)\s*公里/);
  if (m) return parseFloat(m[1]);
  if (/附近|周边|就近/.test(area)) return 3;
  const known: Array<[RegExp, number]> = [
    [/市中心|CBD|步行街|商圈/i, 2],
    [/三里屯|太古里|体育中心|会展中心/i, 4],
    [/滨江|朝阳|天河|静安|南山/i, 5],
    [/西湖|湖滨|河畔|江边|海沧/i, 6],
    [/大学城|产业园|科技园/i, 7],
    [/机场|郊区|工业区/i, 12],
  ];
  for (const [re, km] of known) {
    if (re.test(area)) return km;
  }
  return null;
}

const CREDIT_MAX = 5;

/** 分发规则结构（与 ammo/dispatch-rule 的 DispatchRule 结构兼容；缺省 = 需求局默认）。 */
export interface BroadcastRule {
  weights: {
    distance: number;
    credit: number;
    custom: number;
    verifiedBonus: number;
  };
  hardGates: {
    requiresVerified?: string[];
    banned?: boolean;
    online?: boolean;
  };
  starBonus?: { starMin: number; completionMin: number; bonus: number };
}

/** 缺省规则 = 现状常量（等价 ammo DEFAULT_DISPATCH）。 */
export const DEFAULT_BROADCAST_RULE: BroadcastRule = {
  weights: { distance: 30, credit: 30, custom: 25, verifiedBonus: 5 },
  hardGates: {
    requiresVerified: ["陪诊陪护", "家政保洁", "厨师", "上门"],
    banned: true,
    online: true,
  },
  starBonus: { starMin: 4, completionMin: 0.9, bonus: 5 },
};

/** Loose keyword overlap — "30 岁左右女性" hits a tag like "女性"/"熟手". */
export function tagsOverlap(a: string[], b: string[]): number {
  let hits = 0;
  for (const x of b) {
    if (a.some((t) => t.includes(x) || x.includes(t))) hits += 1;
  }
  return hits;
}

/**
 * 进家高风险品类（对标 Care.com/Thumbtack：面对面+进家门 → 必须先实名验证）。
 * 由 ammo/dispatch-rule 的 hardGates.requiresVerified 驱动（弹药表可配）。
 * 未 verified 的响应者无法接这些单 —— 硬门槛而非加分项。
 */
export function requiresVerification(
  category: string,
  rule: BroadcastRule = DEFAULT_BROADCAST_RULE
): boolean {
  return (rule.hardGates.requiresVerified ?? []).some((k) => category.includes(k));
}

/** Hard gate: does this responder's capability cover the wave at all? */
export function passesHardFilter(
  r: ResponderCapability,
  wave: WaveLike,
  rule: BroadcastRule = DEFAULT_BROADCAST_RULE
): { ok: boolean; why?: string } {
  if (rule.hardGates.online !== false && !r.online) {
    return { ok: false, why: "offline" };
  }
  if (rule.hardGates.banned !== false && r.banned) {
    return { ok: false, why: "banned" };
  }
  if (requiresVerification(wave.basics.category, rule) && !r.verified) {
    return { ok: false, why: "unverified" };
  }
  const cat = wave.basics.category;
  const categoryHit = r.categories.some(
    (c) => c === cat || c.includes(cat) || cat.includes(c)
  );
  if (!categoryHit) {
    return { ok: false, why: "category-miss" };
  }
  // 距离是软约束：超远仍可见但排后面（distance weight 已在 score 惩罚）。
  return { ok: true };
}

/**
 * Rank which responders should receive a broadcast — hard-filtered first,
 * then scored. Returns [] when nobody qualifies.
 */
export function broadcastMatches(
  responders: ResponderCapability[],
  wave: WaveLike,
  rule: BroadcastRule = DEFAULT_BROADCAST_RULE
): BroadcastHit[] {
  const customs = wave.customs ?? [];
  const customTags = customs.flatMap((c) => c.tags ?? []);
  const maxKm = areaToKm(wave.basics.area) ?? wave.basics.radiusKm;
  const { distance: DISTANCE_WEIGHT, credit: CREDIT_WEIGHT, custom: CUSTOM_WEIGHT, verifiedBonus: VERIFIED_BONUS } = rule.weights;
  const star = rule.starBonus ?? DEFAULT_BROADCAST_RULE.starBonus!;

  return responders
    .filter((r) => passesHardFilter(r, wave, rule).ok)
    .map((r) => {
      const customTotal = customs.length;
      const customHits = tagsOverlap(r.tags, customTags);
      // Neutral credit when no customs at all (nothing to prove).
      const customScore =
        customTotal === 0
          ? CUSTOM_WEIGHT
          : (customHits / customTotal) * CUSTOM_WEIGHT;

      const credit =
        ((r.creditLevel ?? 3) / CREDIT_MAX) * CREDIT_WEIGHT +
        // Star growth bonus: ★≥x + ≥y% completion → +bonus (ammo 可配).
        (r.star && r.star >= star.starMin && (r.completion ?? 1) >= star.completionMin
          ? star.bonus
          : 0);
      const verifiedBonus = r.verified ? VERIFIED_BONUS : 0;

      const km = r.distanceKm ?? (maxKm > 0 ? maxKm * 0.6 : 3);
      let distance: number;
      if (maxKm > 0) {
        distance =
          km <= maxKm * 0.5
            ? DISTANCE_WEIGHT
            : km <= maxKm
              ? 18
              : 6;
      } else {
        distance = 15;
      }

      const raw = customScore + distance + (credit + verifiedBonus);
      const score = Math.max(0, Math.min(100, Math.round(raw)));

      return {
        ...r,
        score,
        customHits,
        customTotal,
        reason:
          customHits > 0
            ? `可覆盖 ${customHits}/${customTotal} 项定制`
            : customTotal > 0
              ? "未覆盖定制项，可磋商"
              : "基础需求可直接响应",
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.customHits - a.customHits ||
        (a.distanceKm ?? 99) - (b.distanceKm ?? 99)
    );
}