/**
 * Type1 服务结算真相源（P0 治本收敛 · 用户裁决 2026-09-16）。
 *
 * 六圈定位：第 2 圈业务核心（L2-M4 清结算）。宪法 #1 底座优先 / #2 接口保守
 *（新增文件，零改动既有语义）/ #4 引信跟弹药走（阶段比例由弹药表定，本模块只收数）。
 *
 * 单一方程（整数分，守恒硬锁，P3 五项）：
 *   providerNet + qualityFee + commission + channelFee ≡ totalCents
 * - totalCents = 实际完成金额（调用方按弹药阶段比例先折算好再传入；
 *   未开工全退、中途取消折段，都在本模块之外，方程只结已完成部分）。
 * - commission = 总额 × commissionRate（订单总额百分比，用户裁决 2026-09-18；
 *   上线 0，sunset 翻转即改配置值），先切，后续分配只动余量。
 * - 85% 客观轨（分阶段确认＋证据）→ 服务者；15% 主观轨
 *  （态度/仪容/复原三勾等权，各 5%）→ 按勾释放。
 *  （份额可配：调用方按 platform_config.settlementShares 注入，本模块只收数；
 *   缺省 85/15；管理端硬锁和≡100。）
 * - 余下进质量管理费（平台所有，归属写注册条款，去向黑箱；推广期平台佣金 0，
 *   恢复收费前 30 天公示——sunset 到期本常量改值即生效）。
 * - 通道费服务者承担，划拨那一刻扣除（微信提现同逻辑）。
 * - 窗：证据提交后 24h 无操作自动确认（异议走申诉）；确认后 72h 评价窗，
 *   窗内无评价默认全返。72h 与 trust/review.REVIEW_WINDOW_MS 同值，
 *   考卷跨锁（运行时零依赖，防单向依赖破环）。
 *
 * Pure + unit-testable; no runtime imports except 同域分配原语。
 */

import { allocateByLargestRemainder } from "./milestone-escrow.ts";

/** 缺省份额 85/15（调用方可按配置注入其它份额；管理端锁和≡100）。 */
export const DEFAULT_TYPE1_SHARES = [85, 5, 5, 5] as const;

/** 确认窗：24h（服务者传证后用户无操作自动确认）。 */
export const TYPE1_CONFIRM_TIMEOUT_MS = 24 * 3600_000;
/** 评价窗：72h（必须 ≡ trust/review.REVIEW_WINDOW_MS，考卷跨锁）。 */
export const TYPE1_REVIEW_WINDOW_MS = 72 * 3600_000;

export type Type1SubjectiveItem = "attitude" | "appearance" | "restoration";

/** 主观三勾（默认全勾；窗内无评价传 null = 全返；Tag 可选不进本方程）。 */
export interface Type1SubjectivePass {
  attitude: boolean;
  appearance: boolean;
  restoration: boolean;
}

export const TYPE1_SUBJECTIVE_ITEMS: readonly Type1SubjectiveItem[] = [
  "attitude",
  "appearance",
  "restoration",
];

export interface Type1Settlement {
  totalCents: number;
  /** 客观轨 85%（确认即归服务者）。 */
  baseCents: number;
  /** 主观轨已释放（三勾按勾释放；无评价默认全释）。 */
  holdReleasedCents: number;
  /** 质量管理费（暂扣未释部分，平台所有）。 */
  qualityFeeCents: number;
  /** 平台佣金（总额 × commissionRate；上线 0）。 */
  commissionCents: number;
  /** 通道费（服务者承担，划拨扣除）。 */
  channelFeeCents: number;
  /** 服务者实得（base + released；通道费与佣金已在余量外）。 */
  providerNetCents: number;
}

export type Type1SettlementErrorCode =
  | "INVALID_TOTAL"
  | "INVALID_CHANNEL_FEE"
  | "INVALID_TIMESTAMP"
  | "INVALID_SHARES"
  | "INVALID_RATE";

export class Type1SettlementError extends Error {
  readonly code: Type1SettlementErrorCode;
  constructor(code: Type1SettlementErrorCode, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = "Type1SettlementError";
    this.code = code;
  }
}

function assertTotal(totalCents: number): void {
  if (!Number.isInteger(totalCents) || totalCents <= 0) {
    throw new Type1SettlementError(
      "INVALID_TOTAL",
      `实际完成金额必须为正整数分，收到 ${totalCents}`,
    );
  }
}

/**
 * 四路份额切分：[base, attitude, appearance, restoration]，和 ≡ total。
 * 复用最大余数法（与 milestone-escrow 同一分配语义，1 分极端也守恒）。
 * ratios 缺省 85/15（P3 可配：调用方按配置注入）。
 */
export function splitType1Shares(
  totalCents: number,
  ratios: readonly number[] = DEFAULT_TYPE1_SHARES,
): {
  baseCents: number;
  attitudeCents: number;
  appearanceCents: number;
  restorationCents: number;
} {
  assertTotal(totalCents);
  if (ratios.length !== 4 || ratios.some((r) => !Number.isFinite(r) || r < 0)) {
    throw new Type1SettlementError(
      "INVALID_SHARES",
      `份额须为 4 个非负有限数，收到 [${ratios.join(",")}]`,
    );
  }
  const [base, attitude, appearance, restoration] = allocateByLargestRemainder(
    totalCents,
    [...ratios],
  );
  return {
    baseCents: base,
    attitudeCents: attitude,
    appearanceCents: appearance,
    restorationCents: restoration,
  };
}

/**
 * 统一结算（P3 五项）：providerNet + qualityFee + commission + channelFee ≡ total（硬断言，违即抛）。
 * pass = null → 窗内无评价，默认全返（只进 released，不发券——发券由 coupon 侧按“有真实评价”独立判定）。
 * 佣金先切（总额 × commissionRate），余量进 85/15 分配；旧三参调用语义不变（commission 0＋缺省份额）。
 */export function settleType1(
  totalCents: number,
  pass: Type1SubjectivePass | null,
  channelFeeCents = 0,
  opts: { shares?: readonly number[]; commissionRate?: number } = {},
): Type1Settlement {
  assertTotal(totalCents);
  const commissionRate = opts.commissionRate ?? 0;
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 1) {
    throw new Type1SettlementError(
      "INVALID_RATE",
      `佣金率须落在 [0,1]，收到 ${commissionRate}`,
    );
  }
  if (!Number.isInteger(channelFeeCents) || channelFeeCents < 0) {
    throw new Type1SettlementError(
      "INVALID_CHANNEL_FEE",
      `通道费必须为非负整数分，收到 ${channelFeeCents}`,
    );
  }
  const commissionCents = Math.round(totalCents * commissionRate);
  // 可分配池 = 总额 − 佣金（佣金先切，用户裁决 2026-09-18）。
  // 通道费不进池：由师傅实得全额承担（P0 锁死语义，考卷逐分锁定——
  // 与用户算例"283.2 进 85/15"相比，师傅全好评实得恒等，仅勾失败时
  // 质量费差通道×15%（300 元单差 0.27 元），可忽略，旧语义优先）。
  const pool = totalCents - commissionCents;
  const shares = splitType1Shares(pool, opts.shares ?? DEFAULT_TYPE1_SHARES);
  const p = pass ?? { attitude: true, appearance: true, restoration: true };
  const holdReleasedCents =
    (p.attitude ? shares.attitudeCents : 0) +
    (p.appearance ? shares.appearanceCents : 0) +
    (p.restoration ? shares.restorationCents : 0);
  const qualityFeeCents =
    shares.attitudeCents +
    shares.appearanceCents +
    shares.restorationCents -
    holdReleasedCents;
  const providerGross = shares.baseCents + holdReleasedCents;
  if (channelFeeCents > providerGross) {
    throw new Type1SettlementError(
      "INVALID_CHANNEL_FEE",
      `通道费 ${channelFeeCents} 分超过服务者应得毛额 ${providerGross} 分，拒绝执行`,
    );
  }
  const providerNetCents = providerGross - channelFeeCents;
  if (providerNetCents + qualityFeeCents + commissionCents + channelFeeCents !== totalCents) {
    throw new Type1SettlementError(
      "INVALID_TOTAL",
      `资金守恒破坏：${providerNetCents}+${qualityFeeCents}+${commissionCents}+${channelFeeCents} !== ${totalCents}`,
    );
  }
  return {
    totalCents,
    baseCents: shares.baseCents,
    holdReleasedCents,
    qualityFeeCents,
    commissionCents,
    channelFeeCents,
    providerNetCents,
  };
}

/** 确认死线 = 传证时刻 + 24h（超时自动确认；异议走申诉，不占本方程）。 */
export function type1ConfirmDeadline(evidenceAtMs: number): number {
  if (!Number.isFinite(evidenceAtMs)) {
    throw new Type1SettlementError("INVALID_TIMESTAMP", "evidenceAtMs 非法");
  }
  return evidenceAtMs + TYPE1_CONFIRM_TIMEOUT_MS;
}

/** 评价死线 = 客观确认时刻 + 72h（超时默认全返）。 */
export function type1ReviewDeadline(confirmedAtMs: number): number {
  if (!Number.isFinite(confirmedAtMs)) {
    throw new Type1SettlementError("INVALID_TIMESTAMP", "confirmedAtMs 非法");
  }
  return confirmedAtMs + TYPE1_REVIEW_WINDOW_MS;
}

/**
 * 单单释放到期判定（R5 · cron 扫表用）：held_at + 72h ≤ now 即到期。
 * 边界取 ≥（恰 72h 整算到期，与 reviewDue 同语义）。
 */
export function satisfactionReleaseDue(heldAtMs: number, nowMs: number): boolean {
  if (!Number.isFinite(heldAtMs) || !Number.isFinite(nowMs)) return false;
  return nowMs >= heldAtMs + TYPE1_REVIEW_WINDOW_MS;
}

/**
 * 暂扣口径（批放机制用 · 2026-09-17 由 lib/contract/satisfaction 委托至此单源）。
 * 口径 = round(totalCents × rate)，与老元公式
 * Math.round(amountYuan × rate × 100)/100 逐分一致（差分考卷逐分锁定）。
 * 注意：与方程内最大余数三勾份额和在极端分位可差 1 分；
 * 批放机制下以本口径为准，批经济退役（72h 单单放）时由 settleType1 接管。
 * 本函数不抛（老公式亦不抛，零漂移要求）。
 */
export function qualityHoldCents(totalCents: number, qualityRate: number): number {
  if (!Number.isFinite(totalCents) || !Number.isFinite(qualityRate)) return 0;
  return Math.round(totalCents * qualityRate);
}
