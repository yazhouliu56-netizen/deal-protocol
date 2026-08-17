// @vitest-environment jsdom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ConversationalBiView, { QUICK_CHIPS, type IBiReportView } from "@/components/admin/ConversationalBiView";

const FIXTURE: IBiReportView = {
  query: "各品类违约率与退款分布",
  title: "各品类违约率与退款分布",
  summary: "归因：家政类单量最大（3 单，违约率 33.3%）。",
  timeRange: { start: "2026-07-01T00:00:00.000Z", end: "2026-08-17T00:00:00.000Z" },
  metrics: [
    { key: "violation_rate", label: "整体违约率", value: "33%", trend: "UP", changePercent: 12.5 },
    { key: "violations", label: "违约单数", value: 2 },
    { key: "total", label: "订单总数", value: 6 },
    { key: "amount", label: "涉及金额", value: "¥38,000" },
  ],
  chartType: "BAR",
  chartData: [
    { label: "家政", value: 1, secondaryValue: 3, extra: "33.3%" },
    { label: "陪玩", value: 1, secondaryValue: 2, extra: "50%" },
  ],
  suggestedFollowUps: ["分析近30天平台佣金与保险计提走势", "服务者履约与信用评分分析"],
};

const LINE_FIXTURE: IBiReportView = {
  ...FIXTURE,
  chartType: "LINE",
  chartData: [
    { label: "08-01", value: 1000, secondaryValue: 150 },
    { label: "08-02", value: 2000, secondaryValue: 300 },
  ],
  metrics: [{ key: "gmv", label: "总 GMV", value: "¥3,000", trend: "UP", changePercent: 50 }],
};

const PIE_FIXTURE: IBiReportView = { ...FIXTURE, chartType: "PIE", metrics: [{ key: "a", label: "A", value: 3 }] };
const TABLE_FIXTURE: IBiReportView = {
  ...FIXTURE,
  chartType: "TABLE",
  metrics: [{ key: "completed", label: "完成单数", value: 4 }],
};

function mount(ui: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function stubFetch(payload: IBiReportView) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => payload,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function setInput(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConversationalBiView", () => {
  it("渲染输入框 + 三枚快捷气泡", () => {
    const { container } = mount(<ConversationalBiView />);
    const input = container.querySelector('input[aria-label="BI 查询输入框"]');
    expect(input).not.toBeNull();
    const chips = Array.from(container.querySelectorAll("button")).filter((b) => QUICK_CHIPS.includes(b.textContent ?? ""));
    expect(chips).toHaveLength(3);
  });

  it("快捷气泡点击触发查询并渲染诊断卡 / KPI / 图表 / 追问", async () => {
    const fetchMock = stubFetch(FIXTURE);
    const { container, root } = mount(<ConversationalBiView />);
    const chip = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === QUICK_CHIPS[0])!;
    await act(async () => {
      chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/bi", expect.objectContaining({ method: "POST" }));
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.query).toBe(QUICK_CHIPS[0]);
    expect(container.textContent).toContain("各品类违约率与退款分布");
    expect(container.textContent).toContain("归因：家政类单量最大");
    expect(container.textContent).toContain("整体违约率");
    expect(container.textContent).toContain("33%");
    expect(container.textContent).toContain("↑ 12.5%");
    expect(container.textContent).toContain("家政");
    expect(container.textContent).toContain("服务者履约与信用评分分析");
    act(() => {
      root.unmount();
    });
  });

  it("表单提交查询 + 结果缓存渲染", async () => {
    const fetchMock = stubFetch(LINE_FIXTURE);
    const { container, root } = mount(<ConversationalBiView />);
    const input = container.querySelector('input[aria-label="BI 查询输入框"]') as HTMLInputElement;
    setInput(input, "分析近30天平台佣金与保险计提走势");
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector("svg")).not.toBeNull();
    act(() => {
      root.unmount();
    });
  });

  it("LINE 图表自适应渲染（SVG polyline）", async () => {
    stubFetch(LINE_FIXTURE);
    const { container, root } = mount(<ConversationalBiView />);
    await act(async () => {
      const chip = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === QUICK_CHIPS[1])!;
      chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const polyline = container.querySelector("svg polyline");
    expect(polyline).not.toBeNull();
    expect(container.textContent).toContain("主指标");
    act(() => {
      root.unmount();
    });
  });

  it("PIE 圆环与 TABLE 表格渲染", async () => {
    stubFetch(PIE_FIXTURE);
    const { container, root } = mount(<ConversationalBiView />);
    await act(async () => {
      const chip = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === QUICK_CHIPS[0])!;
      chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelectorAll("svg circle").length).toBeGreaterThan(0);
    act(() => {
      root.unmount();
    });

    stubFetch(TABLE_FIXTURE);
    const { container: c2, root: r2 } = mount(<ConversationalBiView />);
    await act(async () => {
      const chip = Array.from(c2.querySelectorAll("button")).find((b) => b.textContent === QUICK_CHIPS[0])!;
      chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(c2.querySelector("table")).not.toBeNull();
    expect(c2.textContent).toContain("类目 / 维度");
    act(() => {
      r2.unmount();
    });
  });

  it("追问 chip 点击自动填入输入框并重新查询", async () => {
    const fetchMock = stubFetch(FIXTURE);
    const { container, root } = mount(<ConversationalBiView />);
    await act(async () => {
      const chip = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === QUICK_CHIPS[0])!;
      chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const followUp = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "分析近30天平台佣金与保险计提走势")!;
    await act(async () => {
      followUp.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const input = container.querySelector('input[aria-label="BI 查询输入框"]') as HTMLInputElement;
    expect(input.value).toBe("分析近30天平台佣金与保险计提走势");
    act(() => {
      root.unmount();
    });
  });

  it("API 失败展示错误信息且不崩溃", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "服务异常" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = mount(<ConversationalBiView />);
    await act(async () => {
      const chip = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === QUICK_CHIPS[0])!;
      chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("服务异常");
    act(() => {
      root.unmount();
    });
  });
});