/**
 * Microkernel 2.0 战役 1（P0-1）：资金模式能力矩阵分派器。
 *
 * 裁决 (a) Fail-Fast 诚实底座：类型系统声明了 17 种 FundingMode，但发射管
 * 当前只有三条膛线——本文件是「能力白名单」的唯一权威事实源：
 *   - full_prepay      全款预付托管（escrow.ts 通用膛线，生产在跑）
 *   - commitment       承诺押金（小额全额托管，de-facto 通用膛线）
 *   - milestone_staged 分期里程碑（milestone-escrow.ts 确定性原语，原语级）
 * 白名单之外的模式（streaming/crowdfunding/…）在弹药工厂装配期一票否决，
 * 严禁静默降级为全款预付——金融语义的静默降级等于违背合同承诺。
 *
 * 红线 3：本文件零 DB / 零网络 / 零时钟，纯入参策略分派。
 */

/** 已实现资金模式白名单（真实枚举词汇，对齐 escrow.ts ESCROW_MODES 与 protocol-types FundingMode）。 */
export const SUPPORTED_FUNDING_MODES = [
  "full_prepay",
  "commitment",
  "milestone_staged",
] as const;

export type SupportedFundingMode = (typeof SUPPORTED_FUNDING_MODES)[number];

/** 质检拦截错误码前缀（factory.validateAmmoConfig 与动态注池共用）。 */
export const UNSUPPORTED_FUNDING_MODE = "UNSUPPORTED_FUNDING_MODE";

/** 校验资金模式是否已实现：null=通过，否则返回定位错误串（纯函数）。 */
export function validateFundingModeSupport(mode: string): string | null {
  if (!(SUPPORTED_FUNDING_MODES as readonly string[]).includes(mode)) {
    return `${UNSUPPORTED_FUNDING_MODE}: funding mode "${mode}" is declared but has no runtime breech — allowed: ${SUPPORTED_FUNDING_MODES.join(" | ")}`;
  }
  return null
}

/** 资金操作种类（按膛线分组）。 */
export type FundingOperation =
  | "hold" // 托管金额计算（通用膛线）
  | "refund" // 阶梯退款计算（通用膛线）
  | "settle" // 服务方结算计算（通用膛线）
  | "plan" // 里程碑计划创建（分期膛线）
  | "release" // 里程碑释放（分期膛线）
  | "timeout_check"; // 里程碑超时评估（分期膛线）

const ESCROW_BREECH_OPS: readonly FundingOperation[] = ["hold", "refund", "settle"];
const MILESTONE_BREECH_OPS: readonly FundingOperation[] = ["plan", "release", "timeout_check"];

/**
 * 分派资金操作到对应膛线的确定性原语。
 *
 * 设计说明：返回原语函数引用而非包装 payload——包装会伪造真身签名、
 * 制造第二层适配噪声；调用方持引用后以原生签名调用（签名保真原则）。
 * commitment 与 full_prepay 共用通用托管膛线（押金语义由金额本身承载）。
 */
export function dispatchFundingOperation(
  mode: string,
  op: FundingOperation,
): (
  ...args: unknown[]
) => unknown {
  const unsupported = validateFundingModeSupport(mode)
  if (unsupported) throw new Error(unsupported)

  if (mode === "milestone_staged") {
    if (!MILESTONE_BREECH_OPS.includes(op)) {
      throw new Error(
        `FUNDING_OP_NOT_IN_BREECH: milestone_staged supports [${MILESTONE_BREECH_OPS.join(", ")}], got "${op}"`,
      )
    }
    switch (op) {
      case "plan":
        return planOp
      case "release":
        return releaseOp
      case "timeout_check":
        return timeoutOp
    }
  }

  if (!ESCROW_BREECH_OPS.includes(op)) {
    throw new Error(
      `FUNDING_OP_NOT_IN_BREECH: ${mode} supports [${ESCROW_BREECH_OPS.join(", ")}], got "${op}"`,
    )
  }
  switch (op) {
    case "hold":
      return holdOp
    case "refund":
      return refundOp
    default:
      return settleOp
  }
}

import {
  calculateEscrowHold,
  calculateTieredRefund as _refund,
  calculateProviderSettlement as _settle,
} from "./escrow.ts";
import {
  createMilestonePlan as _plan,
  releaseMilestone as _release,
  evaluateMilestoneTimeout as _timeout,
} from "./milestone-escrow.ts";

const holdOp = calculateEscrowHold as (...args: unknown[]) => unknown;
const refundOp = _refund as unknown as (...args: unknown[]) => unknown;
const settleOp = _settle as unknown as (...args: unknown[]) => unknown;
const planOp = _plan as unknown as (...args: unknown[]) => unknown;
const releaseOp = _release as unknown as (...args: unknown[]) => unknown;
const timeoutOp = _timeout as unknown as (...args: unknown[]) => unknown;

/** 模式 → 膛线归属（供台账/管理台只读展示）。 */
export function fundingBreechOf(mode: SupportedFundingMode): "generic_escrow" | "milestone_escrow" {
  return mode === "milestone_staged" ? "milestone_escrow" : "generic_escrow"
}
