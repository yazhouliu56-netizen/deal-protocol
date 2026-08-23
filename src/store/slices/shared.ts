/**
 * Slices 共享层（Step 3 切片拆域）：模块级共享变量/函数的唯一归宿，
 * 供多域切片 import —— 严禁 slice 之间互相 import（红线 3 单向依赖）。
 */
"use client";

import { useIdentityStore } from "@/store/useIdentityStore";
import { ageFromBirthYear, ageGate, type MoneyAction } from "@/base/safe/ageGate";

/** ID 序列发生器（全 store 共享单调序号）。 */
export let seq = 0;
export const nextId = (prefix: string) =>
  `${prefix}-${++seq}-${Date.now().toString(36)}`;

/** 未成年人资金闸（ADR-0016）：响应/拼位/竞价等真实资金入口按 ageGate 拦截。
 * 与 PublishSheet 分派一致：未填出生年（age=null）不拦截，已填则按分级判定。 */
export function gateMoneyAction(action: MoneyAction): string | undefined {
  const identity = useIdentityStore.getState().identity;
  if (!identity.birthYear) return undefined;
  const age = ageFromBirthYear(identity.birthYear, new Date().getFullYear());
  const gate = ageGate({ age, action, guardianConsent: identity.guardianConsent });
  return gate.blocked ? gate.reason : undefined;
}
