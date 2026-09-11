// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { useAppStore, type Booking } from "@/store/useAppStore";
import ReviewForm from "./ReviewFormModal";

const booking: Booking = {
  id: "b1",
  category: "保洁",
  title: "深度保洁",
  time: "明天 09:00",
  providerName: "王姐",
  price: "¥180",
  status: "completed",
  createdAt: Date.now(),
};

let host: HTMLDivElement | null = null;
afterEach(() => {
  host?.remove();
  host = null;
  useAppStore.setState({ reviews: [], bookings: [] });
});

async function mount() {
  host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  // useMountedNow 首帧 now=0 → 渲染外放行 effect 定时器，再空 act 冲刷更新
  await act(async () => {
    root.render(<ReviewForm booking={booking} onBack={() => {}} />);
  });
  await new Promise((r) => setTimeout(r, 50));
  await act(async () => {});
  return { host: host as HTMLDivElement, unmount: () => act(() => root.unmount()) };
}

function click(host: HTMLDivElement, sel: string) {
  act(() => {
    (host.querySelector(sel) as HTMLElement).click();
  });
}

describe("ReviewForm 订单轨撤销窗（72h 内改 1 次）", () => {
  it("提交后出现修改入口；改后记账且入口消失", async () => {
    const { host, unmount } = await mount();
    // 5 星提交
    click(host, '[aria-label="5 星"]');
    // 提交按钮（先点星星再提交 → 提交评价）
    const submit = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("提交评价")
    )!;
    act(() => submit.click());
    // 二次确认
    click(host, '[data-testid="confirm-ok"]');
    expect(host.textContent).toContain("感谢评价");
    // 修改入口出现（仅一次）
    expect(host.querySelector('[data-testid="edit-review"]')).not.toBeNull();
    click(host, '[data-testid="edit-review"]');
    expect(host.textContent).toContain("修改评价");
    // 改成 4 星并确认修改
    click(host, '[aria-label="4 星"]');
    const modify = Array.from(host.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("确认修改")
    )!;
    act(() => modify.click());
    click(host, '[data-testid="confirm-ok"]');
    const stored = useAppStore.getState().reviews.find((r) => r.bookingId === "b1");
    expect(stored?.rating).toBe(4);
    expect(stored?.editCount).toBe(1);
    expect(host.textContent).toContain("已修改");
    // 第二次入口消失
    expect(host.querySelector('[data-testid="edit-review"]')).toBeNull();
    unmount();
  });

  it("未提交时无修改入口", async () => {
    const { host, unmount } = await mount();
    expect(host.querySelector('[data-testid="edit-review"]')).toBeNull();
    unmount();
  });
});
