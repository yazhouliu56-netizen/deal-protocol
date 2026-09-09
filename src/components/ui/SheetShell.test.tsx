// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import SheetShell, { SHEET_PANEL_DEFAULT, SheetClose } from "./SheetShell";

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
});

function mount(ui: React.ReactElement) {
  host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(ui);
  });
  return { host: host as HTMLDivElement, unmount: () => act(() => root.unmount()) };
}

describe("SheetShell 白弹层结构壳（P9-2）", () => {
  it("默认渲染遮罩+面板+children（面板走标准白卡 3D）", () => {
    const { host, unmount } = mount(
      <SheetShell onClose={() => {}}>
        <span>内容</span>
      </SheetShell>,
    );
    expect(host.querySelector('[data-testid="sheet-mask"]')).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain("内容");
    expect(host.innerHTML).toContain("border-b-[6px]");
    unmount();
  });

  it("panelClassName 整串替换默认（PaySheet bottom-8 语义守恒）", () => {
    const custom = "fixed inset-x-3 bottom-8 z-[60] custom";
    const { host, unmount } = mount(
      <SheetShell onClose={() => {}} panelClassName={custom}>
        <span>内容</span>
      </SheetShell>,
    );
    expect(host.querySelector('[role="dialog"]')?.className).toContain("bottom-8");
    expect(host.innerHTML).not.toContain("bottom-24");
    unmount();
  });

  it("SHEET_PANEL_DEFAULT 即 Favorites/Publish 标准形", () => {
    expect(SHEET_PANEL_DEFAULT).toContain("inset-x-3 bottom-24");
    expect(SHEET_PANEL_DEFAULT).toContain("border-b-[6px]");
  });

  it("遮罩点击触发 onClose", () => {
    const fn = vi.fn();
    const { host, unmount } = mount(<SheetShell onClose={fn}>内容</SheetShell>);
    act(() => {
      (host.querySelector('[data-testid="sheet-mask"]') as HTMLElement).click();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("SheetClose 渲染 aria-label 并触发 onClose（e2e 关闭契约）", () => {
    const fn = vi.fn();
    const { host, unmount } = mount(<SheetClose onClose={fn} label="关闭发布" />);
    const btn = host.querySelector('[aria-label="关闭发布"]') as HTMLElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain("✕");
    act(() => {
      btn.click();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();
  });
});
