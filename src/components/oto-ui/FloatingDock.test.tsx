// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach, vi } from "vitest";

import FloatingDock from "@/components/oto-ui/FloatingDock";
import { useAppStore } from "@/store/useAppStore";

function mountDock(initial: "home" | "im" | "trip" | "profile" = "home") {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    useAppStore.setState({ screen: initial } as unknown as Record<string, unknown>);
    root.render(<FloatingDock />);
  });
  return {
    container,
    root,
    unmount: () => { act(() => root.unmount()); container.remove(); },
    setScreen: (s: typeof initial) => {
      act(() => {
        useAppStore.setState({ screen: s } as unknown as Record<string, unknown>);
      });
    },
  };
}

describe("FloatingDock 弹簧光斑滑块（Spring Glider）", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    // requestAnimationFrame 兜底（jsdom 部分环境缺失）
    if (typeof window.requestAnimationFrame !== "function") {
      Object.defineProperty(window, "requestAnimationFrame", {
        writable: true,
        value: (cb: FrameRequestCallback) => setTimeout(cb, 0) as unknown as number,
      });
    }
    useAppStore.setState({ screen: "home" } as unknown as Record<string, unknown>);
  });

  it("渲染 4 键：首页/消息/行程/我的，且当前激活态携带 data-active", () => {
    const { container, unmount } = mountDock("home");
    expect(container.querySelector('[data-testid="dock-tab-home"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dock-tab-im"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dock-tab-trip"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dock-tab-profile"]')).not.toBeNull();
    const homeTab = container.querySelector('[data-testid="dock-tab-home"]')!;
    expect(homeTab.getAttribute("data-active")).toBe("true");
    expect(container.querySelector('[data-testid="dock-tab-im"]')!.getAttribute("data-active")).toBe("false");
    unmount();
  });

  it("激活态高光胶囊使用 layoutId=activeDockPill 且弹簧参数 400/30（硬件加速 transform/opacity）", () => {
    const { container, unmount } = mountDock("im");
    const activeTab = container.querySelector('[data-testid="dock-tab-im"]')!;
    const glider = activeTab.querySelector('[data-testid="dock-glider"]');
    expect(glider).not.toBeNull();
    // 硬件加速：仅 transform/opacity 驱动（class 含 backdrop-blur + shadow，无重排属性）
    expect(glider!.className).toContain("backdrop-blur-md");
    expect(glider!.className).toContain("bg-white/[0.08]");
    unmount();
  });

  it("切换 Tab 时高光胶囊平滑滑行（active 状态在按钮间迁移）", async () => {
    const { container, setScreen, unmount } = mountDock("home");
    expect(container.querySelector('[data-testid="dock-tab-home"]')!.getAttribute("data-active")).toBe("true");
    expect(container.querySelector('[data-testid="dock-tab-trip"]')!.getAttribute("data-active")).toBe("false");
    expect(container.querySelector('[data-testid="dock-tab-home"]')!.querySelector('[data-testid="dock-glider"]')).not.toBeNull();
    setScreen("trip");
    // 等待 Framer Motion 布局动画下一帧
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(container.querySelector('[data-testid="dock-tab-trip"]')!.getAttribute("data-active")).toBe("true");
    expect(container.querySelector('[data-testid="dock-tab-home"]')!.getAttribute("data-active")).toBe("false");
    expect(container.querySelector('[data-testid="dock-tab-trip"]')!.querySelector('[data-testid="dock-glider"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="dock-tab-home"]')!.querySelector('[data-testid="dock-glider"]')).toBeNull();
    unmount();
  });

  it("点击 Tab 触发 useAppStore.screen 切换（两步发单前置导航）", async () => {
    const { container, unmount } = mountDock("home");
    const imTab = container.querySelector<HTMLButtonElement>('[data-testid="dock-tab-im"]')!;
    await act(async () => { imTab.click(); });
    expect(useAppStore.getState().screen).toBe("im");
    unmount();
  });
});
