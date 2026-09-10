/**
 * 磋商桌纯规则（P3-T1）。
 * 均值口径＝同单各 claim 报价均值（真实数据，不编造；无报价回落 null，警示条静默）。
 * 三档话术：爽快（接受现价）/小让（-5%）/守底（均值，无均值则守预算）。
 * AI 只建议不代按：发送必须人点（组件侧保证）。
 * Pure + unit-testable; no runtime imports.
 */
import { MAX_ROUNDS } from "./wave.ts";
import type { IntentCard as IntentCardData } from "../../types/intent-card.ts";

export type HaggleTier = "quick" | "small" | "hold";

export interface HaggleOption {
  tier: HaggleTier;
  label: string;
  priceYuan: number;
  message: string;
}

/** 同单报价均值（取整；无有效报价→null）。 */
export function meanOfQuotes(prices: (number | undefined)[]): number | null {
  const valid = prices.filter((p): p is number => typeof p === "number" && Number.isFinite(p) && p > 0);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((s, p) => s + p, 0) / valid.length);
}

/** 价格合理性：高于均值 20% 警示（无均值→不警示）。 */
export function describeFairness(
  quoteYuan: number,
  meanYuan: number | null,
): { ratio: number | null; warn: boolean } {
  if (meanYuan === null || meanYuan <= 0 || !Number.isFinite(quoteYuan) || quoteYuan <= 0) {
    return { ratio: null, warn: false };
  }
  const ratio = quoteYuan / meanYuan;
  return { ratio, warn: ratio > 1.2 };
}

/** 三档还价选项（纯算术，不含经济主张）。 */
export function buildHaggleOptions(quoteYuan: number, meanYuan: number | null, budgetYuan: number): HaggleOption[] {
  const q = Math.max(1, Math.floor(quoteYuan));
  const floor = meanYuan !== null && meanYuan > 0 ? Math.floor(meanYuan) : Math.max(1, Math.floor(budgetYuan));
  const small = Math.max(1, Math.round(q * 0.95));
  return [
    { tier: "quick", label: "爽快拿下", priceYuan: q, message: "行，就按这个价定你了" },
    { tier: "small", label: "小让 5%", priceYuan: small, message: `便宜 ${q - small} 块就定你` },
    { tier: "hold", label: "守底价", priceYuan: floor, message: `我预算就 ${floor}，能接就接` },
  ];
}

/** 还可还价（3 轮上限，MAX_ROUNDS 单源）。 */
export function canHaggle(rounds: number): boolean {
  return Number.isFinite(rounds) && rounds >= 0 && rounds < MAX_ROUNDS;
}

/**
 * T2 磋商确认卡适配（与 L1 同构件）：仅改价（price≠budget）时产卡；
 * 未改价/无价回落 null（原价走既有谈成按钮，不添乱）。
 */
export function claimToHaggleCard(
  claim: { id: string; price?: number; responderId: string },
  wave: { id: string; budget: number; basics: { time: string; category: string } },
  now = Date.now(),
): IntentCardData | null {
  const price = claim.price;
  if (!price || !Number.isFinite(price) || price <= 0 || price === wave.budget) return null;
  const delta = price - wave.budget;
  return {
    id: `haggle-${claim.id}`,
    scene: { ammoId: "haggle", version: 0 },
    title: `与服务者·${claim.responderId.slice(-4)}谈成`,
    lines: [
      {
        key: "price",
        label: "谈成价",
        value: delta !== 0 ? `¥${price}（较预算${delta > 0 ? "＋" : "−"}¥${Math.abs(delta)}）` : `¥${price}`,
        source: "user",
        editable: true as const,
      },
    ],
    price: {
      totalYuan: price,
      basis: "quote",
      changeRule: "确认后锁价，现场加项需你点确认才加钱",
      refundRule: "师傅未上门全额退",
    },
    assurance: [{ key: "lock", label: "锁价" }],
    irreversible: ["双方确认后派单生效"],
    aiMarks: [{ lineKey: "price", level: "mid", reason: "多轮磋商价" }],
    state: "ready",
    expiresAt: now + 15 * 60_000,
    traceId: `intent-haggle-${claim.id}`,
  };
}
