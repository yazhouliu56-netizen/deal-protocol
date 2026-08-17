// @vitest-environment jsdom
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import ResilienceControlPanel from "@/components/admin/ResilienceControlPanel";

const STATE_FIXTURE = {
  level: "NORMAL",
  availableLevels: ["NORMAL", "DROP_NON_CORE", "RATE_LIMIT_QUEUE", "PRESERVE_CORE", "READ_ONLY"],
  rules: [
    { category: "CRITICAL_SOS", allowed: true, httpStatus: null, errorCode: null },
    { category: "CORE_FULFILLMENT", allowed: true, httpStatus: null, errorCode: null },
    { category: "NEW_DEMAND", allowed: true, httpStatus: null, errorCode: null },
    { category: "NON_CORE_ANALYTICS", allowed: true, httpStatus: null, errorCode: null },
    { category: "GENERAL_READ", allowed: true, httpStatus: null, errorCode: null },
  ],
} as const;

const READ_ONLY_STATE = {
  ...STATE_FIXTURE,
  level: "READ_ONLY",
  rules: [
    { category: "CRITICAL_SOS", allowed: true, httpStatus: null, errorCode: null },
    { category: "CORE_FULFILLMENT", allowed: false, httpStatus: 503, errorCode: "SYSTEM_READ_ONLY_MAINTENANCE" },
    { category: "NEW_DEMAND", allowed: false, httpStatus: 503, errorCode: "SYSTEM_READ_ONLY_MAINTENANCE" },
    { category: "NON_CORE_ANALYTICS", allowed: false, httpStatus: 503, errorCode: "SYSTEM_READ_ONLY_MAINTENANCE" },
    { category: "GENERAL_READ", allowed: true, httpStatus: null, errorCode: null },
  ],
} as const;

function mount(ui: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  return { container, root };
}

function stubFetchGet(payload: unknown) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
    ok: true,
    status: 200,
    json: async () => payload,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ResilienceControlPanel", () => {
  it("渲染五色等级卡片 + 当前等级徽标", async () => {
    stubFetchGet(STATE_FIXTURE);
    const { container, root } = mount(<ResilienceControlPanel />);
    await act(async () => {});
    const buttons = Array.from(container.querySelectorAll('button[aria-label^="切换容灾等级"]'));
    expect(buttons).toHaveLength(5);
    expect(container.textContent).toContain("当前生效等级");
    expect(container.textContent).toContain("NORMAL 正常");
    expect(container.textContent).toContain("READ_ONLY 全站只读");
    act(() => {
      root.unmount();
    });
  });

  it("展示拦截规则矩阵（放行绿 / 阻断红）", async () => {
    stubFetchGet(READ_ONLY_STATE);
    const { container, root } = mount(<ResilienceControlPanel />);
    await act(async () => {});
    expect(container.textContent).toContain("✗ 阻断 503");
    expect(container.textContent).toContain("SYSTEM_READ_ONLY_MAINTENANCE");
    expect(container.textContent).toContain("✓ 放行");
    act(() => {
      root.unmount();
    });
  });

  it("点击等级卡片发起 POST 切换并刷新状态", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => STATE_FIXTURE }))
      .mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => READ_ONLY_STATE }));
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = mount(<ResilienceControlPanel />);
    await act(async () => {});
    const btn = Array.from(container.querySelectorAll('button[aria-label^="切换容灾等级"]')).find((b) =>
      (b.textContent ?? "").includes("READ_ONLY"),
    )!;
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")!;
    expect(postCall).toBeDefined();
    expect(postCall[0]).toBe("/api/admin/resilience");
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body.level).toBe("READ_ONLY");
    expect(container.textContent).toContain("已切换至");
    act(() => {
      root.unmount();
    });
  });

  it("一键应急熔断按钮直接切到 READ_ONLY", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => STATE_FIXTURE }))
      .mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => READ_ONLY_STATE }));
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = mount(<ResilienceControlPanel />);
    await act(async () => {});
    const fuse = Array.from(container.querySelectorAll("button")).find((b) =>
      (b.textContent ?? "").includes("一键应急熔断"),
    )!;
    await act(async () => {
      fuse.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const postCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse((postCall[1] as RequestInit).body as string).level).toBe("READ_ONLY");
    act(() => {
      root.unmount();
    });
  });

  it("API 失败展示错误信息且不崩溃", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "仅管理员可访问" }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = mount(<ResilienceControlPanel />);
    await act(async () => {});
    expect(container.textContent).toContain("仅管理员可访问");
    act(() => {
      root.unmount();
    });
  });

  it("切换失败回滚展示错误且保留旧状态", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => STATE_FIXTURE }))
      .mockImplementationOnce(async () => ({ ok: false, status: 400, json: async () => ({ error: "非法容灾等级" }) }));
    vi.stubGlobal("fetch", fetchMock);
    const { container, root } = mount(<ResilienceControlPanel />);
    await act(async () => {});
    const btn = Array.from(container.querySelectorAll('button[aria-label^="切换容灾等级"]')).find((b) =>
      (b.textContent ?? "").includes("DROP_NON_CORE"),
    )!;
    await act(async () => {
      btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("非法容灾等级");
    expect(container.textContent).toContain("当前生效等级");
    expect(container.textContent).toContain("NORMAL 正常");
    act(() => {
      root.unmount();
    });
  });
});
