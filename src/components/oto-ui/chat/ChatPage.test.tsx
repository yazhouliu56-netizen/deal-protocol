// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

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
    screen: "home",
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
      lines: expect.arrayContaining([{ k: "方案单号", v: expect.any(String) }]),
    });
    const again = findConvert();
    expect(again).toBeUndefined();
    expect(useWaveStore.getState().waves.length).toBe(1);
  });
});

/** 首页融合座舱（compact）：4 大意图快捷气泡 + 弹药草稿回钩（原地展开拟物草稿卡）。 */
/** 等待异步流式引擎（MockEngine 字符级流：chat 分支可达数秒）消费完成。 */
async function flushUntil(predicate: () => boolean, timeoutMs = 9000) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) break;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
}

describe("P1.5 首页融合座舱（ChatPage compact 嵌入首页）", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useAppStore.setState({ chatMessages: [], bookings: [] });
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("compact 渲染：4 大意图快捷气泡 + 统一输入框 + 拟物卡流动态区", async () => {
    await act(async () => {
      root.render(<ChatPage compact />);
    });
    const bubbles = [...container.querySelectorAll('[data-testid="intent-bubbles"] button')];
    expect(bubbles).toHaveLength(4);
    expect(bubbles.map((b) => b.getAttribute("aria-label"))).toEqual([
      "🧽 周末日常保洁 拟物发单",
      "🏸 周日羽毛球约局 拟物发单",
      "📷 约拍日系写真 拟物发单",
      "🔧 家电上门维修 拟物发单",
    ]);
    expect(container.querySelector('input[placeholder*="描述你的需求"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="compact-chat-flow"]')).not.toBeNull();
  });

  it("点击意图气泡：回钩弹药草稿（key + 中文类目）且对话引擎同步送话术", { timeout: 15000 }, async () => {
    const onDraft = vi.fn();
    await act(async () => {
      root.render(<ChatPage compact onAmmoDraft={onDraft} />);
    });
    const bubble = container.querySelector<HTMLButtonElement>(
      'button[data-ammo="meetup"]'
    )!;
    expect(bubble).not.toBeNull();
    await act(async () => {
      bubble.click();
    });
    expect(onDraft).toHaveBeenCalledWith("meetup", "羽毛球约局");
    // 气泡按钮同步回钩草稿，流式引擎仍在异步产出 → 等回复落定（占位消息原地更新）
    await flushUntil(() => {
      const msgs = useAppStore.getState().chatMessages;
      const last = msgs[msgs.length - 1];
      return (
        last.role === "assistant" &&
        (last.content.length > 0 || (last.cards?.length ?? 0) > 0)
      );
    });
    const msgs = useAppStore.getState().chatMessages;
    expect(
      msgs.some((m) => m.role === "user" && m.content.includes("羽毛球"))
    ).toBe(true);
    expect(
      msgs.some(
        (m) => m.role === "assistant" && (m.content.length > 0 || (m.cards?.length ?? 0) > 0)
      )
    ).toBe(true);
  });

  it("输入口语文本（擦玻璃）发送：对话流完成后原地回钩保洁弹药草稿", { timeout: 15000 }, async () => {
    const onDraft = vi.fn();
    await act(async () => {
      root.render(<ChatPage compact onAmmoDraft={onDraft} />);
    });
    const input = container.querySelector<HTMLInputElement>('input[placeholder*="描述你的需求"]')!;
    await act(async () => {
      // React 受控输入需原生 setter 触发 onChange（直接赋值不更新内部 state）
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!;
      setter.call(input, "明天下午找人擦玻璃");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="发送"]')!.click();
    });
    await flushUntil(() => onDraft.mock.calls.length > 0);
    expect(onDraft).toHaveBeenCalledWith("housekeeping", "擦玻璃");
  });

  it("非弹药闲聊（你好）：草稿回钩回落全类目 default 弹药", { timeout: 15000 }, async () => {
    const onDraft = vi.fn();
    await act(async () => {
      root.render(<ChatPage compact onAmmoDraft={onDraft} />);
    });
    const input = container.querySelector<HTMLInputElement>('input[placeholder*="描述你的需求"]')!;
    await act(async () => {
      // React 受控输入需原生 setter 触发 onChange（直接赋值不更新内部 state）
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!;
      setter.call(input, "你好呀");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="发送"]')!.click();
    });
    await flushUntil(() => onDraft.mock.calls.length > 0);
    expect(onDraft).toHaveBeenCalledWith("default-ammo", "全类目需求");
  });
});

describe("信息架构重组：ChatPage slim（首页灭双头怪）", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    useAppStore.setState({
      chatMessages: [
        {
          id: "greeting",
          role: "assistant",
          content: "你好呀，我是 AI 撮合助手 ✨ 本地线下面基服务都能帮你安排",
        },
      ],
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("slim 收敛重复：无 AI 撮合标题 / 无意图气泡 / 无 greeting 重播卡，保留常驻发单对话框与消息流", async () => {
    await act(async () => {
      root.render(<ChatPage compact slim />);
    });
    expect(container.querySelector('[data-testid="intent-bubbles"]')).toBeNull();
    expect(container.textContent).not.toContain("AI 撮合助手");
    expect(container.textContent).not.toContain("你好呀，我是 AI 撮合助手");
    expect(container.textContent).not.toContain("重播语音");
    // 常驻发单对话框：文本输入 + 发送 + 按住说话（VoiceBar 数据属性）
    expect(container.querySelector('input[placeholder*="描述你的需求"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="发送"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="compact-chat-flow"]')).not.toBeNull();
    // 新对话 / 语音控制保留（功能零丢失）
    expect(container.textContent).toContain("新对话");
    expect(container.textContent).toContain("语音");
  });

  it("slim 发送口语文本：弹药草稿回钩能力 100% 保留", { timeout: 15000 }, async () => {
    const onDraft = vi.fn();
    await act(async () => {
      root.render(<ChatPage compact slim onAmmoDraft={onDraft} />);
    });
    const input = container.querySelector<HTMLInputElement>('input[placeholder*="描述你的需求"]')!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )!.set!;
      setter.call(input, "明天下午找人擦玻璃");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('button[aria-label="发送"]')!.click();
    });
    await flushUntil(() => onDraft.mock.calls.length > 0);
    expect(onDraft).toHaveBeenCalledWith("housekeeping", "擦玻璃");
  });
});