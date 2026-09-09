// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import DuoPill from "./DuoPill";

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

describe("DuoPill 胶囊徽章（P9-6）", () => {
  it("默认 blue tone（WaveCard 系标准形）", () => {
    const { host, unmount } = mount(<DuoPill>进行中</DuoPill>);
    const pill = host.firstElementChild as HTMLElement;
    expect(pill.tagName).toBe("SPAN");
    expect(pill.className).toContain("rounded-full");
    expect(pill.className).toContain("border-2");
    expect(pill.className).toContain("var(--color-duo-blue)");
    expect(pill.className).toContain("var(--color-duo-blue-ink)");
    unmount();
  });

  it("六 tone 档位各有其色（yellow 用 yellow-dark 边）", () => {
    for (const [tone, token] of [
      ["green", "var(--color-duo-green-ink)"],
      ["yellow", "var(--color-duo-yellow-dark)"],
      ["red", "var(--color-duo-red-dark)"],
      ["orange", "var(--color-duo-orange)"],
      ["neutral", "var(--color-duo-hare)"],
    ] as const) {
      const { host, unmount } = mount(<DuoPill tone={tone}>x</DuoPill>);
      expect((host.firstElementChild as HTMLElement).className).toContain(token);
      unmount();
    }
  });

  it("onDark 暗底演绎（ProofCamera 鉴真家族）", () => {
    const { host, unmount } = mount(
      <DuoPill tone="red" variant="dark">
        x
      </DuoPill>,
    );
    const cls = (host.firstElementChild as HTMLElement).className;
    expect(cls).toContain("backdrop-blur");
    expect(cls).toContain("239,68,68");
    expect(cls).toContain("#fecaca");
    unmount();
  });

  it("solid 实心演绎（白字计数；yellow 配 eel 深字）", () => {
    const { host, unmount } = mount(
      <DuoPill tone="green" variant="solid">
        3
      </DuoPill>,
    );
    const cls = (host.firstElementChild as HTMLElement).className;
    expect(cls).toContain("var(--color-duo-green)");
    expect(cls).toContain("text-white");
    unmount();
    const { host: host2, unmount: unmount2 } = mount(
      <DuoPill tone="yellow" variant="solid">
        x
      </DuoPill>,
    );
    expect((host2.firstElementChild as HTMLElement).className).toContain("var(--color-duo-eel)");
    unmount2();
  });

  it("as=button 多态（胶囊 CTA：onClick/aria-label 透传）", () => {
    let clicked = 0;
    const { host, unmount } = mount(
      <DuoPill tone="green" variant="solid" as="button" ariaLabel="转为正式订单" onClick={() => { clicked += 1; }}>
        go
      </DuoPill>,
    );
    const el = host.firstElementChild as HTMLElement;
    expect(el.tagName).toBe("BUTTON");
    expect(el.getAttribute("aria-label")).toBe("转为正式订单");
    expect(el.getAttribute("type")).toBe("button");
    el.click();
    expect(clicked).toBe(1);
    unmount();
  });

  it("className 结构附加经 cn 合并（ml-auto 等透传）", () => {
    const { host, unmount } = mount(<DuoPill tone="neutral" className="ml-auto whitespace-nowrap">x</DuoPill>);
    const cls = (host.firstElementChild as HTMLElement).className;
    expect(cls).toContain("ml-auto");
    expect(cls).toContain("whitespace-nowrap");
    unmount();
  });
});
