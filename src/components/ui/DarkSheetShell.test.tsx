// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import DarkSheetShell, { DARK_SHEET_CSS } from "./DarkSheetShell";

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

const base = {
  onClose: () => {},
  maskZ: 80,
  panelZ: 81,
  panelClass: "arb-sheet",
};

describe("DarkSheetShell 暗弹层结构壳（P9-3）", () => {
  it("渲染遮罩+面板+grip（data-action 點擊契约常驻）", () => {
    const { host, unmount } = mount(<DarkSheetShell {...base}>内容</DarkSheetShell>);
    expect(host.querySelector('[data-action="mask"]')).not.toBeNull();
    expect(host.querySelector('[data-action="drag-grip"]')).not.toBeNull();
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(host.textContent).toContain("内容");
    unmount();
  });

  it("z 按原层级透传（arb 80/81 守恒）", () => {
    const { host, unmount } = mount(<DarkSheetShell {...base}>内容</DarkSheetShell>);
    expect((host.querySelector('[data-action="mask"]') as HTMLElement).style.zIndex).toBe("80");
    expect((host.querySelector('[role="dialog"]') as HTMLElement).style.zIndex).toBe("81");
    unmount();
  });

  it("dismissing 切正典离场类", () => {
    const { host, unmount } = mount(
      <DarkSheetShell {...base} dismissing>
        内容
      </DarkSheetShell>,
    );
    expect(host.querySelector('[role="dialog"]')?.className).toContain("dsheet-dismissing");
    expect(DARK_SHEET_CSS).toContain("translateY(105%)");
    unmount();
  });

  it("遮罩点击触发 onClose；maskClosable=false 时不绑定（PrePermission 强制二选一）", () => {
    const fn = vi.fn();
    const { host, unmount } = mount(
      <DarkSheetShell {...base} onClose={fn}>
        内容
      </DarkSheetShell>,
    );
    act(() => {
      (host.querySelector('[data-action="mask"]') as HTMLElement).click();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    unmount();

    const fn2 = vi.fn();
    const m2 = mount(
      <DarkSheetShell {...base} onClose={fn2} maskClosable={false}>
        内容
      </DarkSheetShell>,
    );
    act(() => {
      (m2.host.querySelector('[data-action="mask"]') as HTMLElement).click();
    });
    expect(fn2).not.toHaveBeenCalled();
    m2.unmount();
  });
});
