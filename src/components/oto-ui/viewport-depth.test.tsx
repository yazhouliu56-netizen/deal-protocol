// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, beforeEach } from "vitest";

import { lockEdgeGesture, readEdgeGestureLock, resetEdgeGestureLock, useEdgeGestureLock } from "@/components/oto-ui/edgeGestureLock";

function DepthProbe({ onDepth }: { onDepth: (v: boolean) => void }) {
  const locked = useEdgeGestureLock();
  onDepth(locked);
  return <div data-depth-active={locked ? "true" : "false"} data-testid="depth-probe" />;
}

describe("视口景深微缩（Viewport Depth）· 250ms 硬件加速", () => {
  beforeEach(() => {
    resetEdgeGestureLock();
  });

  it("lockEdgeGesture(true) → useEdgeGestureLock 订阅端同步为 true（驱动 scale 0.96 + brightness 0.85）", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let depth = false;
    act(() => {
      root.render(<DepthProbe onDepth={(v) => { depth = v; }} />);
    });
    expect(depth).toBe(false);
    expect(readEdgeGestureLock()).toBe(false);
    act(() => { lockEdgeGesture(true); });
    expect(readEdgeGestureLock()).toBe(true);
    // 重新渲染后订阅端应同步
    act(() => { root.render(<DepthProbe onDepth={(v) => { depth = v; }} />); });
    expect(depth).toBe(true);
    expect(container.querySelector('[data-testid="depth-probe"]')!.getAttribute("data-depth-active")).toBe("true");
    act(() => root.unmount());
    container.remove();
  });

  it("lockEdgeGesture(false) → 视口复位 scale-100 + brightness-100（无重排，仅 transform/filter）", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    lockEdgeGesture(true);
    let depth = true;
    act(() => {
      root.render(<DepthProbe onDepth={(v) => { depth = v; }} />);
    });
    expect(depth).toBe(true);
    act(() => { lockEdgeGesture(false); });
    expect(readEdgeGestureLock()).toBe(false);
    act(() => { root.render(<DepthProbe onDepth={(v) => { depth = v; }} />); });
    expect(depth).toBe(false);
    act(() => root.unmount());
    container.remove();
  });

  it("景深容器样式仅使用 transform/opacity 硬件加速（will-change + transition-all 250ms origin-top）", async () => {
    // 源码静态校验：Home 景深容器必须含 will-change 与 transform/opacity 驱动
    const fs = await import("fs");
    const path = await import("path");
    const homeSrc = fs.readFileSync(path.join(process.cwd(), "src/app/(oto)/page.tsx"), "utf-8");
    expect(homeSrc).toContain("scale-[0.96]");
    expect(homeSrc).toContain("brightness-[0.85]");
    expect(homeSrc).toContain("duration-250");
    expect(homeSrc).toContain("origin-top");
    expect(homeSrc).toContain("will-change");
    expect(homeSrc).toContain("data-depth-active");
    // 严禁重排属性（width/height/top/left）驱动动画
    expect(homeSrc).not.toMatch(/transition-all[^;]*width/);
  });
});
