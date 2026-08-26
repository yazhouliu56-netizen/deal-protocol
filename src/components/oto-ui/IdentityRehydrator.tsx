"use client";
import { useEffect } from "react";
import { useIdentityStore } from "@/store/useIdentityStore";

/**
 * 身份重水合闸门（D-20260825-01 根治 · 缺陷→考卷复利条款）：
 * useIdentityStore 采用 skipHydration——模块加载期不再同步回灌 localStorage，
 * SSR 首帧与客户端水合首帧恒为默认态（光点/✨）同构；本组件挂载于 (oto)/layout，
 * 在水合提交完成的 effect 里显式 rehydrate 注入持久化身份，并空 set 一次确保
 * 合并结果落盘（persist 键的首访落盘已在 store 模块加载期同步完成）。
 */
export default function IdentityRehydrator() {
  useEffect(() => {
    const pending = useIdentityStore.persist.rehydrate();
    const done = pending && typeof pending.then === "function" ? pending : null;
    const commit = () =>
      useIdentityStore.setState((s) => ({ claimQuota: s.claimQuota }));
    if (done) done.then(commit);
    else commit();
  }, []);
  return null;
}
