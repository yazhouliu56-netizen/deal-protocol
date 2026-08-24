// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import MilestoneLadder from "@/components/waves/MilestoneLadder";

function mountLadder(props: Parameters<typeof MilestoneLadder>[0]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MilestoneLadder {...props} />);
  });
  return { container, root };
}

const PROPS = {
  totalAmountYuan: 1000,
  milestones: [
    { title: "拆旧清运", ratio: 0.5 },
    { title: "水电改造", ratio: 0.3 },
    { title: "竣工验收", ratio: 0.2 },
  ],
};

function click(container: HTMLElement, selector: string) {
  const btn = container.querySelector(selector) as HTMLButtonElement;
  expect(btn).toBeTruthy();
  act(() => {
    btn.click();
  });
}

describe("MilestoneLadder（方向 1 接线 C · base 纯函数驱动）", () => {
  it("按比例最大余数法切分且分币守恒：¥1000 → 500/300/200，初始全 HELD", () => {
    const { container } = mountLadder({ ...PROPS });
    const rows = container.querySelectorAll('[data-testid^="milestone-row-"]');
    expect(rows.length).toBe(3);
    expect(rows[0].getAttribute("data-status")).toBe("HELD");
    expect(rows[1].getAttribute("data-status")).toBe("HELD");
    expect(rows[2].getAttribute("data-status")).toBe("HELD");
    expect(container.textContent).toContain("¥500");
    expect(container.textContent).toContain("¥300");
    expect(container.textContent).toContain("¥200");
    expect(container.querySelector('[data-testid="milestone-released-total"]')?.textContent).toContain("已放款 ¥0");
    expect(container.querySelector('[data-testid="milestone-frozen"]')?.textContent).toContain("剩余冻结 ¥1000");
  });

  it("顺序提交验收：仅首个 HELD 出按钮，提交后转 SUBMITTED", () => {
    const { container } = mountLadder({ ...PROPS });
    expect(container.querySelector('[data-testid="milestone-submit-0"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="milestone-submit-1"]')).toBeFalsy();
    click(container, '[data-testid="milestone-submit-0"]');
    expect(container.querySelector('[data-testid="milestone-row-0"]')?.getAttribute("data-status")).toBe("SUBMITTED");
    expect(container.querySelector('[data-testid="milestone-row-1"]')?.getAttribute("data-status")).toBe("HELD");
    expect(container.querySelector('[data-testid="milestone-submit-1"]')).toBeTruthy();
  });

  it("验收放款走 RELEASED 且守恒账目同步：放款 ¥500 后冻结降至 ¥500", () => {
    const { container } = mountLadder({ ...PROPS });
    click(container, '[data-testid="milestone-submit-0"]');
    click(container, '[data-testid="milestone-release-0"]');
    expect(container.querySelector('[data-testid="milestone-row-0"]')?.getAttribute("data-status")).toBe("RELEASED");
    expect(container.querySelector('[data-testid="milestone-released-total"]')?.textContent).toContain("已放款 ¥500");
    expect(container.querySelector('[data-testid="milestone-frozen"]')?.textContent).toContain("剩余冻结 ¥500");
  });

  it("免验收直放语义不外泄：HELD 行无放款按钮（红线 1 刻意放款仅限引擎层）", () => {
    const { container } = mountLadder({ ...PROPS });
    expect(container.querySelector('[data-testid="milestone-release-0"]')).toBeFalsy();
  });
});
