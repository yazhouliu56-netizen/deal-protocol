// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

// act 环境显式声明（消除 React「not configured to support act」stderr 噪音）
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

import IdentityAvatar from "@/components/oto-ui/IdentityAvatar";
import IdentityRehydrator from "@/components/oto-ui/IdentityRehydrator";
import { useIdentityStore } from "@/store/useIdentityStore";

/**
 * D-20260825-01 缺陷→考卷复利：身份 rehydrate 水合安全契约。
 *
 * 旧缺陷（已根治）：persist 在模块加载期同步回灌 localStorage → 回访用户
 * 客户端首帧即持持久化昵称/emoji（王姐/🧹），与 SSR 默认态（光点/✨）
 * text mismatch → React #418。根治 = skipHydration + <IdentityRehydrator>
 * 挂载后 effect 显式重水合。
 *
 * 本考卷锁定三条不变量：
 * ① 引导期默认态：localStorage 预置不漂移首帧（#418 不变量）；
 * ② 挂载后重水合：effect 注入持久化身份（功能不回退）；
 * ③ 首访落盘：commit 后 persist 键生成、身份跨 rehydrate 稳定。
 */

function identityStorageKey(): string {
  const found = Object.keys(localStorage).find((k) => k.startsWith("oto-identity-"));
  if (found) return found;
  // 空 set 触发 persist 写入，生成本 tab 的键（tabKey 基于 window.name）
  useIdentityStore.setState((s) => ({ claimQuota: s.claimQuota }));
  return Object.keys(localStorage).find((k) => k.startsWith("oto-identity-"))!;
}

/** 复刻 E2E B 端预置手法：向 persist 载荷注入持久化身份（王姐/🧹）。 */
function presetPersistedIdentity(): void {
  const key = identityStorageKey();
  const raw = JSON.parse(localStorage.getItem(key) || "{}");
  raw.state = raw.state ?? {};
  raw.state.identity = {
    ...useIdentityStore.getState().identity,
    nickname: "王姐",
    emoji: "🧹",
  };
  localStorage.setItem(key, JSON.stringify(raw));
}

describe("D-20260825-01：身份 rehydrate 水合安全契约", () => {
  it("① 引导期默认态：localStorage 已预置但 store 首帧仍为默认（光点/✨）——#418 不变量", () => {
    presetPersistedIdentity();
    expect(useIdentityStore.getState().identity.nickname).toBe("光点");
    expect(useIdentityStore.getState().identity.emoji).toBe("✨");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<IdentityAvatar />);
    });
    // 无重水合闸门时首帧渲染默认 emoji：与 SSR 输出同构，杜绝 text mismatch
    expect(container.textContent).toContain("✨");
    expect(container.textContent).not.toContain("🧹");
    root.unmount();
    container.remove();
  });

  it("② 挂载后重水合：IdentityRehydrator effect 注入持久化身份（王姐/🧹 生效）", async () => {
    presetPersistedIdentity();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <>
          <IdentityRehydrator />
          <IdentityAvatar />
        </>
      );
    });
    expect(useIdentityStore.getState().identity.nickname).toBe("王姐");
    expect(useIdentityStore.getState().identity.emoji).toBe("🧹");
    expect(container.textContent).toContain("🧹");
    root.unmount();
    container.remove();
  });

  it("③ 首访落盘：挂载后 persist 键生成且身份跨 rehydrate 稳定（刷新同身份前提）", async () => {
    const before = useIdentityStore.getState().identity.id;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<IdentityRehydrator />);
    });
    const raw = JSON.parse(localStorage.getItem(identityStorageKey()) || "{}");
    expect(raw?.state?.identity?.id).toBe(before);
    // 再次 rehydrate（模拟 reload 回灌）身份不变
    await act(async () => {
      await useIdentityStore.persist.rehydrate();
    });
    expect(useIdentityStore.getState().identity.id).toBe(before);
    root.unmount();
    container.remove();
  });
});
