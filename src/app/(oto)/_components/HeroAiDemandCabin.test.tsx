// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import HeroAiDemandCabin from "@/app/(oto)/_components/HeroAiDemandCabin";

function mountCabin(props?: Partial<Parameters<typeof HeroAiDemandCabin>[0]>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <HeroAiDemandCabin
        value=""
        onChange={() => {}}
        onLaunch={() => {}}
        onMic={() => {}}
        {...props}
      />,
    );
  });
  return { container, root };
}

describe("HeroAiDemandCabin 丝滑④发射分阶段反馈", () => {
  it("idle 缺省无阶段行（E2E 锚点零漂移）", () => {
    const { container } = mountCabin();
    expect(container.querySelector('[data-testid="launch-phase"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="ai-demand-cabin"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="launch-button"]')).toBeTruthy();
  });

  it("assembling 显示组装文案", () => {
    const { container } = mountCabin({ phase: "assembling" });
    const el = container.querySelector('[data-testid="launch-phase"]');
    expect(el?.getAttribute("data-phase")).toBe("assembling");
    expect(el?.textContent).toContain("草稿组装中");
  });

  it("publishing 显示发布文案", () => {
    const { container } = mountCabin({ phase: "publishing" });
    const el = container.querySelector('[data-testid="launch-phase"]');
    expect(el?.getAttribute("data-phase")).toBe("publishing");
    expect(el?.textContent).toContain("发布面板已开");
  });
});
