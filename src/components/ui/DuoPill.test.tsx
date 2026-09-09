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
      <DuoPill tone="red" onDark>
        x
      </DuoPill>,
    );
    const cls = (host.firstElementChild as HTMLElement).className;
    expect(cls).toContain("backdrop-blur");
    expect(cls).toContain("239,68,68");
    expect(cls).toContain("#fecaca");
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
