// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import ArbitrationSheet from "@/components/waves/ArbitrationSheet";

function mountSheet(props: Partial<Parameters<typeof ArbitrationSheet>[0]> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const full = {
    open: true,
    orderId: "order-001",
    evidence: { complaint: "墙面没刷平" },
    proposal: {
      liability: "provider" as const,
      liabilityNote: "履约方责任",
      refundAmount: 100,
      compensationCouponYuan: 5,
      creditDeduct: 2,
      reasonChain: ["照片比对不符"],
    },
    onAcceptProposal: vi.fn(),
    onEscalateManual: vi.fn(),
    onClose: vi.fn(),
    disputeAmountYuan: 200,
    ...props,
  };
  act(() => {
    root.render(<ArbitrationSheet {...full} />);
  });
  return { container, root };
}

function stubJudicial(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({ ok, json: async () => body } as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ArbitrationSheet 司法证据链常驻锚定（方向 1 接线 A③）", () => {
  it("打开抽屉即自动校验：链通过 → 顶部绿色已锚定徽标含环数", async () => {
    const fetchMock = stubJudicial({
      success: true,
      judicialPackage: {
        hashChain: {
          chainValid: true,
          entries: [{ hash: "aa" }, { hash: "bb" }],
          verification: { brokenAtIndex: -1, reason: null, brokenId: null },
        },
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = mountSheet();
    await act(async () => {});
    const anchor = container.querySelector('[data-testid="chain-anchor"]') as HTMLElement;
    expect(anchor).toBeTruthy();
    expect(anchor.getAttribute("data-state")).toBe("done");
    expect(anchor.textContent).toContain("司法证据链已锚定");
    expect(anchor.textContent).toContain("2 环连续 · 校验通过");
  });

  it("链断裂 → 红色警示 + 三断因人话标签 + 断点定位", async () => {
    vi.stubGlobal(
      "fetch",
      stubJudicial({
        success: true,
        judicialPackage: {
          hashChain: {
            chainValid: false,
            entries: [{ hash: "aa" }, { hash: "cc" }],
            verification: { brokenAtIndex: 1, reason: "HASH_MISMATCH", brokenId: "ev-9" },
          },
        },
      }),
    );
    const { container } = mountSheet();
    await act(async () => {});
    const anchor = container.querySelector('[data-testid="chain-anchor"]') as HTMLElement;
    expect(anchor.getAttribute("data-state")).toBe("done");
    expect(anchor.textContent).toContain("证据链断裂");
    expect(anchor.textContent).toContain("哈希重算不符");
    expect(anchor.textContent).toContain("断点 #1");
  });

  it("网络异常 → 中性降级文案且不阻塞调解主流程", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const { container } = mountSheet();
    await act(async () => {});
    const anchor = container.querySelector('[data-testid="chain-anchor"]') as HTMLElement;
    expect(anchor.getAttribute("data-state")).toBe("error");
    expect(anchor.textContent).toContain("存证链暂不可达");
    expect(container.querySelector('[data-testid="ai-proposal-card"]')).toBeTruthy();
  });

  it("每次开合仅自动锚定一次（关闭重开才重新校验）", async () => {
    const fetchMock = stubJudicial({
      success: true,
      judicialPackage: { hashChain: { chainValid: true, entries: [], verification: { brokenAtIndex: -1, reason: null, brokenId: null } } },
    });
    vi.stubGlobal("fetch", fetchMock);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    const base = {
      orderId: "order-001",
      evidence: { complaint: "x" },
      proposal: {
        liability: "split" as const,
        liabilityNote: "n",
        refundAmount: 0,
        compensationCouponYuan: 0,
        creditDeduct: 0,
        reasonChain: [],
      },
      onAcceptProposal: vi.fn(),
      onEscalateManual: vi.fn(),
      onClose: vi.fn(),
    };
    act(() => {
      root.render(<ArbitrationSheet {...base} open={true} />);
    });
    await act(async () => {});
    act(() => {
      root.render(<ArbitrationSheet {...base} open={false} />);
    });
    act(() => {
      root.render(<ArbitrationSheet {...base} open={true} />);
    });
    await act(async () => {});
    await act(async () => {});
    // open=true 渲染两次 + 重开一次 → 恰好 1 次（首次）+ 重开 1 次 = 2 次 fetch
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
