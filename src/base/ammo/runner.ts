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
  /** 业务单号（wave id / order id）。 */
  orderId: string;
  from: AtomicFiveState;
  to: AtomicFiveState;
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
  /** 终止事件（触发终止流转时生成，携带结算载荷）。 */
  termination?: ITerminationEvent;
  hookOutcomes: HookOutcome[];
  /** AFTER 钩子的透传结果数据（如验收照片清单）。 */
  afterData: unknown[];
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
 */
export async function advanceLifecycle(input: AdvanceInput): Promise<AdvanceResult> {
  const now = input.now ?? Date.now();
  const ammo = input.ammo;
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

  const ctxBase: ISubEventContext = {
    ammoId: ammo.ammoId,
    orderId: input.orderId,
    from: input.from,
    to: target,
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

  return { ok: true, state, termination, hookOutcomes, afterData };
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
