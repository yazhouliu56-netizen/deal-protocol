/**
 * AmmoRunner 通用运行引擎（P0-1 · 人类创始人注入契约的执行端）。
 *
 * 红线 3：`types ⇐ base ⇐ ammo/UI` 单向依赖，本模块为纯函数层，零业务依赖：
 *   1. 五态投影桥 toAtomicFiveState —— 存量 Wave/Claim 生命周期 → 五态视图；
 *   2. 生命周期调度器 advanceLifecycle —— 跃迁矩阵校验 + BEFORE/AFTER 钩子
 *      调度（SKIP/BLOCK/DEFER 降级）+ 终止事件捕获（携带结算载荷流转至
 *      SETTLED，人类裁决 1）；
 *   3. 引信快速核验器 evaluateAmmoFuze —— 三类引信的静态/动态规则核验。
 */

import type {
  AtomicFiveState,
  IAmmoDefinition,
  ISubEventContext,
  ISubEventHook,
  ISubEventResult,
  ITerminationEvent,
  TerminationKind,
} from "../../types/ammo-schema.ts";
import { FIVE_STATE_TRANSITIONS } from "../../types/ammo-schema.ts";
import type { IFuzePolicy } from "../../types/fuze-policy.ts";
import type { FuzeType } from "../../types/fuze-policy.ts";
import {
  calculateEscrowHold,
  calculateMultiPartySplit,
  calculateTieredRefund,
  generateComplianceSplitInstruction,
  verifyFundSafetyGuard,
} from "../money/escrow.ts";

/* =====================================================================
 * 1. 五态投影桥（人类裁决 3：纯函数运行时投影，不做状态迁移）
 * ===================================================================== */

export interface FiveStateProjectionInput {
  waveStatus?: string;
  claimStatus?: string;
  /** 履约子机：reported = 已申报（serviceDoneAt）；confirmed = 已验收。 */
  fulfilmentStatus?: string;
  /** 已结算（资金终局/终止事件落定）。 */
  isSettled?: boolean;
}

/**
 * 存量订单生命周期 → 五态视图投影（与 base/order/orderCore 同模式：
 * 只增不改，投影桥不触碰原状态字段）。
 *
 * 映射优先级：SETTLED(结算) ➔ INSPECTED(验收) ➔ IN_SERVICE(履约中)
 *   ➔ MATCHED(claimed/locked/assembled/accepted) ➔ PUBLISHED(pending/active)。
 * 分支终态（closed/expired/breached/withdrawn）不在五态成员内——由调用方
 * 在终止事件落定后以 isSettled=true 表达（人类裁决 1）；未带终止标记时
 * 保守兜底 PUBLISHED（文档级语义：投影函数只回答「当前属于五态哪个」）。
 */
export function toAtomicFiveState(ctx: FiveStateProjectionInput): AtomicFiveState {
  if (ctx.isSettled) return "SETTLED";
  if (ctx.fulfilmentStatus === "confirmed") return "INSPECTED";
  if (ctx.fulfilmentStatus === "reported") return "IN_SERVICE";
  if (
    ctx.claimStatus === "accepted" ||
    ctx.claimStatus === "joined" ||
    ctx.claimStatus === "negotiating" ||
    ctx.claimStatus === "offered"
  ) {
    return "MATCHED";
  }
  if (
    ctx.waveStatus === "claimed" ||
    ctx.waveStatus === "locked" ||
    ctx.waveStatus === "assembled"
  ) {
    return "MATCHED";
  }
  return "PUBLISHED";
}

/* =====================================================================
 * 2. 生命周期调度器
 * ===================================================================== */

export interface AdvanceInput {
  /** 弹药定义（钩子清单 + 引信 + SOP 均由弹药自描述）。 */
  ammo: IAmmoDefinition;
  /**
   * 在途订单弹药快照（快照冻结机制 · 热更新免疫，2026-08-16）：
   * 订单进入履约链路时由调用方冻结注册表当前时点的整弹快照；
   * 推进时若提供 ammoSnapshot，状态机的一切跃迁矩阵校验、BEFORE/AFTER
   * 钩子调度、引信核验、防坐地起价熔断与资金托管挂接均严格基于该快照
   * 执行（快照优先，ammo 仅作缺省回落）——线上 AmmoFactory 热注册的新版
   * 弹药与在途订单完全隔离，进行中订单逻辑零污染。
   */
  ammoSnapshot?: IAmmoDefinition;
  /** 业务单号（wave id / order id）。 */
  orderId: string;
  from: AtomicFiveState;
  to: AtomicFiveState;
  /**
   * 订单 CAS 乐观锁版本号（mvp 标准表 orders.version 的运行时镜像）：
   * - expectedVersion：调用方读取订单时快照的版本号；
   * - currentVersion：写回前的当前磁盘版本号（调用方在跃迁前的 SELECT）。
   * 两者齐备时执行 CAS 校验（不等 → BLOCK + OPTIMISTIC_LOCK_VERSION_CONFLICT）；
   * 双缺省 = 非版本化调用（跳过校验，兼容既有零版本调用，零回归）。
   */
  currentVersion?: number;
  expectedVersion?: number;
  /** 跃迁载荷（透传给钩子；如现场增项报价单）。 */
  payload?: Record<string, unknown>;
  /**
   * 终止事件（人类裁决 1）：分支终态（取消/超时/违约结算）以伴生事件
   * 承载，携带结算载荷强制流转至 SETTLED（跳过跃迁矩阵，主状态机封闭）。
   */
  termination?: { kind: TerminationKind; payload?: Record<string, unknown> };
  now?: number;
}

export interface HookOutcome {
  hookId: string;
  ok: boolean;
  reason?: string;
  data?: unknown;
  /** 钩子失败时实际采用的降级（NONE = 成功；BLOCK = 阻止跃迁，见 ISubEventHook.fallback）。 */
  fallbackUsed: "NONE" | "SKIP" | "DEFER" | "BLOCK";
}

export interface AdvanceResult {
  ok: boolean;
  /** 实际到达态（BEFORE 钩子 BLOCK 时 = from）。 */
  state: AtomicFiveState;
  reason?: string;
  /**
   * 跃迁成功后的 CAS 递增版本号（= (currentVersion ?? 0) + 1，仅版本化
   * 调用返回）：调用方以它为 orders.version 的新值写回，完成乐观锁闭环。
   */
  nextVersion?: number;
  /** 终止事件（触发终止流转时生成，携带结算载荷）。 */
  termination?: ITerminationEvent;
  hookOutcomes: HookOutcome[];
  /** AFTER 钩子的透传结果数据（如验收照片清单）。 */
  afterData: unknown[];
}

/* =====================================================================
 * 2.1 资金托管与清结算挂接（L2-M4 账户清结算 · 阶段二深水区收敛）
 * ===================================================================== */

/** 跃迁资金载荷（payload.escrowPayload，MATCHED 校验 / SETTLED 装配）。 */
export interface EscrowPayload {
  /** 订单托管总额（原价，必填）。 */
  amount: number;
  /** 保证金托管率（缺省走 escrow 默认全款托管语义）。 */
  depositRate?: number;
  /** 需求方当前余额（提供时触发资金安全底线校验）。 */
  balance?: number;
  /** 平台抽成率（缺省 0.1，结算分账用）。 */
  platformRate?: number;
  /** 参与人数（AA 组局 ≥2 走人均分摊，缺省 1）。 */
  participants?: number;
  /** 阶梯退款载荷（违约/提前终止结算用）。 */
  refund?: { elapsedRatio?: number; isBreach?: boolean };
}

/** 清结算对账清单（SETTLED 终局装配；四大弹药统一产出，L2-M4 权威对账）。 */
export interface SettlementLedger {
  ammoId: string;
  orderId: string;
  status: "SETTLED";
  /** 初始托管载荷（MATCHED 时锁定）。 */
  hold: { totalAmount: number; heldDeposit: number; payableAmount: number };
  /** 正常结算分账（AA 人均 + 平台抽成 + 服务方净得；弹药 D7 三比装配时含保险计提）。 */
  split?: {
    perSeatCost: number;
    platformIncome: number;
    providerIncome: number;
    /** 保险计提（履约险/兜底池；仅弹药 D7 splitRules 缺省装配路径产出，宪法 #2 增补）。 */
    insuranceFee?: number;
  };
  /** 违约/提前终止阶梯退款（守恒：refund + pay + fee ≡ total）。 */
  refund?: { refundToDemander: number; payToProvider: number; platformFee: number };
  providerIncome: number;
  platformIncome: number;
  demanderRefund: number;
  /** S4 合规分账指令（防二清；仅显式传入 compliance 路由时产出）。 */
  compliance?: ReturnType<typeof generateComplianceSplitInstruction>;
}

/**
 * 弹药 D7 三比分账（缺省装配路径：未显式指定平台费率时强制消费弹药声明比例）。
 * provider = 总额 × providerRatio，insurance = 总额 × insuranceRatio，
 * platform = 总额 − provider − insurance（四舍五入尾差归平台，三方之和严格 ≡ 总额）。
 * 与前序发动机口径（90/10）同守恒语义：provider + platform + insurance === total。
 */
function calculateAmmoThreeWaySplit(
  totalAmount: number,
  rules: { providerRatio: number; platformRatio: number; insuranceRatio: number },
  participantsCount: number,
): { perSeatCost: number; platformIncome: number; providerIncome: number; insuranceFee: number } {
  const total = Number.isFinite(totalAmount) && totalAmount > 0 ? totalAmount : 0;
  const count = Number.isInteger(participantsCount) && participantsCount > 0 ? participantsCount : 1;
  const round2c = (n: number): number => Math.round(n * 100) / 100;
  const providerIncome = round2c(total * rules.providerRatio);
  const insuranceFee = round2c(total * rules.insuranceRatio);
  const platformIncome = round2c(total - providerIncome - insuranceFee);
  return { perSeatCost: round2c(total / count), platformIncome, providerIncome, insuranceFee };
}

/**
 * 结算对账清单装配（纯函数，确定性清结算——红线 1：零 LLM 判断）。
 * 违约/退款载荷存在 → 走阶梯退款；否则 → 多方分账（AA 人均 + 平台抽成）。
 * 分账口径：显式传入 platformRate 时尊重显式费率（既有调用语义零变化）；
 * 未显式传入且弹药声明 D7 splitRules 时，强制消费弹药三比（家政 85/10/5 等），
 * 保险计提入账对账单——消除 90/10 兜底与分账指令间的 ¥8.50 口径裂隙。
 */
export function buildSettlementLedger(input: {
  ammo: IAmmoDefinition;
  orderId: string;
  amount: number;
  depositRate?: number;
  platformRate?: number;
  participants?: number;
  refund?: { elapsedRatio?: number; isBreach?: boolean };
  /** S4 合规分账路由（防二清；缺省 = 不产出分账指令，兼容既有调用）。 */
  compliance?: {
    channel: "WECHAT_PAY" | "STRIPE_CONNECT" | "BANK_ESCROW";
    receiverAccountId: string;
  };
}): SettlementLedger {
  const hold = calculateEscrowHold(input.amount, input.depositRate);
  if (input.refund) {
    const tiered = calculateTieredRefund(
      input.amount,
      input.refund.elapsedRatio ?? 0.5,
      input.refund.isBreach === true,
    );
    return {
      ammoId: input.ammo.ammoId,
      orderId: input.orderId,
      status: "SETTLED",
      hold,
      refund: tiered,
      providerIncome: tiered.payToProvider,
      platformIncome: tiered.platformFee,
      demanderRefund: tiered.refundToDemander,
      compliance: input.compliance
        ? generateComplianceSplitInstruction(
            {
              platformFee: tiered.platformFee,
              payToProvider: tiered.payToProvider,
              refundToDemander: tiered.refundToDemander,
            },
            input.compliance.channel,
            {
              orderId: input.orderId,
              receiverAccountId: input.compliance.receiverAccountId,
            },
          )
        : undefined,
    };
  }
  const split =
    input.platformRate === undefined && input.ammo.holographic?.splitRules
      ? calculateAmmoThreeWaySplit(
          input.amount,
          input.ammo.holographic.splitRules,
          input.participants ?? 1,
        )
      : calculateMultiPartySplit(
          input.amount,
          input.platformRate ?? 0.1,
          input.participants ?? 1,
        );
  return {
    ammoId: input.ammo.ammoId,
    orderId: input.orderId,
    status: "SETTLED",
    hold,
    split,
    providerIncome: split.providerIncome,
    platformIncome: split.platformIncome,
    demanderRefund: 0,
    compliance: input.compliance
      ? generateComplianceSplitInstruction(
          {
            platformFee: split.platformIncome,
            providerNet: split.providerIncome,
            demanderRefund: 0,
          },
          input.compliance.channel,
          {
            orderId: input.orderId,
            receiverAccountId: input.compliance.receiverAccountId,
          },
        )
      : undefined,
  };
}

function hookMatches(
  hook: ISubEventHook,
  from: AtomicFiveState,
  to: AtomicFiveState
): boolean {
  if ("from" in hook.on) return hook.on.from === from && hook.on.to === to;
  return hook.on.to === to;
}

async function runHookSafely(
  hook: ISubEventHook,
  ctx: ISubEventContext
): Promise<{ result?: ISubEventResult; thrown?: Error }> {
  try {
    return { result: await hook.run(ctx) };
  } catch (e) {
    return { thrown: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * 生命周期推进：校验跃迁矩阵 → BEFORE 钩子（BLOCK 可阻止）→ 推进 →
 * AFTER 钩子（副作用透传）。BEFORE 钩子失败按弹药声明降级：
 * BLOCK 阻止跃迁 / SKIP 忽略 / DEFER 记录待重试（由调用方持久化队列）。
 *
 * 快照优先（快照冻结机制）：input.ammoSnapshot 存在时，本函数全部逻辑
 * （矩阵 / 钩子 / 引信 / 熔断 / 资金）严格基于快照执行——进行中订单免疫
 * 线上弹药热更新；缺省回落 input.ammo（既有调用零回归）。
 */
export async function advanceLifecycle(input: AdvanceInput): Promise<AdvanceResult> {
  const now = input.now ?? Date.now();
  const ammo = input.ammoSnapshot ?? input.ammo;
  const target: AtomicFiveState = input.termination ? "SETTLED" : input.to;

  // 非终止路径：跃迁矩阵校验（唯一合法流向）
  if (!input.termination && !FIVE_STATE_TRANSITIONS[input.from].includes(input.to)) {
    return {
      ok: false,
      state: input.from,
      reason: `illegal-transition: ${input.from} -> ${input.to}`,
      hookOutcomes: [],
      afterData: [],
    };
  }

  // CAS 乐观锁校验（mvp 标准表 orders.version 运行时镜像，红线 1 确定性）：
  // 调用方同时携带 currentVersion（磁盘现值）与 expectedVersion（读取快照）
  // 才激活比对——双缺省 = 非版本化调用，跳过校验（兼容既有零版本调用，
  // 零回归）；不等 = 并发写入已被他人提交，直接阻断跃迁返回 BLOCK
  // （OPTIMISTIC_LOCK_VERSION_CONFLICT），调用方须重读订单后重试。
  const isVersionAware =
    input.currentVersion !== undefined || input.expectedVersion !== undefined;
  if (
    input.expectedVersion !== undefined &&
    input.currentVersion !== undefined &&
    input.currentVersion !== input.expectedVersion
  ) {
    return {
      ok: false,
      state: input.from,
      reason: `optimistic-lock-conflict: OPTIMISTIC_LOCK_VERSION_CONFLICT expected ${input.expectedVersion} but got ${input.currentVersion}`,
      hookOutcomes: [],
      afterData: [],
    };
  }

  const ctxBase: ISubEventContext = {
    ammoId: ammo.ammoId,
    orderId: input.orderId,
    from: input.from,
    to: target,
    // 快照冻结透传：钩子闭包可读当前依赖的弹药快照（ammoSnapshot 优先）
    ...(input.ammoSnapshot ? { ammoSnapshot: input.ammoSnapshot } : {}),
    // CAS 版本号透传进钩子上下文（弹药闭包可读当前/期望版本做伴随校验）
    ...(isVersionAware
      ? {
          currentVersion: input.currentVersion,
          expectedVersion: input.expectedVersion,
        }
      : {}),
    // 终止路径：结算载荷（termination.payload）合并进钩子上下文，
    // 使 SETTLED 阶段的 AFTER 钩子（如 AA 分账）能读取违约赔付载荷。
    payload: input.termination
      ? { ...(input.payload ?? {}), ...input.termination.payload }
      : input.payload,
  };

  const hookOutcomes: HookOutcome[] = [];

  // BEFORE 钩子：先校验，BLOCK 可阻止跃迁
  for (const hook of ammo.fiveStateHooks) {
    if (hook.phase !== "BEFORE" || !hookMatches(hook, input.from, target)) continue;
    const { result, thrown } = await runHookSafely(hook, ctxBase);
    const ok = !thrown && result?.ok !== false;
    if (!ok) {
      // 失败一律按钩子声明的 fallback 降级（BLOCK 阻止 / SKIP 忽略 / DEFER 暂存）
      hookOutcomes.push({
        hookId: hook.hookId,
        ok: false,
        reason: thrown ? thrown.message : result?.reason,
        fallbackUsed: hook.fallback,
      });
      if (hook.fallback === "BLOCK") {
        return {
          ok: false,
          state: input.from,
          reason: `hook-blocked: ${hook.hookId}${result?.reason ? ` · ${result.reason}` : ""}`,
          hookOutcomes,
          afterData: [],
        };
      }
      continue;
    }
    hookOutcomes.push({ hookId: hook.hookId, ok: true, fallbackUsed: "NONE" });
  }

  // 状态推进
  const state: AtomicFiveState = target;
  const termination: ITerminationEvent | undefined = input.termination
    ? {
        kind: input.termination.kind,
        at: now,
        orderId: input.orderId,
        from: input.from,
        payload: input.termination.payload,
      }
    : undefined;

  // AFTER 钩子：副作用（失败不改变已推进的状态）
  const afterData: unknown[] = [];
  for (const hook of ammo.fiveStateHooks) {
    if (hook.phase !== "AFTER" || !hookMatches(hook, input.from, target)) continue;
    const { result, thrown } = await runHookSafely(hook, {
      ...ctxBase,
      to: state,
    });
    const ok = !thrown && result?.ok !== false;
    if (!ok) {
      hookOutcomes.push({
        hookId: hook.hookId,
        ok: false,
        reason: thrown ? thrown.message : result?.reason,
        fallbackUsed: hook.fallback,
      });
      continue;
    }
    hookOutcomes.push({ hookId: hook.hookId, ok: true, fallbackUsed: "NONE" });
    if (result?.data !== undefined) afterData.push(result.data);
  }

  // 资金托管挂接（L2-M4，仅 payload.escrowPayload 存在时激活——零载荷
  // 完全透传，既有跃迁行为不变；资金校验失败按准入语义 BLOCK 回退）。
  const escrowPayload = ctxBase.payload?.escrowPayload as EscrowPayload | undefined;

  // S2 防坐地起价熔断（50% 上限，商业防脆弱 · 确定性校验，红线 1）：
  // 弹药声明 maxSurchargeRatio 时，现场增项金额（onsiteQuote.totalYuan）
  // 不得超过初始基准价 × 上限比例。基准价取 escrowPayload.amount（订单托管
  // 总额）或 payload.baseAmountYuan（调用方显式注入）；两者均缺省则跳过
  // 校验（兼容既有零载荷调用，零回归）。
  const onsiteQuote = ctxBase.payload?.onsiteQuote as
    | { totalYuan?: number }
    | undefined;
  const surchargeBase =
    escrowPayload?.amount ?? (ctxBase.payload?.baseAmountYuan as number | undefined);
  if (
    onsiteQuote &&
    surchargeBase !== undefined &&
    Number.isFinite(surchargeBase) &&
    surchargeBase > 0 &&
    ammo.maxSurchargeRatio !== undefined
  ) {
    const limit = ammo.maxSurchargeRatio;
    const maxAllowed = surchargeBase * limit;
    const quoteTotal = Number(onsiteQuote.totalYuan ?? 0);
    if (!Number.isFinite(quoteTotal) || quoteTotal > maxAllowed) {
      return {
        ok: false,
        state: input.from,
        reason: `anti-gouging-blocked: ANTI_GOUGING_LIMIT_EXCEEDED surcharge ${quoteTotal} exceeds ${limit * 100}% of base ${surchargeBase} (max ${maxAllowed})`,
        hookOutcomes,
        afterData,
      };
    }
  }

  if (escrowPayload) {
    const hold = calculateEscrowHold(escrowPayload.amount, escrowPayload.depositRate);
    if (hold.totalAmount <= 0) {
      return {
        ok: false,
        state: input.from,
        reason: `escrow-hold-invalid: amount must be positive (got ${escrowPayload.amount})`,
        hookOutcomes,
        afterData,
      };
    }
    if (
      escrowPayload.balance !== undefined &&
      !verifyFundSafetyGuard(escrowPayload.balance, hold.heldDeposit)
    ) {
      return {
        ok: false,
        state: input.from,
        reason: `escrow-fund-safety-guard: balance ${escrowPayload.balance} < required hold ${hold.heldDeposit}`,
        hookOutcomes,
        afterData,
      };
    }
    if (target === "MATCHED") {
      afterData.push({ escrow: hold });
    } else if (target === "SETTLED") {
      afterData.push({
        settlementLedger: buildSettlementLedger({
          ammo,
          orderId: input.orderId,
          amount: escrowPayload.amount,
          depositRate: escrowPayload.depositRate,
          platformRate: escrowPayload.platformRate,
          participants: escrowPayload.participants,
          refund: escrowPayload.refund,
        }),
      });
    }
  }

  // 版本化调用：CAS 写回递增版本号（= 磁盘现值 + 1，调用方落库 orders.version）
  return {
    ok: true,
    state,
    ...(isVersionAware
      ? { nextVersion: (input.currentVersion ?? 0) + 1 }
      : {}),
    termination,
    hookOutcomes,
    afterData,
  };
}

/* =====================================================================
 * 3. 引信快速核验器
 * ===================================================================== */

export interface FuzeEvalContext {
  /** 背调是否已通过（💥 碰炸主闸）。 */
  backgroundVerified?: boolean;
  /** 押金 / 预付冻结是否已到账（💥 押金 + ⏳ 预付冻结）。 */
  depositHeld?: boolean;
  /** LBS 围栏是否已进入（⏳ 延期）。 */
  atArrival?: boolean;
  /** 隐私保护是否就绪（虚拟号已分配，📡 近炸）。 */
  privacyReady?: boolean;
}

export interface FuzeCheck {
  fuzeType: FuzeType;
  rule: string;
  message: string;
}

export interface FuzeEvalResult {
  /** 全部核验项通过 → true。 */
  pass: boolean;
  /** 未通过的核验项（空 = 放行）。 */
  checks: FuzeCheck[];
}

/**
 * 引信快速核验：按弹药声明的 fuzeTypes 逐类执行静态/动态规则。
 * 多引信取并集（任一引信规则不满足即拦截），未声明引信 = 零防护直接放行。
 */
export function evaluateAmmoFuze(
  policy: IFuzePolicy,
  ctx: FuzeEvalContext = {}
): FuzeEvalResult {
  const checks: FuzeCheck[] = [];
  for (const fuzeType of policy.fuzeTypes) {
    if (fuzeType === "IMPACT") {
      if (policy.backgroundCheck !== "NONE" && !ctx.backgroundVerified) {
        checks.push({
          fuzeType,
          rule: "backgroundCheck",
          message: `背调未达标（要求 ${policy.backgroundCheck}）`,
        });
      }
      if (policy.deposit.strategy !== "NONE" && !ctx.depositHeld) {
        checks.push({
          fuzeType,
          rule: "deposit",
          message: `押金未到账（策略 ${policy.deposit.strategy}）`,
        });
      }
    }
    if (fuzeType === "DELAY") {
      if (policy.advanceFreeze.enabled && !ctx.depositHeld) {
        checks.push({ fuzeType, rule: "advanceFreeze", message: "预付冻结未到账" });
      }
      if (policy.geoFence.enabled && !ctx.atArrival) {
        checks.push({ fuzeType, rule: "geoFence", message: "未进入 LBS 电子围栏" });
      }
    }
    if (fuzeType === "PROXIMITY") {
      if (policy.privacy.virtualNumber && !ctx.privacyReady) {
        checks.push({ fuzeType, rule: "privacy", message: "隐私号会话未就绪" });
      }
    }
  }
  return { pass: checks.length === 0, checks };
}
