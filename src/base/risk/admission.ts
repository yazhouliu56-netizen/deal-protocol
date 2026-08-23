/**
 * 统一发布准入引擎（Step1 准入闸门下沉 · 宪法 #1 底座优先 / 宪法 #10 降级链）。
 *
 * 聚合发布前四道闸门为单一同步确定性纯函数：
 *   闸门 0 封禁锁定（isBanned —— suspend 未过期 / 永久 ban）
 *   闸门 1 反欺诈甄检（sentinelCheck 四因子聚合，high 拒绝 / watch 放行降权）
 *   闸门 2 no-show 违约欠款锁定（调用方以 claims 投影 boolean 注入，
 *          避免 base/risk → base/order 数据形状耦合）
 *   闸门 3 未成年分级（ageGate "publish" 动作；birthYear 缺省不拦截，
 *          与既有资金闸 gateMoneyAction 口径一致）
 * 敏感词（autoFlag）单独返回不走 allowed —— 既有语义为「先挡后审」：
 * 命中时建单即下架 + 自动举报，不是拒绝发布。
 *
 * 红线 3 合规：全部上下文由调用方显式入参注入（设备绑定/信用分/行为投影/
 * 弹药进家词表），本文件严禁 import store 与 ammo；时间注入 SSR/测试安全。
 */

import { ageFromBirthYear, ageGate } from "../safe/ageGate.ts";
import type { BanRecord } from "./moderation.ts";
import { autoFlag, isBanned } from "./moderation.ts";
import type { DeviceBinding, RoamRuleParams } from "./roamGuard.ts";
import { DEFAULT_ROAM_PARAMS, riskOf } from "./roamGuard.ts";
import type { SentinelEvent } from "./sentinel.ts";
import { recordSentinel, sentinelCheck } from "./sentinel.ts";

export interface IPublishAdmissionInput {
  authorId: string;
  /** 敏感词扫描面（类目 + 定制要求 + 磋商备注拼接），由调用方拼装注入。 */
  scanText: string;
  /** 本单金额（反欺诈「新号+大额」金额因子）。 */
  amountYuan: number;
  /** 服务类目（进家引信加权判定键）。 */
  category?: string;
  /** 设备上下文（useRoamStore bindings 显式注入）。 */
  bindings: DeviceBinding[];
  deviceId: string;
  /** roam-guard 引信参数（弹药层驱动；缺省 = 家庭共机容忍线）。 */
  roamRuleParams?: RoamRuleParams;
  /** 身份上下文（useIdentityStore 显式注入）。 */
  birthYear?: number;
  guardianConsent?: boolean;
  /** 需求方信用分 0-1000（creditTier×200 由调用方映射后注入）。 */
  creditScore?: number;
  /** 近 N 天发布次数（waves 集合投影注入）。 */
  recentPublishCount: number;
  /** 历史完成率 0-1（缺省剔除该因子重归一，宪法 #10）。 */
  completionRate?: number;
  /** 该身份近期是否有裂变活动（图因子）。 */
  graphFission?: boolean;
  /** no-show 违约未结投影（hasUnsettledBreach(claims) 结果注入）。 */
  hasUnsettledBreachFlag: boolean;
  /** 进家类目词表（弹药 risk-rule 引信参数注入；base 零业务词，红线 3）。 */
  homeAccessKeywords?: string[];
  /** 封禁表快照。 */
  bans: Record<string, BanRecord>;
}

export interface IPublishAdmissionResult {
  allowed: boolean;
  blockedReason?: "banned" | "sentinel" | "debt" | "minor";
  riskLevel: "safe" | "watch" | "high";
  /** 敏感词命中标签（命中 ≠ allowed=false：走建单下架语义）。 */
  sensitiveHit: string | null;
  /** 反欺诈甄检原始分 0-100（banned 先于甄检时为 0）。 */
  sentinelScore: number;
  /** 甄检审计事件（recordSentinel 产物，调用方原样并入 sentinelEvents）。 */
  auditEvents: SentinelEvent[];
}

/**
 * 发布准入统一判定。闸门序与既有 createPendingWave 行为逐位对齐
 * （banned → sentinel → debt），保证既有测试断言零回归；
 * watch 级放行但携带审计事件（降权观察语义保持）。
 */
export function evaluatePublishAdmission(
  input: IPublishAdmissionInput,
  now = Date.now()
): IPublishAdmissionResult {
  const auditEvents: SentinelEvent[] = [];

  // 闸门 0：封禁/限流中不能发布
  if (isBanned(input.bans, input.authorId, now)) {
    return {
      allowed: false,
      blockedReason: "banned",
      riskLevel: "high",
      sentinelScore: 0,
      sensitiveHit: null,
      auditEvents,
    };
  }

  // 闸门 1：多因子反欺诈甄检（设备因子由 riskOf 就地评估后注入）
  const device = riskOf(
    input.bindings,
    input.deviceId,
    input.roamRuleParams ?? DEFAULT_ROAM_PARAMS
  );
  const check = sentinelCheck({
    deviceRisk: device.risk,
    creditScore: input.creditScore,
    amountYuan: input.amountYuan,
    publishCount: input.recentPublishCount,
    completionRate: input.completionRate,
    graphIdentityCount: device.count,
    graphFission: input.graphFission,
    category: input.category,
    homeAccessKeywords: input.homeAccessKeywords,
  });
  auditEvents.push(...recordSentinel([], check, input.authorId, now));
  if (check.level === "high") {
    return {
      allowed: false,
      blockedReason: "sentinel",
      riskLevel: "high",
      sentinelScore: check.score,
      sensitiveHit: null,
      auditEvents,
    };
  }

  // 闸门 2：no-show 违约欠款锁定
  if (input.hasUnsettledBreachFlag) {
    return {
      allowed: false,
      blockedReason: "debt",
      riskLevel: check.level,
      sentinelScore: check.score,
      sensitiveHit: null,
      auditEvents,
    };
  }

  // 闸门 3：未成年分级（birthYear 缺省不拦 —— 与既有资金闸口径一致）
  if (input.birthYear) {
    const age = ageFromBirthYear(input.birthYear, new Date(now).getFullYear());
    const gate = ageGate({
      age,
      action: "publish",
      guardianConsent: input.guardianConsent,
    });
    if (gate.blocked) {
      return {
        allowed: false,
        blockedReason: "minor",
        riskLevel: check.level,
        sentinelScore: check.score,
        sensitiveHit: null,
        auditEvents,
      };
    }
  }

  // 敏感词最后判（命中 ≠ 拒绝：先挡后审，建单即下架由调用方执行）
  return {
    allowed: true,
    riskLevel: check.level,
    sentinelScore: check.score,
    sensitiveHit: autoFlag(input.scanText),
    auditEvents,
  };
}
