// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authParam = vi.hoisted(() => ({ value: "open" }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (key: string) => (key === "auth" ? authParam.value : null),
  }),
}));

import { AuthUrlGate, shouldAutoOpenAuth } from "@/app/(oto)/page";

const AUTH_OPEN_EVENT = "oto:auth-open";
const SHEET_SEL = '[data-testid="auth-sheet"]';

function mountGate() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<AuthUrlGate />);
  });
  return { container, root };
}

function unmount(root: ReturnType<typeof createRoot>, container: HTMLDivElement) {
  act(() => root.unmount());
  container.remove();
}

/** 模拟抽屉 DOM 出现再移除（AuthSheet 打开时挂载 [data-testid="auth-sheet"]，关闭即卸载）。
 *  中间 flush 一次：真实时序中「挂载」与「220ms 离场后卸载」是两个独立 MutationObserver 回调。 */
async function simulateSheetClose() {
  act(() => {
    const sheet = document.createElement("div");
    sheet.setAttribute("data-testid", "auth-sheet");
    document.body.appendChild(sheet);
  });
  await flush();
  act(() => {
    document.querySelector(SHEET_SEL)?.remove();
  });
}

const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe("shouldAutoOpenAuth（URL ?auth 唤起判定纯函数）", () => {
  it("open / login → true", () => {
    expect(shouldAutoOpenAuth("open")).toBe(true);
    expect(shouldAutoOpenAuth("login")).toBe(true);
  });

  it("其余任意值 / 缺失 → false", () => {
    expect(shouldAutoOpenAuth("register")).toBe(false);
    expect(shouldAutoOpenAuth("")).toBe(false);
    expect(shouldAutoOpenAuth(null)).toBe(false);
  });
});

describe("AuthUrlGate（?auth=open|login 落地自动唤起登录抽屉）", () => {
  beforeEach(() => {
    authParam.value = "open";
  });

  it("auth=open → 自动发出 oto:auth-open 全局唤起事件", async () => {
    const spy = vi.fn();
    window.addEventListener(AUTH_OPEN_EVENT, spy);
    const { root, container } = mountGate();
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_OPEN_EVENT, spy);
    unmount(root, container);
  });

  it("auth=login → 同样自动唤起", async () => {
    authParam.value = "login";
    const spy = vi.fn();
    window.addEventListener(AUTH_OPEN_EVENT, spy);
    const { root, container } = mountGate();
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_OPEN_EVENT, spy);
    unmount(root, container);
  });

  it("抽屉关闭（DOM 移除）→ 平滑清除 URL 的 auth 参数（history.replaceState 零整页刷新）", async () => {
    window.history.replaceState(null, "", "/?auth=open");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const { root, container } = mountGate();
    await flush();
    await simulateSheetClose();
    await flush();
    const call = replaceSpy.mock.calls.find(
      ([, , url]) => typeof url === "string" && !url.includes("auth="),
    );
    expect(call).toBeDefined();
    replaceSpy.mockRestore();
    window.history.replaceState(null, "", "/");
    unmount(root, container);
  });

  it("仅打开未关闭（抽屉仍挂载）→ 不清除 URL 参数", async () => {
    window.history.replaceState(null, "", "/?auth=open");
    const replaceSpy = vi.spyOn(window.history, "replaceState");
    const { root, container } = mountGate();
    await flush();
    act(() => {
      const sheet = document.createElement("div");
      sheet.setAttribute("data-testid", "auth-sheet");
      document.body.appendChild(sheet);
    });
    await flush();
    const cleared = replaceSpy.mock.calls.some(
      ([, , url]) => typeof url === "string" && !url.includes("auth="),
    );
    expect(cleared).toBe(false);
    replaceSpy.mockRestore();
    window.history.replaceState(null, "", "/");
    unmount(root, container);
  });

  it("无 auth 参数 → 不发唤起事件", async () => {
    authParam.value = null;
    const spy = vi.fn();
    window.addEventListener(AUTH_OPEN_EVENT, spy);
    const { root, container } = mountGate();
    await flush();
    expect(spy).not.toHaveBeenCalled();
    window.removeEventListener(AUTH_OPEN_EVENT, spy);
    unmount(root, container);
  });
});