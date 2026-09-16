/**
 * Type2 组局保证金真相源（P0 治本收敛 · 用户裁决 2026-09-16）。
 *
 * 六圈定位：第 2 圈业务核心（L2 组局资金）。宪法 #1 底座优先 / #2 接口保守
 *（新增文件；trust.ts / meetup 钩子 / SOP 内存量冻结，老局走老路）。
 *
 * 模型锁死（平台只管人与人，不管人与店，二清归零）：
 * - A 类有消费局：保证金 = 人均 × 缓冲系数（默认 1.2x，发起人可调 1.0–1.5），
 *   不是餐费。发起人建单先付，参与者付同额冻结才算进局（已付名单）；
 *   线下各付各的，发起人传小票，完局 6h 异议窗，无异议自动解冻全退。
 * - B 类零消费局：单次 9.9 / 19.9 两档（发起人选档）；会员 99 池够额即
 *   免单次支付，直接冻额度。
 * - 免费取消线 6h（开局前 6h 免费退，之后退=扣）；迟到超 15min 扣一半，
 *   放鸽子全扣；扣款到场人平分（含组织者同权，不额外抽）。
 * - 累犯：月爽约 2 次下次翻倍，3 次翻倍＋停 7 天。
 * - 追收上限 = 对方冻结额，超了平台不垫（只记信用＋停服）。
 * - 全员爽约无接收人时，锅底进 unallocatedCents（调用方路由质量池），
 *   账上不许有黑洞。
 *
 * Pure + unit-testable; 时钟全部注入，零运行时导入。
 */

/** 免费取消线：开局前 6h。 */
export const TYPE2_FREE_CANCEL_MS = 6 * 3600_000;
/** 异议窗：完局后 6h（超时自动解冻）。 */
export const TYPE2_OBJECTION_MS = 6 * 3600_000;
/** 确认窗：24h 无操作自动确认。 */
export const TYPE2_CONFIRM_TIMEOUT_MS = 24 * 3600_000;
/** 迟到宽限：15min（超即扣一半，到场打卡由调用方验真传入）。 */
export const TYPE2_LATE_GRACE_MS = 15 * 60_000;

/** A 类缓冲系数：默认 1.2，发起人可调 1.0–1.5。 */
export const TYPE2_BUFFER_DEFAULT = 1.2;
export const TYPE2_BUFFER_MIN = 1.0;
export const TYPE2_BUFFER_MAX = 1.5;

/** B 类单次两档（分）。 */
export const TYPE2_B_TIERS_CENTS = [990, 1990] as const;
/** 会员押金池（分）。 */
export const TYPE2_MEMBER_POOL_CENTS = 9900;

/** 累犯线：2 次翻倍，3 次翻倍＋停 7 天。 */
export const TYPE2_DOUBLE_AT = 2;
export const TYPE2_SUSPEND_AT = 3;
export const TYPE2_SUSPEND_DAYS = 7;

export type Type2CancelTier = "free" | "forfeit";

export interface Type2Seat {
  userId: string;
  /** 冻结额（分，A 类为人均×系数，B 类为档位）。 */
  frozenCents: number;
  /** 到场（组织者点到＋定位验真后由调用方传入）。 */
  present: boolean;
  /** 迟到超 15min（到场但超时）。 */
  late: boolean;
}

export interface Type2Settlement {
  /** userId → 实退额（分， own 退回＋分锅）。 */
  refunds: Record<string, number>;
  /** 爽约锅总额（分，已全部分给到场人；无人到场则进 unallocated）。 */
  potCents: number;
  /** 无人到场时的无主锅（调用方路由质量池）。 */
  unallocatedCents: number;
}

export type Type2GuaranteeErrorCode =
  | "INVALID_AMOUNT"
  | "INVALID_BUFFER"
  | "INVALID_SEATS"
  | "INVALID_TIMESTAMP"
  | "CONSERVATION_VIOLATION";

export class Type2GuaranteeError extends Error {
  readonly code: Type2GuaranteeErrorCode;
  constructor(code: Type2GuaranteeErrorCode, message?: string) {
    super(message ? `[${code}] ${message}` : `[${code}]`);
    this.name = "Type2GuaranteeError";
    this.code = code;
  }
}

function assertCents(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Type2GuaranteeError("INVALID_AMOUNT", `${label}必须为正整数分，收到 ${value}`);
  }
}

/** A 类保证金 = 人均 × 系数（四舍五入到分）。 */
export function guaranteeForA(perHeadCents: number, buffer: number = TYPE2_BUFFER_DEFAULT): number {
  assertCents(perHeadCents, "人均");
  if (!Number.isFinite(buffer) || buffer < TYPE2_BUFFER_MIN || buffer > TYPE2_BUFFER_MAX) {
    throw new Type2GuaranteeError(
      "INVALID_BUFFER",
      `缓冲系数须落在 [${TYPE2_BUFFER_MIN}, ${TYPE2_BUFFER_MAX}]，收到 ${buffer}`,
    );
  }
  return Math.round(perHeadCents * buffer);
}

/** 取消档：开局 6h 前 free，其余（含已开始）forfeit。 */
export function type2CancelTier(startsAtMs: number, nowMs: number): Type2CancelTier {
  if (!Number.isFinite(startsAtMs) || !Number.isFinite(nowMs)) {
    throw new Type2GuaranteeError("INVALID_TIMESTAMP", "startsAt/now 非法");
  }
  return nowMs <= startsAtMs - TYPE2_FREE_CANCEL_MS ? "free" : "forfeit";
}

/**
 * 保证金结算（守恒硬锁：Σrefunds ＋ unallocated ≡ Σfrozen）。
 * 缺席全扣、迟到扣半，锅底到场人按索引序余数法平分（组织者同权）。
 */
export function settleType2Guarantees(seats: Type2Seat[]): Type2Settlement {
  if (!Array.isArray(seats) || seats.length === 0) {
    throw new Type2GuaranteeError("INVALID_SEATS", "seats 不得为空");
  }
  const refunds: Record<string, number> = {};
  let pot = 0;
  const receivers: string[] = [];
  for (const s of seats) {
    assertCents(s.frozenCents, `frozenCents(${s.userId})`);
    if (typeof s.userId !== "string" || !s.userId) {
      throw new Type2GuaranteeError("INVALID_SEATS", "userId 非法");
    }
    if (!s.present) {
      pot += s.frozenCents;
      refunds[s.userId] = 0;
    } else if (s.late) {
      const kept = Math.floor(s.frozenCents / 2);
      pot += s.frozenCents - kept;
      refunds[s.userId] = kept;
      receivers.push(s.userId);
    } else {
      refunds[s.userId] = s.frozenCents;
      receivers.push(s.userId);
    }
  }
  let unallocatedCents = 0;
  if (receivers.length === 0) {
    unallocatedCents = pot;
  } else {
    const per = Math.floor(pot / receivers.length);
    let rest = pot - per * receivers.length;
    for (const id of receivers) {
      refunds[id] += per + (rest > 0 ? 1 : 0);
      if (rest > 0) rest -= 1;
    }
  }
  const totalFrozen = seats.reduce((s, x) => s + x.frozenCents, 0);
  const totalOut =
    Object.values(refunds).reduce((s, x) => s + x, 0) + unallocatedCents;
  if (totalOut !== totalFrozen) {
    throw new Type2GuaranteeError(
      "CONSERVATION_VIOLATION",
      `资金守恒破坏：出 ${totalOut} !== 冻 ${totalFrozen}`,
    );
  }
  return { refunds, potCents: pot, unallocatedCents };
}

/** 会员池抵扣：池够额即免单次支付（冻额度），不够走单笔。 */
export function memberPoolCover(
  poolCents: number,
  requiredCents: number,
): { covered: boolean; freezeCents: number } {
  assertCents(requiredCents, "requiredCents");
  if (!Number.isInteger(poolCents) || poolCents < 0) {
    throw new Type2GuaranteeError("INVALID_AMOUNT", `poolCents 非法：${poolCents}`);
  }
  if (poolCents >= requiredCents) return { covered: true, freezeCents: requiredCents };
  return { covered: false, freezeCents: 0 };
}

/** 累犯策略：月爽约 n 次 → 下次系数 × 次停服。 */
export function type2BreachPolicy(monthBreaches: number): {
  multiplier: number;
  suspendDays: number;
} {
  const n = Number.isInteger(monthBreaches) && monthBreaches > 0 ? monthBreaches : 0;
  if (n >= TYPE2_SUSPEND_AT) return { multiplier: 2, suspendDays: TYPE2_SUSPEND_DAYS };
  if (n >= TYPE2_DOUBLE_AT) return { multiplier: 2, suspendDays: 0 };
  return { multiplier: 1, suspendDays: 0 };
}

/** 异议死线 = 完局时刻 ＋ 6h；确认死线 = 完局时刻 ＋ 24h。 */
export function type2ObjectionDeadline(completedAtMs: number): number {
  if (!Number.isFinite(completedAtMs)) throw new Type2GuaranteeError("INVALID_TIMESTAMP", "completedAt 非法");
  return completedAtMs + TYPE2_OBJECTION_MS;
}
export function type2ConfirmDeadline(completedAtMs: number): number {
  if (!Number.isFinite(completedAtMs)) throw new Type2GuaranteeError("INVALID_TIMESTAMP", "completedAt 非法");
  return completedAtMs + TYPE2_CONFIRM_TIMEOUT_MS;
}
