import type { MatchResult, ProviderItem } from "./chat/types";

/**
 * M6 matchmaking: pure, unit-testable provider scoring.
 * Weighted dimensions (total 100):
 *   budget (25) + level (20) + style (20) + rating (15) + distance (10) + availability (10)
 * Missing dimensions get a neutral mid-score so sorting stays meaningful.
 */

export interface MatchNeed {
  level?: string | null;
  budget?: string | null;
  style?: string | null;
  area?: string | null;
  /** Selected timeslot id — drives per-provider availability. */
  slotId?: string | null;
  /** Provider bench accepting orders now (offline providers drop availability). */
  online?: boolean;
  /** Group size — venues get a bonus for hosting larger groups. */
  partySize?: number | null;
}

export type MatchedProvider = ProviderItem & {
  match: MatchResult;
  /** Per-dimension score breakdown for the "评分详情" panel. */
  breakdown: ScoreBreakdown;
  /** Whether this provider can serve the selected timeslot. */
  availability: "可约" | "本时段不可约" | "全时段可约" | "已下线";
};

export interface ScoreBreakdown {
  budget: number;
  level: number;
  style: number;
  rating: number;
  distance: number;
  availability: number;
}

const LEVEL_ORDER_CN: Record<string, number> = {
  新手: 1,
  业余: 2,
  进阶: 3,
};

const LEVEL_ORDER_EN: Record<string, number> = {
  newbie: 1,
  amateur: 2,
  advanced: 3,
};

const BADGE_BY_SCORE: Array<[number, MatchResult["badge"]]> = [
  [80, "极高匹配"],
  [65, "高匹配"],
  [50, "中等"],
  [0, "待考虑"],
];

export function badgeOf(score: number): MatchResult["badge"] {
  for (const [threshold, badge] of BADGE_BY_SCORE) {
    if (score >= threshold) return badge;
  }
  return "待考虑";
}

/** Extract the first number from a budget string like "单次 50 元以内". */
export function budgetNumber(budget?: string | null): number | null {
  const m = budget?.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

/** Resolve a user area string to a max distance in km ("附近 5 公里" → 5, "就近" → 3). */
export function areaDistanceKm(area?: string | null): number | null {
  if (!area) return null;
  const m = area.match(/附近\s*(\d+(?:\.\d+)?)\s*公里/);
  if (m) return parseFloat(m[1]);
  if (/附近|周边|就近/.test(area)) return 3;
  // 常见区域名 → 估算距离（滨江/三里屯/市中心…）
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

function normalizeLevel(level?: string | null): string | null {
  if (!level) return null;
  const clean = level.replace(/水平$/, "");
  return LEVEL_ORDER_CN[clean] ? clean : null;
}

/** Larger groups are better served by venues (multiple courts/seats). */
function groupBonus(provider: ProviderItem, need: MatchNeed): number {
  if (!need.partySize || need.partySize < 4) return 0;
  if (provider.kind === "venue") return 2;
  return 0;
}

export function scoreProvider(
  provider: ProviderItem,
  need: MatchNeed
): { score: number; breakdown: ScoreBreakdown } {
  let budget = 0;
  let level = 0;
  let style = 0;
  let rating = 0;
  let distance = 0;
  let availability = 0;

  // Budget (0-25): within +15% → full; within +50% → half; else none.
  const budgetNeed = budgetNumber(need.budget);
  const base = provider.basePrice;
  if (budgetNeed && base) {
    if (base <= budgetNeed * 1.15) budget = 25;
    else if (base <= budgetNeed * 1.5) budget = 12;
  } else if (budgetNeed && !base) {
    budget = 12; // no price info: partial credit
  } else {
    budget = 15; // no budget given: neutral
  }

  // Level (0-20): venues are level-agnostic; others match the user tier.
  const needLevel = normalizeLevel(need.level);
  if (provider.kind === "venue") {
    level = 10;
  } else if (provider.level && needLevel) {
    const dist = Math.abs(
      LEVEL_ORDER_EN[provider.level] - LEVEL_ORDER_CN[needLevel]
    );
    level = dist === 0 ? 20 : dist === 1 ? 14 : 4;
  } else if (provider.level) {
    level = 16; // user level unknown: full-ish credit
  } else {
    level = 10;
  }

  // Style (0-20): exact style match wins; mismatch penalised.
  if (need.style) {
    style = provider.styleTag === need.style ? 20 : 4;
  } else {
    style = 12;
  }

  // Rating (0-15): always contributes.
  rating = (provider.rating / 5) * 15;

  // Distance (0-10): closer to the user's area wins.
  const maxKm = areaDistanceKm(need.area);
  const km = provider.distanceKm;
  if (km != null && maxKm != null) {
    distance = km <= maxKm * 0.5 ? 10 : km <= maxKm ? 6 : 2;
  } else {
    distance = 5; // no distance info on either side: neutral
  }

  // Availability (0-10): can the provider serve this slot, AND is it online?
  const free = provider.freeSlots;
  const slotFree = !need.slotId || !free || free.includes(need.slotId);
  const online = need.online ?? true;
  if (!slotFree || !online) {
    availability = 0;
  } else {
    availability = 10;
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        budget +
          level +
          style +
          rating +
          distance +
          availability +
          groupBonus(provider, need)
      )
    )
  );
  return {
    score,
    breakdown: {
      budget: Math.round(budget),
      level: Math.round(level),
      style: Math.round(style),
      rating: Math.round(rating),
      distance: Math.round(distance),
      availability: Math.round(availability),
    },
  };
}

export function matchProviders(
  providers: ProviderItem[],
  need: MatchNeed
): MatchedProvider[] {
  return providers
    .map((provider) => {
      const { score, breakdown } = scoreProvider(provider, need);
      const free = provider.freeSlots;
      const slotFree = !need.slotId || !free || free.includes(need.slotId);
      const online = need.online ?? true;
      const starred = free && !slotFree;
      const availability = starred
        ? "本时段不可约"
        : !online && provider.kind !== "venue"
          ? "已下线"
          : free && need.slotId
            ? "可约"
            : "全时段可约";
      return {
        ...provider,
        match: { score, badge: badgeOf(score) },
        breakdown,
        availability,
      } satisfies MatchedProvider;
    })
.sort(
      (a, b) =>
        b.match.score - a.match.score ||
        b.rating - a.rating ||
        (a.distanceKm ?? Number.POSITIVE_INFINITY) -
          (b.distanceKm ?? Number.POSITIVE_INFINITY)
    );
}
