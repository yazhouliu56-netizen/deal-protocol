// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import DuoCardShell, { DUO_CARD_BASE } from "./DuoCardShell";

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

describe("DuoCardShell 白卡结构壳（P9-4）", () => {
  it("静态渲染正典白卡 3D + children", () => {
    const { host, unmount } = mount(<DuoCardShell className="p-4">内容</DuoCardShell>);
    const card = host.firstElementChild as HTMLElement;
    expect(card.tagName).toBe("DIV");
    expect(card.className).toContain("border-b-[6px]");
    expect(card.className).toContain("p-4");
    expect(card.textContent).toContain("内容");
    unmount();
  });

  it("DUO_CARD_BASE 即 WaveCard/GenericOrderCard 标准形", () => {
    expect(DUO_CARD_BASE).toContain("bg-white rounded-3xl");
    expect(DUO_CARD_BASE).toContain("border-[var(--color-duo-swan)]");
  });

  it("testId + dataAttrs 透传（GenericOrderCard data-wave-id/data-now）", () => {
    const { host, unmount } = mount(
      <DuoCardShell testId="generic-order-card" dataAttrs={{ "data-wave-id": "w1", "data-now": 123 }}>
        内容
      </DuoCardShell>,
    );
    const card = host.querySelector('[data-testid="generic-order-card"]') as HTMLElement;
    expect(card).not.toBeNull();
    expect(card.dataset.waveId).toBe("w1");
    expect(card.dataset.now).toBe("123");
    unmount();
  });

  it("cn 合并：rounded-2xl/border-b-4 后来居上（P10-1 2xl 卡）", () => {
    const { host, unmount } = mount(
      <DuoCardShell className="rounded-2xl border-b-4 p-3.5">内容</DuoCardShell>,
    );
    const cls = (host.firstElementChild as HTMLElement).className;
    expect(cls).toContain("rounded-2xl");
    expect(cls).not.toContain("rounded-3xl");
    expect(cls).toContain("border-b-4");
    expect(cls).not.toContain("border-b-[6px]");
    unmount();
  });

  it("motion 透传渲染 motion 卡（WorkerWorkbench/ProfilePage 入场守恒）", () => {
    const { host, unmount } = mount(
      <DuoCardShell
        className="p-4"
        motion={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3 } }}
      >
        内容
      </DuoCardShell>,
    );
    expect(host.textContent).toContain("内容");
    expect(host.innerHTML).toContain("p-4");
    unmount();
  });
});
