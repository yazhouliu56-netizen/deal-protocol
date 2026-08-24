// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import JudgePanel from "@/components/waves/JudgePanel";

function mountPanel(props: Partial<Parameters<typeof JudgePanel>[0]> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const full = {
    claimId: "c1",
    reason: "late" as const,
    evidence: "迟到 40 分钟",
    amountYuan: 1000,
    onSettle: vi.fn(),
    ...props,
  };
  act(() => {
    root.render(<JudgePanel {...full} />);
  });
  return { container, root, onSettle: full.onSettle };
}

function clickRun(container: HTMLElement) {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent?.includes("请小法官判定"),
  ) as HTMLButtonElement;
  expect(btn).toBeTruthy();
  act(() => {
    btn.click();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("JudgePanel 守恒结算展示（方向 1 接线 B · 红线 1）", () => {
  it("护栏 settlement 存在时以整数分展示退款与结清金额（¥400 / ¥600）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          verdict: {
            stance: "responder-partial",
            refundPct: 40,
            amountYuan: 400,
            rationale: "承诺未完全履约",
            replyScript: "按 40% 赔付",
            confidence: 0.9,
            source: "llm",
            settlement: { refundCents: 40000, payoutCents: 60000 },
          },
          source: "mock-llm",
        }),
      }),
    );
    const { container } = mountPanel();
    clickRun(container);
    await act(async () => {});
    const text = container.textContent ?? "";
    expect(text).toContain("¥400");
    expect(text).toContain("40%");
    expect(text).toContain("结清服务方 ¥600");
    expect(text).toContain("分币守恒 ✓");
  });

  it("fractional cents 以两位小数展示（refundCents=33333 → ¥333.33）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          verdict: {
            stance: "responder-partial",
            refundPct: 33,
            amountYuan: 333,
            rationale: "r",
            replyScript: "s",
            confidence: 0.8,
            source: "mock",
            settlement: { refundCents: 33333, payoutCents: 66667 },
          },
          source: "mock",
        }),
      }),
    );
    const { container } = mountPanel();
    clickRun(container);
    await act(async () => {});
    expect(container.textContent).toContain("¥333.33");
    expect(container.textContent).toContain("结清服务方 ¥666.67");
  });

  it("旧响应无 settlement 时回落 amountYuan 展示（向后兼容零破坏）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          verdict: {
            stance: "responder-full",
            refundPct: 100,
            amountYuan: 1000,
            rationale: "未到场全责",
            replyScript: "全额退款",
            confidence: 0.95,
            source: "rules",
          },
          source: "mock",
        }),
      }),
    );
    const { container, onSettle } = mountPanel();
    clickRun(container);
    await act(async () => {});
    expect(container.textContent).toContain("¥1000");
    expect(container.textContent).not.toContain("分币守恒");
    const adopt = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("采纳：退 100%"),
    ) as HTMLButtonElement;
    act(() => {
      adopt.click();
    });
    expect(onSettle).toHaveBeenCalledWith(100, expect.stringContaining("小法官"));
  });
});
