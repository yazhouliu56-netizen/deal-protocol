// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it } from "vitest";

import ChatPage from "./ChatPage";
import { useAppStore } from "@/store/useAppStore";
import { useWaveStore } from "@/store/useWaveStore";
import { useIdentityStore } from "@/store/useIdentityStore";

// jsdom 未实现 Element.scrollTo → 该 API 仅滚动容器，测试中无副作用
if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => undefined as never;
}

/** AI 确认卡 → 用户点击【确认预订】后生成的 success 卡（与 handleBook 产物同构）。 */
function seedSuccessCard(overrides: { category?: string; price?: string } = {}) {
  const id = useIdentityStore.getState().identity.id;
  useWaveStore.setState({ waves: [], claims: [] });
  useAppStore.setState({
    screen: "ai",
    chatMessages: [
      {
        id: "m-ai-1",
        role: "user" as const,
        content: "我要预约明天下午保洁",
      },
      {
        id: "m-ai-2",
        role: "assistant" as const,
        content: "已为你安排：",
        cards: [
          {
            type: "success" as const,
            id: "success-card-1",
            title: "预订成功",
            price: overrides.price ?? "¥200",
            lines: [
              { k: "服务", v: overrides.category ?? "家政保洁" },
              { k: "对象", v: "保洁阿姨 王姐" },
              { k: "时段", v: "明天 11:00" },
              { k: "地点", v: "幸福家园小区" },
              { k: "订单号", v: "ABC12345" },
            ],
          },
        ],
      },
    ],
    bookings: [],
  });
  return id;
}

describe("P1 AI 对话直通弹药发单闭环（ChatPage）", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  const findConvert = () =>
    [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === "转为正式订单",
    );

  it("success 卡渲染【转为正式订单】按钮", async () => {
    seedSuccessCard();
    await act(async () => {
      root.render(<ChatPage />);
    });
    expect(findConvert()).not.toBeUndefined();
  });

  it("点击转单 → createWave 落库（ammoId=housekeeping-v1 + status=active）→ 顶部胶囊驱动（切 home）", async () => {
    seedSuccessCard();
    await act(async () => {
      root.render(<ChatPage />);
    });

    const btn = findConvert();
    await act(async () => {
      btn?.click();
    });

    const waves = useWaveStore.getState().waves;
    expect(waves.length).toBe(1);
    expect(waves[0].ammoId).toBe("housekeeping-v1");
    expect(waves[0].status).toBe("active");
    expect(waves[0].basics.category).toBe("家政保洁");
    expect(waves[0].budget).toBe(200);
    expect(useAppStore.getState().screen).toBe("home");
  });

  it("已转单的卡渲染【已转正式订单】禁用态（幂等：重复点击不二次落库）", async () => {
    seedSuccessCard({ category: "羽毛球约局", price: "¥60" });
    await act(async () => {
      root.render(<ChatPage />);
    });
    const btn = findConvert();
    await act(async () => {
      btn?.click();
    });
    const afterFirst = useWaveStore.getState().waves.length;
    expect(afterFirst).toBe(1);
    expect(useWaveStore.getState().waves[0].ammoId).toBe("meetup-social-v1");

    // 卡更新为已转单态，再点同类按钮不再产生（按钮已变为禁用徽标）
    expect(useAppStore.getState().chatMessages[1].cards?.[0]).toMatchObject({
      lines: expect.arrayContaining([{ k: "弹药单号", v: expect.any(String) }]),
    });
    const again = findConvert();
    expect(again).toBeUndefined();
    expect(useWaveStore.getState().waves.length).toBe(1);
  });
});