// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("上线前诚实态：验收放款只 toast 告知，不做本地 RELEASED 翻转", () => {
    const { container } = mountLadder({ ...PROPS });
    expect(container.querySelector('[data-testid="milestone-honesty-note"]')?.textContent).toContain(
      "分阶段放款即将上线，当前订单按整单结算",
    );
    click(container, '[data-testid="milestone-submit-0"]');
    click(container, '[data-testid="milestone-release-0"]');
    // 无二次确认弹层、无状态翻转：钱路走整单，梯子只做计划展示
    expect(container.querySelector('[data-testid="confirm-sheet"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="milestone-row-0"]')?.getAttribute("data-status")).toBe("SUBMITTED");
    expect(container.querySelector('[data-testid="milestone-released-total"]')?.textContent).toContain("已放款 ¥0");
    expect(container.querySelector('[data-testid="milestone-frozen"]')?.textContent).toContain("剩余冻结 ¥1000");
  });

  it("免验收直放语义不外泄：HELD 行无放款按钮（红线 1 刻意放款仅限引擎层）", () => {
    const { container } = mountLadder({ ...PROPS });
    expect(container.querySelector('[data-testid="milestone-release-0"]')).toBeFalsy();
  });
});

describe("Server 模式（M2 · 行合同驱动）", () => {
  const ROWS = [
    {
      id: "r1",
      contract_id: "c1",
      title: "拆旧清运",
      amount: 500,
      step_number: 1,
      status: "SUBMITTED",
      submitted_at: "2026-09-23T00:00:00.000Z",
      auto_confirm_at: null,
      confirmed_at: null,
    },
    {
      id: "r2",
      contract_id: "c1",
      title: "水电改造",
      amount: 300,
      step_number: 2,
      status: "HELD",
      submitted_at: null,
      auto_confirm_at: null,
      confirmed_at: null,
    },
  ];

  function stubFetch(
    impl: (url: string, init?: RequestInit) => Promise<{ ok: boolean; json?: () => Promise<unknown>; text?: () => Promise<string> }>,
  ) {
    global.fetch = vi.fn(impl) as unknown as typeof fetch;
  }

  async function flush() {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("读行渲染＋总额守恒（500＋300＝800，已放款 0）", async () => {
    stubFetch(async (url) => {
      if (typeof url === "string" && url.startsWith("/api/milestones?")) {
        return { ok: true, json: async () => ({ rows: ROWS }) };
      }
      throw new Error("unexpected " + url);
    });
    const { container } = mountLadder({ contractId: "c1" });
    expect(container.querySelector('[data-testid="milestone-loading"]')).toBeTruthy();
    await flush();
    expect(container.querySelectorAll('[data-testid^="milestone-row-"]')).toHaveLength(2);
    expect(container.querySelector('[data-testid="milestone-released-total"]')?.textContent).toContain("已放款 ¥0");
    expect(container.querySelector('[data-testid="milestone-frozen"]')?.textContent).toContain("剩余冻结 ¥800");
    expect(container.querySelector('[data-testid="milestone-honesty-note"]')).toBeFalsy();
  });

  it("验收放款走真二次确认：确认后调 API 成功翻转 RELEASED", async () => {
    stubFetch(async (url) => {
      if (typeof url === "string" && url.startsWith("/api/milestones?")) {
        return { ok: true, json: async () => ({ rows: ROWS }) };
      }
      if (typeof url === "string" && url.endsWith("/r1/release")) {
        return { ok: true, json: async () => ({ released: true, amountYuan: 500 }) };
      }
      throw new Error("unexpected " + url);
    });
    const { container } = mountLadder({ contractId: "c1" });
    await flush();
    click(container, '[data-testid="milestone-release-0"]');
    // 真文案：对方真收款项（M1 钱路已通，B 的虚假承诺已下线）
    expect(container.textContent).toContain("对方将收到本期 ¥500");
    click(container, '[data-testid="confirm-ok"]');
    await flush();
    expect(container.querySelector('[data-testid="milestone-row-0"]')?.getAttribute("data-status")).toBe("RELEASED");
    expect(container.querySelector('[data-testid="milestone-released-total"]')?.textContent).toContain("已放款 ¥500");
  });

  it("放款失败回滚：保持 SUBMITTED＋总额不动（Batch③-0 范式）", async () => {
    stubFetch(async (url) => {
      if (typeof url === "string" && url.startsWith("/api/milestones?")) {
        return { ok: true, json: async () => ({ rows: ROWS }) };
      }
      return { ok: false, text: async () => "CONFLICT" };
    });
    const { container } = mountLadder({ contractId: "c1" });
    await flush();
    click(container, '[data-testid="milestone-release-0"]');
    click(container, '[data-testid="confirm-ok"]');
    await flush();
    expect(container.querySelector('[data-testid="milestone-row-0"]')?.getAttribute("data-status")).toBe("SUBMITTED");
    expect(container.querySelector('[data-testid="milestone-released-total"]')?.textContent).toContain("已放款 ¥0");
  });

  it("无行渲染空（座舱不挂梯子）", async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ rows: [] }) }));
    const { container } = mountLadder({ contractId: "c9" });
    await flush();
    expect(container.querySelector('[data-testid="milestone-ladder"]')).toBeFalsy();
  });

  it("M6 改期提议：面板预填可改行，提交 POST body 断言＋提案卡出现", async () => {
    let postedBody: unknown = null;
    stubFetch(async (url, init) => {
      if (typeof url === "string" && url.startsWith("/api/milestones?")) {
        return { ok: true, json: async () => ({ rows: ROWS }) };
      }
      if (typeof url === "string" && url.endsWith("/amend/propose")) {
        postedBody = JSON.parse((init?.body as string) ?? "{}");
        return { ok: true, json: async () => ({ proposalId: "p-9", version: 1 }) };
      }
      if (typeof url === "string" && url.includes("/api/milestones/amend")) {
        return { ok: true, json: async () => ({ proposals: [] }) };
      }
      throw new Error("unexpected " + url);
    });
    const { container } = mountLadder({ contractId: "c1" });
    await flush();
    click(container, '[data-testid="milestone-amend-open"]');
    // 预填：仅 HELD 行（r2 水电改造），SUBMITTED 行不进草稿
    expect((container.querySelector('[data-testid="milestone-amend-title-0"]') as HTMLInputElement)?.value).toBe("水电改造");
    expect(container.querySelector('[data-testid="milestone-amend-title-1"]')).toBeFalsy();
    // 验收标准必填：经原生 setter 驱动受控 input（仓内无 testing-library）
    const acc = container.querySelector('[data-testid="milestone-amend-accept-0"]') as HTMLInputElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(acc, "通电通水");
      acc.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flush();
    click(container, '[data-testid="milestone-amend-propose"]');
    await flush();
    const body = postedBody as { contractId: string; stages: Array<{ title: string; weightPct: number; acceptance: string }> };
    expect(body.contractId).toBe("c1");
    expect(body.stages).toHaveLength(1);
    expect(body.stages[0].title).toBe("水电改造");
    expect(container.querySelector('[data-testid="milestone-amend-proposal-1"]')?.textContent).toContain("我发起的");
  });

  it("M6 对方提案：接受调 decide＋提案卡消失", async () => {
    const calls: string[] = [];
    let decided = false;
    const PROPS = [
      {
        id: "p-2",
        version: 2,
        stages: [{ title: "水电改造", weightPct: 100, acceptance: "通电通水" }],
        status: "PROPOSED",
        canDecide: true,
      },
    ];
    stubFetch(async (url, init) => {
      if (typeof url === "string" && url.startsWith("/api/milestones?")) {
        return { ok: true, json: async () => ({ rows: ROWS }) };
      }
      if (typeof url === "string" && url.includes("/api/milestones/amend") && (!init || init.method !== "POST")) {
        // 接受后重读：服务端真相已是 ACCEPTED（列表不再含该提案）
        return { ok: true, json: async () => ({ proposals: decided ? [] : PROPS }) };
      }
      if (typeof url === "string" && url.endsWith("/p-2/decide")) {
        decided = true;
        calls.push(JSON.stringify(JSON.parse((init?.body as string) ?? "{}")));
        return { ok: true, json: async () => ({ accepted: true, version: 2 }) };
      }
      if (typeof url === "string" && url.includes("/api/milestones/amend")) {
        return { ok: true, json: async () => ({ proposals: [] }) };
      }
      throw new Error("unexpected " + url);
    });
    const { container } = mountLadder({ contractId: "c1" });
    await flush();
    expect(container.querySelector('[data-testid="milestone-amend-proposal-2"]')?.textContent).toContain("待你确认");
    click(container, '[data-testid="milestone-amend-accept-2"]');
    await flush();
    expect(calls).toEqual([JSON.stringify({ accept: true })]);
    expect(container.querySelector('[data-testid="milestone-amend-proposal-2"]')).toBeFalsy();
  });

  it("M5 三勾：取消一勾 → POST 带 pass＋总额按实放记（475 非 500）", async () => {
    let postedBody: unknown = null;
    stubFetch(async (url, init) => {
      if (typeof url === "string" && url.startsWith("/api/milestones?")) {
        return { ok: true, json: async () => ({ rows: ROWS }) };
      }
      if (typeof url === "string" && url.endsWith("/r1/release")) {
        postedBody = JSON.parse((init?.body as string) ?? "{}");
        return { ok: true, json: async () => ({ released: true, amountYuan: 500, providerNetYuan: 475 }) };
      }
      if (typeof url === "string" && url.includes("/api/milestones/amend")) {
        return { ok: true, json: async () => ({ proposals: [] }) };
      }
      throw new Error("unexpected " + url);
    });
    const { container } = mountLadder({ contractId: "c1" });
    await flush();
    click(container, '[data-testid="milestone-release-0"]');
    // 缺省全勾
    expect(container.querySelector('[data-testid="milestone-check-attitude"]')?.getAttribute("aria-pressed")).toBe("true");
    click(container, '[data-testid="milestone-check-attitude"]');
    expect(container.querySelector('[data-testid="milestone-check-attitude"]')?.getAttribute("aria-pressed")).toBe("false");
    click(container, '[data-testid="confirm-ok"]');
    await flush();
    expect(postedBody).toEqual({ pass: { attitude: false, appearance: true, restoration: true } });
    expect(container.querySelector('[data-testid="milestone-row-0"]')?.getAttribute("data-status")).toBe("RELEASED");
    expect(container.querySelector('[data-testid="milestone-released-total"]')?.textContent).toContain("已放款 ¥475");
  });
});
