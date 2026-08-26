/**
 * AmmoFactory 工业级弹药装配流水线（8 维全息模型 → 标准不可变弹药）。
 *
 * 人类创始人注入（2026-08-16）：弹药从「人手装填」升级为「流水线量产」——
 * 一份 `IHolographicAmmoConfig`（8 维全息声明）经四道工序出厂：
 *
 *   ① 参数注入（Config Injection）➔ ② 静态语义审查（Semantic Linter）
 *   ➔ ③ 沙箱组装（Sandbox Assembler）➔ ④ 不可变发布（Immutable Release）
 *
 * 红线 1（隔离墙）：本流水线为 100% 确定性纯函数——钩子只允许从静态
 * 安全白名单 `HOOK_OPERATOR_REGISTRY` 解析引用已编译纯函数，严禁任何
 * `eval()` / `new Function()` / 动态未受检代码执行（工厂无字符串到
 * 代码的通道）。
 *
 * 红线 3（单向依赖）：本文件隶属于弹药装配层（ammo = 第二层），只允许
 * 依赖 `src/types` 协议与 `src/ammo` 同类表，严禁反向 import React 组件
 * 或 UI Store。
 */

import type {
  IAmmoDefinition,
  IHolographicAmmoConfig,
  ISubEventContext,
  ISubEventHook,
  ISubEventResult,
} from "../types/ammo-schema.ts";
// Microkernel 2.0 战役 1（P0-1）：资金模式能力白名单（base 单向依赖，宪法 #3）
import { validateFundingModeSupport } from "../base/money/funding-dispatcher.ts";

/* =====================================================================
 * 运行时动态弹药池（人类创始人裁决 2026-08-16 · 循环依赖治理）：
 * 本池定义在装配层（AmmoFactory）而非 registry——打断「factory → registry
 * → ammo → factory」ESM 循环依赖（TDZ 崩溃根因），依赖图收敛为无环 DAG：
 * factory → types；ammo → factory；registry → factory + ammo（宪法 #3
 * 单向依赖）。registry.ts 自此文件 re-export 本池，既有消费方导入面不变。
 * ===================================================================== */
export const DYNAMIC_AMMO_POOL: Map<string, IAmmoDefinition> = new Map();

/* =====================================================================
 * 红线 1 · 静态安全白名单算子注册表（HOOK_OPERATOR_REGISTRY）
 *
 * 全部算子均为模块级编译期常量纯函数——名称字符串 → 真实 ISubEventHook
 * 的一一映射在沙箱内静态解析，不存在任何动态代码执行通道。
 * ===================================================================== */

/** 到点履约钩子（ArrivalCheck）：MATCHED → IN_SERVICE 前置校验，BLOCK 降级。 */
export const ArrivalCheckHook: ISubEventHook = {
  hookId: "operator.arrival-check",
  on: { to: "IN_SERVICE" },
  phase: "BEFORE",
  fallback: "BLOCK",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const arrival = ctx.payload?.arrival as
      | { confirmed?: boolean; at?: number }
      | undefined;
    if (arrival?.confirmed !== true) {
      return { ok: false, reason: "arrival-not-confirmed" };
    }
    return { ok: true, data: { arrivedAt: arrival.at ?? null } };
  },
};

/** 完工双拍验收钩子（CleaningCheck）：→ INSPECTED 后置证据收集，SKIP 降级。 */
export const CleaningCheckHook: ISubEventHook = {
  hookId: "operator.cleaning-check",
  on: { to: "INSPECTED" },
  phase: "AFTER",
  fallback: "SKIP",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const photos = ctx.payload?.photos as
      | { before?: string[]; after?: string[] }
      | undefined;
    const before = photos?.before ?? [];
    const after = photos?.after ?? [];
    if (before.length === 0 || after.length === 0) {
      return { ok: false, reason: "evidence-photos-required" };
    }
    return { ok: true, data: { evidence: { before, after }, requiredMet: true } };
  },
};

/** 现场增项报价钩子（OnsiteQuote）：MATCHED → IN_SERVICE 前置校验，BLOCK 降级。 */
export const OnsiteQuoteHook: ISubEventHook = {
  hookId: "operator.onsite-quote",
  on: { to: "IN_SERVICE" },
  phase: "BEFORE",
  fallback: "BLOCK",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const quote = ctx.payload?.onsiteQuote as
      | { items?: string[]; totalYuan?: number; approved?: boolean }
      | undefined;
    if (!quote) return { ok: true };
    if (quote.approved !== true) {
      return { ok: false, reason: "onsite-quote-pending" };
    }
    return { ok: true, data: { quoteTotalYuan: quote.totalYuan ?? 0 } };
  },
};

/** AA 分摊结算钩子（AASplitSettle）：→ SETTLED 后置对账，SKIP 降级。 */
export const AASplitSettleHook: ISubEventHook = {
  hookId: "operator.aa-split-settle",
  on: { to: "SETTLED" },
  phase: "AFTER",
  fallback: "SKIP",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const split = ctx.payload?.aaSplit as
      | { totalYuan?: number; confirmedPartyCount?: number }
      | undefined;
    const totalYuan = split?.totalYuan ?? 0;
    const confirmedPartyCount = split?.confirmedPartyCount ?? 0;
    if (!(totalYuan > 0) || confirmedPartyCount < 2) {
      return { ok: false, reason: "aa-split-unconfirmed" };
    }
    return {
      ok: true,
      data: { splitConfirmed: true, perSeatYuan: totalYuan / confirmedPartyCount },
    };
  },
};

/** 隐私盾钩子（PrivacyShield）：MATCHED → IN_SERVICE 前置校验，BLOCK 降级。 */
export const PrivacyShieldHook: ISubEventHook = {
  hookId: "operator.privacy-shield",
  on: { to: "IN_SERVICE" },
  phase: "BEFORE",
  fallback: "BLOCK",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const privacy = ctx.payload?.privacy as
      | { shieldArmed?: boolean; virtualNumber?: string }
      | undefined;
    if (privacy?.shieldArmed !== true) {
      return { ok: false, reason: "privacy-shield-not-armed" };
    }
    return { ok: true, data: { shielded: true } };
  },
};

/** 完工离场钩子（DepartureFinish）：→ INSPECTED 后置签退，SKIP 降级。 */
export const DepartureFinishHook: ISubEventHook = {
  hookId: "operator.departure-finish",
  on: { to: "INSPECTED" },
  phase: "AFTER",
  fallback: "SKIP",
  run: (ctx: ISubEventContext): ISubEventResult => {
    const departure = ctx.payload?.departure as
      | { confirmed?: boolean; at?: number }
      | undefined;
    if (departure?.confirmed !== true) {
      return { ok: false, reason: "departure-not-confirmed" };
    }
    return { ok: true, data: { departedAt: departure.at ?? null } };
  },
};

/**
 * 算子静态白名单表（唯一可解析的钩子名称空间）：
 * D5 forwardHooks 中引用的每个名称必须命中本表，未命中 → 审查器拒绝出厂。
 */
export const HOOK_OPERATOR_REGISTRY: Readonly<Record<string, ISubEventHook>> = {
  ArrivalCheckHook,
  CleaningCheckHook,
  OnsiteQuoteHook,
  AASplitSettleHook,
  PrivacyShieldHook,
  DepartureFinishHook,
};

/* =====================================================================
 * ② 静态语义审查器（Semantic Linter）
 * ===================================================================== */

export type ValidationResult = { ok: true } | { ok: false; errors: string[] };

/** 分账资金守恒容差（浮点极小误差豁免，1e-9 量级）。 */
export const SPLIT_CONSERVATION_EPSILON = 1e-9;

const isFiniteNumber = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

const inUnitInterval = (v: unknown): v is number =>
  isFiniteNumber(v) && v >= 0 && v <= 1;

/**
 * 静态语义审查（出厂前安全检查，不通过直接拒绝出厂）：
 *   1. 身份与元数据完整性：ammoId/category 非空、version 语义化 x.y.z、
 *      pricingModel/fuzePolicy 必须显式装填；
 *   2. 资金守恒硬性审查：splitRules 三比之和 === 1.0（容差 1e-9），
 *      任一比例出界（<0 或 >1）同样拒绝；
 *   3. 入户安全一票否决：supplyCluster === 'C2_IN_HOME' 时必须
 *      公安背调通过（isPoliceVerified === true）或最低安全分 ≥ 700；
 *   4. 防坐地起价熔断：maxSurchargeRatio ≤ 0.5（S2 商业防脆弱）；
 *   5. 计价边界护栏：minFloorPrice ≤ maxCeilingPrice；
 *   6. 逆向违约阶梯合法性：退款/扣金比例 ∈ [0,1]、车马费补偿 ≥ 0；
 *   7. 钩子名解析：D5 forwardHooks 每个名称必须命中静态白名单。
 */
export function validateAmmoConfig(
  config: IHolographicAmmoConfig
): ValidationResult {
  const errors: string[] = [];

  // 1. 身份与元数据完整性
  if (typeof config.ammoId !== "string" || config.ammoId.trim() === "") {
    errors.push("INVALID_AMMO_ID: ammoId must be a non-empty string");
  }
  if (typeof config.category !== "string" || config.category.trim() === "") {
    errors.push("INVALID_CATEGORY: category must be a non-empty string");
  }
  if (typeof config.version !== "string" || !/^\d+\.\d+\.\d+$/.test(config.version)) {
    errors.push(
      `INVALID_VERSION: version must be semantic x.y.z (got ${String(config.version)})`
    );
  }
  if (!config.pricingModel) {
    errors.push("MISSING_PRICING_MODEL: D2 pricingModel must be explicitly loaded");
  }
  if (!config.fuzePolicy) {
    errors.push("MISSING_FUZE_POLICY: D3 fuzePolicy must be explicitly loaded");
  }

  // 1.5 资金模式能力白名单（Microkernel 2.0 战役 1 · P0-1 裁决 a Fail-Fast）
  // 未实现模式一票否决拒出厂，严禁静默降级为全款预付。
  if (config.fundingMode !== undefined) {
    const fundingError = validateFundingModeSupport(config.fundingMode);
    if (fundingError) {
      errors.push(fundingError);
    }
  }

  // 2. 资金守恒硬性审查（仅显式声明 splitRules 时校验）
  if (config.splitRules) {
    const { providerRatio, platformRatio, insuranceRatio } = config.splitRules;
    const allNum = [providerRatio, platformRatio, insuranceRatio].every(isFiniteNumber);
    if (!allNum) {
      errors.push(
        "SPLIT_SUM_NOT_CONSERVED: splitRules ratios must all be finite numbers"
      );
    } else {
      const sum = providerRatio + platformRatio + insuranceRatio;
      if (Math.abs(sum - 1) > SPLIT_CONSERVATION_EPSILON) {
        errors.push(
          `SPLIT_SUM_NOT_CONSERVED: provider+platform+insurance = ${sum} must equal 1.0`
        );
      }
      if (
        !inUnitInterval(providerRatio) ||
        !inUnitInterval(platformRatio) ||
        !inUnitInterval(insuranceRatio)
      ) {
        errors.push("SPLIT_RATIO_OUT_OF_RANGE: every split ratio must be in [0, 1]");
      }
    }
  }

  // 3. 入户安全一票否决（C2_IN_HOME 无背调直接拒绝出厂）
  if (config.supplyCluster === "C2_IN_HOME") {
    const req = config.workerRequirement;
    const policeOk = req?.isPoliceVerified === true;
    const scoreOk = isFiniteNumber(req?.minSafetyScore) && (req?.minSafetyScore ?? 0) >= 700;
    if (!policeOk && !scoreOk) {
      errors.push(
        "IN_HOME_SAFETY_GATE_REJECTED: C2_IN_HOME requires police verification or minSafetyScore >= 700"
      );
    }
  }

  // 4. 防坐地起价熔断（默认 0.5，声明上限不得超限）
  if (config.maxSurchargeRatio !== undefined) {
    if (!isFiniteNumber(config.maxSurchargeRatio) || config.maxSurchargeRatio < 0) {
      errors.push("ANTI_GOUGING_RATIO_INVALID: maxSurchargeRatio must be a non-negative number");
    } else if (config.maxSurchargeRatio > 0.5) {
      errors.push(
        `ANTI_GOUGING_LIMIT_EXCEEDED: maxSurchargeRatio ${config.maxSurchargeRatio} exceeds 0.5`
      );
    }
  }

  // 5. 计价边界护栏（地板价 ≤ 天花板价）
  if (config.minFloorPrice !== undefined && config.maxCeilingPrice !== undefined) {
    if (!isFiniteNumber(config.minFloorPrice) || !isFiniteNumber(config.maxCeilingPrice)) {
      errors.push("PRICE_BOUND_INVALID: minFloorPrice/maxCeilingPrice must be finite numbers");
    } else if (config.maxCeilingPrice < config.minFloorPrice) {
      errors.push(
        `PRICE_FLOOR_ABOVE_CEILING: maxCeilingPrice ${config.maxCeilingPrice} < minFloorPrice ${config.minFloorPrice}`
      );
    }
  }

  // 6. 逆向违约阶梯合法性（D6 资金维度三件套边界）
  for (const tier of config.cancellationTiers ?? []) {
    if (!inUnitInterval(tier.demanderRefundRatio)) {
      errors.push(
        `CANCELLATION_TIER_INVALID: demanderRefundRatio must be in [0,1] at stage ${tier.stage}`
      );
    }
    if (!inUnitInterval(tier.deductDepositRatio)) {
      errors.push(
        `CANCELLATION_TIER_INVALID: deductDepositRatio must be in [0,1] at stage ${tier.stage}`
      );
    }
    if (!isFiniteNumber(tier.providerCompensationYuan) || tier.providerCompensationYuan < 0) {
      errors.push(
        `CANCELLATION_TIER_INVALID: providerCompensationYuan must be >= 0 at stage ${tier.stage}`
      );
    }
  }

  // 7. 钩子名解析（D5 正向钩子只能引用静态白名单）
  for (const hookName of config.forwardHooks ?? []) {
    if (!(hookName in HOOK_OPERATOR_REGISTRY)) {
      errors.push(`UNKNOWN_HOOK_OPERATOR: ${hookName} is not in HOOK_OPERATOR_REGISTRY`);
    }
  }

  // 8. 发布端中文类目检索别名（D8 声明式别名：非法条目拒绝出厂）
  for (const alias of config.aliases ?? []) {
    if (typeof alias !== "string" || alias.trim() === "") {
      errors.push("INVALID_AMMO_ALIAS: aliases must be non-empty strings");
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/* =====================================================================
 * ④ 不可变发布（全图冻结 · 装填即冻结）
 * ===================================================================== */

/** 递归深度冻结（标准不可变弹药：装配产物及其引用对象全部只读）。 */
export function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object") {
    for (const key of Object.getOwnPropertyNames(value)) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== null && typeof child === "object") deepFreeze(child);
    }
    Object.freeze(value);
  }
  return value as Readonly<T>;
}

/* =====================================================================
 * ③ 沙箱组装器（Sandbox Assembler）
 * ===================================================================== */

export type AssembledAmmoResult =
  | { ok: true; ammo: Readonly<IAmmoDefinition> }
  | { ok: false; errors: string[] };

/**
 * 弹药组装（四道工序一体机）：
 * 静态审查通过 → 白名单解析 D5 钩子 → 投影标准 IAmmoDefinition →
 * 全图冻结不可变发布（红线 1：无任何动态代码执行通道）。
 */
export function assembleAmmo(config: IHolographicAmmoConfig): AssembledAmmoResult {
  const verdict = validateAmmoConfig(config);
  if (!verdict.ok) return { ok: false, errors: verdict.errors };

  const fiveStateHooks = (config.forwardHooks ?? []).map(
    (name) => HOOK_OPERATOR_REGISTRY[name]
  );

  const ammo: IAmmoDefinition = {
    ammoId: config.ammoId,
    category: config.category,
    version: config.version,
    fiveStateHooks,
    pricingModel: config.pricingModel,
    fuzePolicy: config.fuzePolicy,
    workerRequirement: config.workerRequirement,
    creditWaiverRule: config.creditWaiverRule,
    maxSurchargeRatio: config.maxSurchargeRatio,
    autoAcceptanceTimeoutHours: config.autoAcceptanceTimeoutHours,
    supplyCluster: config.supplyCluster,
    holographic: config,
    // 战役 3 · 8D 自包含透传：派单规则与 SOP 随弹出厂（缺省不注入，
    // 由四表聚合/默认兜底——存量弹与既有考卷零回归）。
    ...(config.dispatchRule ? { dispatchRule: config.dispatchRule } : {}),
    ...(config.sop ? { sop: config.sop } : {}),
  };

  return { ok: true, ammo: deepFreeze(ammo) };
}

/* =====================================================================
 * 运行时热注册器（Hot-Registry）
 * ===================================================================== */

export type DynamicRegistrationResult =
  | { ok: true; ammo: Readonly<IAmmoDefinition>; registered: boolean }
  | { ok: false; errors: string[] };

/**
 * 动态热注册：组装弹药并按 category 注入 `src/ammo/registry.ts` 的运行时
 * 动态弹药池（DYNAMIC_AMMO_POOL），getAmmoDefinition(category) 即时生效。
 * 审查不过 → 拒绝入池（不污染现行弹药检索链路）。
 */
export function registerDynamicAmmo(
  config: IHolographicAmmoConfig
): DynamicRegistrationResult {
  const assembled = assembleAmmo(config);
  if (!assembled.ok) return { ok: false, errors: assembled.errors };
  DYNAMIC_AMMO_POOL.set(assembled.ammo.category, assembled.ammo);
  return { ok: true, ammo: assembled.ammo, registered: true };
}