/**
 * 跨类目转岗试单纯核（ADR-0020 · R1/R2/R3 风险分档，用户已裁决采用分档）。
 *
 * 法定位置：语义圈定/画像只做"候选池"；能否上岗 = 硬门槛
 * （evaluateTriCreditAdmission 公安/ESF/BCS 一票否决保持）＋ 本模块试单。
 * PQS 缺失不再直接拒（deferPQS），转试单期补齐；PQS 达线老手直接准入。
 *
 * Pure + unit-testable; no runtime imports.
 */
import type {
  IAmmoDefinition,
  ITriDimensionalCredit,
} from "../../types/ammo-schema.ts";
import { evaluateTriCreditAdmission } from "./tri-credit.ts";

export type TransferRiskTier = "R1" | "R2" | "R3";

export interface ResolvedTransferPolicy {
  riskTier: TransferRiskTier;
  probationOrders: number;
  dailyCap: number | null;
  fuseOnComplaint: boolean;
}

const TIER_DEFAULTS: Record<
  TransferRiskTier,
  { probationOrders: number; dailyCap: number | null; fuseOnComplaint: boolean }
> = {
  R1: { probationOrders: 5, dailyCap: 2, fuseOnComplaint: true },
  R2: { probationOrders: 3, dailyCap: null, fuseOnComplaint: true },
  R3: { probationOrders: 0, dailyCap: null, fuseOnComplaint: false },
};

/**
 * 风险档归一：弹药显式声明优先；缺省按 supplyCluster 推导
 * （C2 入户/C3 技术 B2B → R1；C1 移动轻履约 → R3；未归类 → R2）。
 */
export function riskTierFor(ammo: IAmmoDefinition): TransferRiskTier {
  const declared = ammo.transferPolicy?.riskTier;
  if (declared === "R1" || declared === "R2" || declared === "R3") return declared;
  const cluster = ammo.supplyCluster;
  if (cluster === "C2_IN_HOME" || cluster === "C3_TECH_B2B") return "R1";
  if (cluster === "C1_MOBILITY") return "R3";
  return "R2";
}

export function resolveTransferPolicy(ammo: IAmmoDefinition): ResolvedTransferPolicy {
  const tier = riskTierFor(ammo);
  const d = TIER_DEFAULTS[tier];
  const t = ammo.transferPolicy;
  return {
    riskTier: tier,
    probationOrders: t?.probationOrders ?? d.probationOrders,
    dailyCap: t?.dailyCap ?? d.dailyCap,
    fuseOnComplaint: t?.fuseOnComplaint ?? d.fuseOnComplaint,
  };
}

export type TransferOutcome = "ADMITTED" | "PROBATION" | "REJECTED";

export interface TransferHistory {
  /** 目标类目已完成试单数。 */
  completedOrders: number;
  /** 目标类目试单期投诉数（有效责任投诉）。 */
  complaints: number;
}

export interface TransferVerdict {
  outcome: TransferOutcome;
  reason?: string;
  policy: ResolvedTransferPolicy;
}

/**
 * 转岗准入判定（硬门槛 → PQS 回流 → 档位路由 → 试单进度/熔断）。
 */
export function evaluateTransfer(
  credit: ITriDimensionalCredit,
  toAmmo: IAmmoDefinition,
  history: TransferHistory,
): TransferVerdict {
  const policy = resolveTransferPolicy(toAmmo);
  // 硬门槛（公安/ESF/BCS）一票否决保持；PQS 缺失延期至试单。
  const gate = evaluateTriCreditAdmission(credit, toAmmo, undefined, { deferPQS: true });
  if (!gate.isAdmitted) return { outcome: "REJECTED", reason: gate.reason, policy };
  // 已持有目标类目达线 PQS → 老手回流，零摩擦。
  const pqs = credit.pqsScores[toAmmo.category];
  const pqsGate = toAmmo.workerRequirement?.minSafetyScore ?? 60;
  if (pqs !== undefined && Number.isFinite(pqs) && pqs >= pqsGate) {
    return { outcome: "ADMITTED", reason: "transfer-returning: 已持达线 PQS 直接准入", policy };
  }
  // R3 低风险直通（语义圈定＋首单回访在外层，此处只开闸）。
  if (policy.riskTier === "R3" || policy.probationOrders <= 0) {
    return { outcome: "ADMITTED", reason: "transfer-r3: 低风险直通", policy };
  }
  // 试单熔断：有效投诉即回见习。
  if (policy.fuseOnComplaint && history.complaints > 0) {
    return {
      outcome: "REJECTED",
      reason: `transfer-fused: 试单期有效投诉 ${history.complaints} 次，熔断回见习`,
      policy,
    };
  }
  // 期满转正（PQS 写入由调用方落库，此处只给结论）。
  if (history.completedOrders >= policy.probationOrders) {
    return { outcome: "ADMITTED", reason: "transfer-graduated: 试单期满转正", policy };
  }
  return {
    outcome: "PROBATION",
    reason: `transfer-probation: 试单 ${history.completedOrders}/${policy.probationOrders}`,
    policy,
  };
}
