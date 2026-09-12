/**
 * L1 通用基线（B1 模板瘦身 · B 批）。
 *
 * 5 枚官方弹药 holographic 全字段 diff 实证（2026-09-12）：
 * splitRules／cancellationTiers 各家商业不同，不强行归一；
 * 仅抽取逐字相同的块——R1 转岗试单（housekeeping/appliance/pet ×3）、
 * 85/10/5 分账＋4 阶违约梯（housekeeping/pet ×2）。
 *
 * 使用方式：各弹药 `{ ...R1_TRANSFER_POLICY }`／`[ ...CANCELLATION_4STAGE ]`
 * 展开为独立副本（运行时互不耦合，改一家不影响别家），源头唯一。
 */
import { deepFreeze } from "./factory.ts";
import type {
  ICancellationTier,
  ISplitRules,
  ITransferPolicy,
} from "../types/ammo-schema.ts";

/** R1 转岗试单基线（ADR-0020：5 单试单/日限 2/投诉熔断）。 */
export const R1_TRANSFER_POLICY: Readonly<ITransferPolicy> = deepFreeze({
  riskTier: "R1",
  probationOrders: 5,
  dailyCap: 2,
  fuseOnComplaint: true,
});

/** 标准分账基线（85/10/5，守恒 1.0）。 */
export const STANDARD_SPLIT_85_10_5: Readonly<ISplitRules> = deepFreeze({
  providerRatio: 0.85,
  platformRatio: 0.1,
  insuranceRatio: 0.05,
});

/** 标准 4 阶违约梯基线（匹配前全退→在途 8 折→到场 5 折→开工不退）。 */
export const CANCELLATION_4STAGE_STANDARD: Readonly<ICancellationTier[]> = deepFreeze([
  { stage: "BEFORE_MATCH", demanderRefundRatio: 1, providerCompensationYuan: 0, deductDepositRatio: 0 },
  { stage: "AFTER_MATCH_EN_ROUTE", demanderRefundRatio: 0.8, providerCompensationYuan: 20, deductDepositRatio: 0.2 },
  { stage: "ON_SITE", demanderRefundRatio: 0.5, providerCompensationYuan: 0, deductDepositRatio: 0.5 },
  { stage: "IN_SERVICE", demanderRefundRatio: 0, providerCompensationYuan: 0, deductDepositRatio: 1 },
]);
