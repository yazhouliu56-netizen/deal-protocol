// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import ConfirmSheet from "./ConfirmSheet";

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

describe("ConfirmSheet 高危二次确认（资金/评价/举报）", () => {
  it("渲染标题+后果说明+双键（确认必须显式按键）", () => {
    const { host, unmount } = mount(
      <ConfirmSheet title="确认放款？" body="放款后不可撤销" onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(host.querySelector('[data-testid="confirm-sheet"]')).not.toBeNull();
    expect(host.textContent).toContain("确认放款？");
    expect(host.textContent).toContain("放款后不可撤销");
    expect(host.querySelector('[data-testid="confirm-ok"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="confirm-cancel"]')).not.toBeNull();
    unmount();
  });

  it("确认/取消各走各的回调（取消键不触发确认）", () => {
    const ok = vi.fn();
    const cancel = vi.fn();
    const { host, unmount } = mount(
      <ConfirmSheet title="t" body="b" onConfirm={ok} onCancel={cancel} />,
    );
    act(() => {
      (host.querySelector('[data-testid="confirm-cancel"]') as HTMLElement).click();
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(ok).not.toHaveBeenCalled();
    act(() => {
      (host.querySelector('[data-testid="confirm-ok"]') as HTMLElement).click();
    });
    expect(ok).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("danger 确认键走 danger 变体", () => {
    const { host, unmount } = mount(
      <ConfirmSheet title="t" body="b" danger onConfirm={() => {}} onCancel={() => {}} />,
    );
    expect(
      (host.querySelector('[data-testid="confirm-ok"]') as HTMLElement).getAttribute("data-variant"),
    ).toBe("danger");
    unmount();
  });
});
