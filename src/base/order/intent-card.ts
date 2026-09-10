/**
 * 意图卡纯函数（P1-T2）。母本：意图卡开工规格 v1.0 §1/§8 考卷 1-4。
 * Pure + unit-testable; no runtime imports.
 */
import type {
  AiLevel,
  IntentCard,
  IntentCardState,
  IntentLine,
  PriceAnchor,
} from "../../types/intent-card.ts";

export const INTENT_READY_TTL_MS = 15 * 60_000;
export const AI_GUESS_BELOW = 0.6;
export const AI_HIGH_ABOVE = 0.85;

export function aiLevelOf(confidence: number): AiLevel {
  if (confidence >= AI_HIGH_ABOVE) return "high";
  if (confidence >= AI_GUESS_BELOW) return "mid";
  return "guess";
}

/** 考卷1：价格三要素＋不可逆点缺一不可发射（空串亦拦）。 */
export function assertPriceComplete(price: PriceAnchor, irreversible: string[]): void {
  if (!Number.isFinite(price.totalYuan) || price.totalYuan <= 0) {
    throw new Error("intent-card: totalYuan 非法");
  }
  if (!price.changeRule.trim() || !price.refundRule.trim()) {
    throw new Error("intent-card: 差价/退款规则缺失");
  }
  if (irreversible.length === 0 || irreversible.some((s) => !s.trim())) {
    throw new Error("intent-card: 不可逆点清单缺失");
  }
}

/** 考卷2：用户值永远压过 AI 值；同 key 取 source 优先级 user > ai > default。 */
const SOURCE_RANK: Record<IntentLine["source"], number> = { user: 2, ai: 1, default: 0 };

export function mergeIntentLines(prev: IntentLine[], patch: IntentLine[]): IntentLine[] {
  const map = new Map<string, IntentLine>();
  for (const l of [...prev, ...patch]) {
    const cur = map.get(l.key);
    if (!cur || SOURCE_RANK[l.source] >= SOURCE_RANK[cur.source]) map.set(l.key, l);
  }
  return [...map.values()];
}

/** 状态机跃迁守卫：stale 不可达 locked；locked 终态。 */
const LEGAL: Record<IntentCardState, IntentCardState[]> = {
  assembling: ["ready", "stale"],
  ready: ["locked", "stale", "assembling"],
  locked: [],
  stale: ["assembling"],
};

export function canTransition(from: IntentCardState, to: IntentCardState): boolean {
  return LEGAL[from].includes(to);
}

export function isStale(card: Pick<IntentCard, "state" | "expiresAt">, now = Date.now()): boolean {
  return card.state !== "locked" && now > card.expiresAt;
}

/**
 * 考卷4：LLM 空回默认卡——仍含完整 PriceAnchor（底价由调用方按 D2 SSOT 注入）。
 */
export function defaultIntentCard(input: {
  id: string;
  title: string;
  floorYuan: number;
  now?: number;
}): IntentCard {
  const now = input.now ?? Date.now();
  const floor = Number.isFinite(input.floorYuan) && input.floorYuan > 0 ? Math.floor(input.floorYuan) : 1;
  return {
    id: input.id,
    scene: { ammoId: "generic", version: 0 },
    title: input.title,
    lines: [],
    price: {
      totalYuan: floor,
      basis: "ammo-floor",
      changeRule: "现场加项需你点确认才加钱",
      refundRule: "师傅未上门全额退",
    },
    assurance: [{ key: "lock", label: "锁价" }],
    irreversible: ["确认发射后即进入派单，师傅接单后取消按规则扣款"],
    aiMarks: [],
    state: "assembling",
    expiresAt: now + INTENT_READY_TTL_MS,
    traceId: `intent-${input.id}`,
  };
}
