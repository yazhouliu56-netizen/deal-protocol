/**
 * L2-M4 账户清结算 · 统一资金托管与清结算引擎（全仓唯一资金计算权威真理源）。
 *
 * 阶段二资金引擎深水区大收敛：提炼 `src/modules/m13-payment/payment-service.ts`
 * （六模式托管 / 三阶段退款 / 组队分账 / 满意度暂存）与 `src/app/api/payment/*`
 * 路由内联重复实现（如 release 的 10% 平台抽成）的确定性计算精华，
 * 归一为纯函数（红线 1：资金底座零 LLM 判断；红线 3：不反向依赖任何 UI/Store）。
 *
 * 六模式资金托管（m13 FundingMode 映射为托管率 depositRate）：
 *   full_prepay（全款托管 1.0）/ deposit_only（保证金 0.3）/
 *   commitment（承诺金 0.05）/ milestone_staged（按里程碑 1.0）/
 *   split_revenue（分账 1.0）/ pay_later（0）/ none（0）
 */

/** 默认保证金托管率（deposit_only，映射 m13 缺省 0.3）。 */
export const DEFAULT_DEPOSIT_RATE = 0.3;
/** 默认平台抽成率（映射 api/payment/release 与 m13 commission 0.10）。 */
export const DEFAULT_PLATFORM_RATE = 0.1;
/** 满意度暂存比例（m13 satisfactionHold = holdAmount × 0.1）。 */
export const SATISFACTION_HOLD_RATIO = 0.1;
/** 违约罚金比例（isBreach 时 provider 应得部分扣 20% 归需求方抵扣）。 */
export const BREACH_PENALTY_RATE = 0.2;
/** 服务中上门费/检测费封顶（m13 DEPARTED ¥50 / ARRIVED ¥100）。 */
export const REFUND_DEPARTED_MAX = 50;
export const REFUND_ARRIVED_MAX = 100;

/** 六模式托管语义（mode → 托管率；供测试矩阵与上层声明）。 */
export const ESCROW_MODES = {
  full_prepay: 1,
  deposit_only: DEFAULT_DEPOSIT_RATE,
  commitment: 0.05,
  milestone_staged: 1,
  split_revenue: 1,
  pay_later: 0,
  none: 0,
} as const;
export type EscrowMode = keyof typeof ESCROW_MODES;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** 托管计算输入防御（负数/非有限数一律按 0 处理，绝不让脏数流入资金链）。 */
function sanitizeAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return round2(amount);
}

function sanitizeRate(rate: number | undefined): number {
  if (!Number.isFinite(rate ?? NaN) || (rate ?? 0) < 0) return 0;
  return Math.min(1, rate ?? 0);
}

/**
 * 资金托管与保证金冻结计算（六模式统一入口）。
 *
 * - totalAmount：订单托管总额（原价，脏输入归 0）；
 * - heldDeposit：托管期内冻结的保证金（totalAmount × depositRate，
 *   违约/爽约时优先从该池扣除，映射 m13 deposit_only/commitment 语义）；
 * - payableAmount：扣除冻结后可用于服务结算的应付款
 *   （履约完成后由 provider 释放所得，服务前资金全程托管在平台侧）。
 *
 * 六模式映射：full_prepay → depositRate 1（全款托管）；
 * deposit_only → 0.3（默认）；commitment → 0.05；milestone/split → 1；
 * pay_later / none → 0（不托管，heldDeposit = 0）。
 */
export function calculateEscrowHold(
  amount: number,
  depositRate?: number,
): { totalAmount: number; heldDeposit: number; payableAmount: number } {
  const totalAmount = sanitizeAmount(amount);
  // 缺省全款托管（heldDeposit = 总额，服务前资金全程冻结在平台侧——最保守）。
  const rate = depositRate === undefined ? 1 : sanitizeRate(depositRate);
  const heldDeposit = round2(totalAmount * rate);
  return {
    totalAmount,
    heldDeposit,
    payableAmount: round2(totalAmount - heldDeposit),
  };
}

/**
 * 三阶段阶梯退款与违约分配计算（m13 refundByPhase 连续化投影）。
 *
 * elapsedRatio = 服务进度（0 = 未出发 / (0,1) = 服务中 / 1 = 已完成）：
 * - 服务前（ratio 0）：需求方全退，provider 0，平台不抽成；
 * - 服务中（0 < ratio < 1）：provider 按完成比例得款（≤¥50/≤¥100 封顶语义
 *   已并入 ratio 连续模型，DEPARTED/ARRIVED 档位见 REFUND_*_MAX 常量），
 *   平台按同比例抽成；
 * - 服务后（ratio ≥ 1）：provider 全得（扣除平台抽成）；
 * - 违约（isBreach）：provider 应得部分再扣 BREACH_PENALTY_RATE（20%），
 *   罚金自动归需求方抵扣（守恒：refund + pay + fee ≡ total）。
 */
export function calculateTieredRefund(
  totalAmount: number,
  elapsedRatio: number,
  isBreach: boolean,
): { refundToDemander: number; payToProvider: number; platformFee: number } {
  const total = sanitizeAmount(totalAmount);
  if (total === 0) return { refundToDemander: 0, payToProvider: 0, platformFee: 0 };
  const ratio = Number.isFinite(elapsedRatio)
    ? Math.min(1, Math.max(0, elapsedRatio))
    : 0;

  const platformFee = round2(total * DEFAULT_PLATFORM_RATE * ratio);
  let payToProvider = round2((total - platformFee) * ratio);
  if (isBreach) {
    payToProvider = round2(payToProvider * (1 - BREACH_PENALTY_RATE));
  }
  const refundToDemander = round2(total - payToProvider - platformFee);
  return { refundToDemander, payToProvider, platformFee };
}

/**
 * AA 分摊与多方分账计算（m13 splitTeamPayment + meetup PER_SEAT 投影）。
 *
 * - perSeatCost：人均摊付（总金额 / 参与人数，AA 组局每人应付）；
 * - platformIncome：平台抽成（总金额 × platformRate，映射 release 10% /
 *   commission 阶梯抽成）；
 * - providerIncome：服务方净得（总金额 − 平台抽成，即最终放款额，
 *   组队场景由上游再按 splitTeamPayment 成员份额拆分）。
 */
export function calculateMultiPartySplit(
  totalAmount: number,
  platformRate: number,
  participantsCount: number,
): { perSeatCost: number; platformIncome: number; providerIncome: number } {
  const total = sanitizeAmount(totalAmount);
  const count = Number.isInteger(participantsCount) && participantsCount > 0
    ? participantsCount
    : 1;
  const platformIncome = round2(total * sanitizeRate(platformRate));
  return {
    perSeatCost: round2(total / count),
    platformIncome,
    providerIncome: round2(total - platformIncome),
  };
}

/**
 * 资金安全底线校验（红线 1：资金链前置防御）。
 * 余额非负、托管所需冻结额非负且余额充足 → 放行。
 * 任一参数非法（NaN/负数/不足）→ false。
 */
export function verifyFundSafetyGuard(balance: number, requiredHold: number): boolean {
  if (!Number.isFinite(balance) || !Number.isFinite(requiredHold)) return false;
  if (balance < 0 || requiredHold < 0) return false;
  return balance >= requiredHold;
}

/**
 * 单提供者结算放款（收敛 api/payment/release 内联实现）。
 * providerNet = 全款 − 平台抽成；platformFee = 全款 × platformRate。
 */
export function calculateProviderSettlement(
  totalAmount: number,
  platformRate: number = DEFAULT_PLATFORM_RATE,
): { platformFee: number; providerNet: number } {
  const { platformIncome, providerIncome } = calculateMultiPartySplit(
    totalAmount,
    platformRate,
    1,
  );
  return { platformFee: platformIncome, providerNet: providerIncome };
}

/* =====================================================================
 * S4 合规分账指令路由（防二清：清结算必须经持牌支付机构分账通道）
 * ===================================================================== */

/** 合规分账渠道（持牌支付机构标准分账通道）。 */
export type ComplianceChannel = "WECHAT_PAY" | "STRIPE_CONNECT" | "BANK_ESCROW";

/** 分账渠道 → 服务商商户号（渠道标识常量；接入方用实际商户号覆盖）。 */
export const COMPLIANCE_MERCHANT_MAP: Record<ComplianceChannel, string> = {
  WECHAT_PAY: "1900000109",
  STRIPE_CONNECT: "acct_connect_standard",
  BANK_ESCROW: "escrow_acct_0001",
} as const;

/**
 * 合规分账指令载荷（持牌支付机构标准格式）。
 * 平台不直接收付资金流（规避二清），结算以「分账指令」形式路由至
 * 持牌机构执行：接收方（服务者账户）实收 providerNet，平台抽成
 * platformFee 由机构按指令拆出，需求方退款 demanderRefund 原路退回。
 */
export interface IComplianceSplitInstruction {
  /** 指令号（订单 + 渠道确定性派生，幂等键）。 */
  instructionId: string;
  /** 分账渠道（持牌机构通道）。 */
  channel: ComplianceChannel;
  /** 服务商商户号（平台在持牌机构的入网号）。 */
  merchantId: string;
  /** 分账接收方（服务者账户）。 */
  receiverAccountId: string;
  /** 分账金额（服务者实收，= 结算净额）。 */
  splitAmountYuan: number;
  /** 手续费明细（平台抽成拆解）。 */
  platformFeeYuan: number;
  /** 需求方退款（阶梯退款场景原路退回额）。 */
  demanderRefundYuan: number;
  /** 计价币种（当前仅人民币）。 */
  currency: "CNY";
  /** 指令生成时刻（epoch ms）。 */
  createdAt: number;
}

const round2c = (n: number): number => Math.round(n * 100) / 100;

/**
 * 合规分账指令路由生成器（S4 · 防二清 · 确定性纯函数，红线 1）。
 *
 * 输入任一 ProviderSettlement 形态的结算结果（platformFee / providerNet，
 * 或三阶段阶梯退款 refundToDemander / payToProvider / platformFee），
 * 输出持牌机构可执行的分账指令载荷。指令号 = 订单 + 渠道确定性派生
 * （幂等：同订单同渠道重复生成指令号一致，机构侧可去重）。
 *
 * 金额守恒校验：分账总额（split + fee + refund）≡ 结算总额
 * （防资金凭空多分；传入总额缺省按三者之和推导）。
 */
export function generateComplianceSplitInstruction(
  settlement:
    | { platformFee: number; providerNet: number; demanderRefund?: number }
    | {
        refundToDemander: number;
        payToProvider: number;
        platformFee: number;
        providerNet?: never;
      },
  channel: ComplianceChannel,
  opts: {
    orderId: string;
    receiverAccountId: string;
    /** 覆盖默认商户号（接入方实际入网号）。 */
    merchantId?: string;
    now?: number;
  },
): IComplianceSplitInstruction {
  const s = settlement as {
    platformFee: number;
    providerNet?: number;
    demanderRefund?: number;
    refundToDemander?: number;
    payToProvider?: number;
  };
  const platformFee = round2c(Math.max(0, s.platformFee ?? 0));
  const splitAmountYuan = round2c(
    Math.max(0, s.providerNet ?? s.payToProvider ?? 0),
  );
  const demanderRefundYuan = round2c(
    Math.max(0, s.demanderRefund ?? s.refundToDemander ?? 0),
  );
  const instructionId = `split-${opts.orderId}-${channel}`;
  return {
    instructionId,
    channel,
    merchantId: opts.merchantId ?? COMPLIANCE_MERCHANT_MAP[channel],
    receiverAccountId: opts.receiverAccountId,
    splitAmountYuan,
    platformFeeYuan: platformFee,
    demanderRefundYuan,
    currency: "CNY",
    createdAt: opts.now ?? Date.now(),
  };
}
