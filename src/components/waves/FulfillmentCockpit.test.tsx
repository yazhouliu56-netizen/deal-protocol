// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import FulfillmentCockpit, {
  describeCompletionCta,
  SCENARIO_THEME_META,
  sixDimensionScores,
  type FulfillmentCockpitProps,
} from "@/components/waves/FulfillmentCockpit";

const BASE_PROPS: FulfillmentCockpitProps = {
  status: "IN_SERVICE",
  scenario: "housekeeping",
  provider: { avatar: "🧹", name: "王姐", verified: true, trustScore: 86 },
};

function renderStatic(props: FulfillmentCockpitProps): string {
  return renderToStaticMarkup(<FulfillmentCockpit {...props} />);
}

/** jsdom 挂载渲染并触发 data-action 按钮点击。 */
async function clickAction(
  props: FulfillmentCockpitProps,
  action: string,
): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<FulfillmentCockpit {...props} />);
  });
  const btn = container.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  expect(btn).not.toBeNull();
  await act(async () => {
    btn!.click();
  });
  root.unmount();
  container.remove();
}

describe("FulfillmentCockpit 通用五态履约主屏", () => {
  it("家政场景：清洁蓝主题 + 增项改价卡 + Before/After 双拍池 + NFC 核销 CTA", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      housekeeping: {
        quote: { item: "深度除螨", amountYuan: 80, confirmed: false },
        photos: { before: "/p1.jpg", after: "/p2.jpg" },
        onClaimDamage: () => {},
      },
    });
    expect(html).toContain('data-scenario="housekeeping"');
    expect(html).toContain('data-theme="theme-housekeeping"');
    expect(html).toContain("清洁蓝");
    expect(html).toContain("现场增项：深度除螨");
    expect(html).toContain("+¥80");
    expect(html).toContain("确认增项");
    expect(html).toContain('alt="服务前照片"');
    expect(html).toContain('alt="服务后照片"');
    expect(html).toContain("✅ 双拍验真已通过");
    expect(html).toContain("🛡️ 损坏包赔 · 财产险理赔直连");
    expect(html).toContain(describeCompletionCta("housekeeping"));
    expect(html).toContain("碰一碰 NFC");
  });

  it("组局场景：活力橙主题 + 座次表 + 500m 围栏 + AA 分摊 + 组织者解冻 CTA", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      scenario: "meetup",
      meetup: {
        seats: [
          { id: "a", name: "小美", arrived: true },
          { id: "b", name: "阿凯", arrived: false },
        ],
        fenceMeters: 500,
        onScanArrival: () => {},
        split: {
          totalYuan: 240,
          entries: [
            { party: "小美", deltaYuan: -40 },
            { party: "阿凯", deltaYuan: 80 },
          ],
        },
        onDisputeNoShow: () => {},
      },
    });
    expect(html).toContain('data-theme="theme-meetup"');
    expect(html).toContain("活力橙");
    expect(html).toContain("实时座次表 · 1/2 已到场");
    expect(html).toContain('data-arrived="1"');
    expect(html).toContain("签到围栏 500m");
    expect(html).toContain("扫码到场");
    expect(html).toContain("AA 分摊对账 · 合计 ¥240");
    expect(html).toContain("补缴 +¥80");
    expect(html).toContain("退还 ¥40");
    expect(html).toContain("放鸽子申诉");
    expect(html).toContain(describeCompletionCta("meetup"));
    expect(html).toContain("组织者点选到场成员");
  });

  it("陪玩场景：夜幕紫主题 + 隐私盾 + 伪装假电话 + 300m 距离 + 脱离自动完成 CTA", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      scenario: "companion",
      onTriggerFakeCall: () => {},
      companion: {
        isPrivacyShieldArmed: true,
        departureDistanceMeters: 300,
        onBlockUser: () => {},
      },
    });
    expect(html).toContain('data-theme="theme-companion"');
    expect(html).toContain("夜幕紫");
    expect(html).toContain("🛡️ 隐私防骚扰盾");
    expect(html).toContain("虚拟号保护中 · 行程守护");
    expect(html).toContain("📱 伪装假电话 · 紧急脱身");
    expect(html).toContain("安全距离 300m");
    expect(html).toContain("超出自动停表/结账");
    expect(html).toContain("🚫 敏感词一键拉黑");
    expect(html).toContain(describeCompletionCta("companion"));
    expect(html).toContain("300m 脱离自动完成");
  });

  it("外骨骼顶栏：StatusCapsule 集成五态标签 + LBS 距离 + 离线徽标 + SOS", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      status: "IN_SERVICE",
      capsule: { isOffline: true, distanceMeters: 380, onSosClick: () => {} },
    });
    expect(html).toContain("履约保护中 · GPS锁定");
    expect(html).toContain("距服务者 380m");
    expect(html).toContain("📴 离线");
    expect(html).toContain('aria-label="SOS 紧急求助"');
  });

  it("服务者通用卡片：实名徽章 + 六维信用分 + 虚拟通话/隐私聊天按钮", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      provider: { avatar: "🧹", name: "王姐", verified: true, trustScore: 86 },
    });
    expect(html).toContain("王姐");
    expect(html).toContain("✓ 实名");
    expect(html).toContain("信用 86 分");
    expect(html).toContain('aria-label="一键虚拟通话"');
    expect(html).toContain('aria-label="隐私聊天"');
    const dims = sixDimensionScores(86);
    expect(dims).toHaveLength(6);
    expect(dims.map((d) => d.label)).toEqual(["守时", "专业", "礼貌", "沟通", "诚信", "复购"]);
  });

  it("sixDimensionScores 信用分拆分为 6 维且钳制在 0-100", () => {
    const dims = sixDimensionScores(100);
    expect(dims).toHaveLength(6);
    for (const d of dims) {
      expect(d.value).toBeGreaterThanOrEqual(0);
      expect(d.value).toBeLessThanOrEqual(100);
    }
  });

  it("SCENARIO_THEME_META 三场景主题令牌完备", () => {
    expect(SCENARIO_THEME_META.housekeeping.accent).toBe("#3884ff");
    expect(SCENARIO_THEME_META.meetup.accent).toBe("#f97316");
    expect(SCENARIO_THEME_META.companion.accent).toBe("#a78bfa");
  });
});

describe("FulfillmentCockpit 事件回调", () => {
  it("陪玩：点击伪装假电话触发 onTriggerFakeCall", async () => {
    const fakeCall = vi.fn();
    await clickAction(
      {
        ...BASE_PROPS,
        scenario: "companion",
        onTriggerFakeCall: fakeCall,
        companion: { isPrivacyShieldArmed: true },
      },
      "fake-call",
    );
    expect(fakeCall).toHaveBeenCalledTimes(1);
  });

  it("家政：点击确认增项触发 onAcceptQuote（OnsiteQuoteHook 放行）", async () => {
    const acceptQuote = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FulfillmentCockpit
          {...BASE_PROPS}
          housekeeping={{ quote: { item: "深度除螨", amountYuan: 80, confirmed: false } }}
          onAcceptQuote={acceptQuote}
        />,
      );
    });
    const btns = [...container.querySelectorAll("button")];
    const accept = btns.find((b) => b.textContent?.includes("确认增项"));
    expect(accept).toBeDefined();
    await act(async () => {
      accept!.click();
    });
    expect(acceptQuote).toHaveBeenCalledTimes(1);
    root.unmount();
    container.remove();
  });

  it("组局：点击确认分摊触发 onConfirmSplit（AASplitSettleHook 确认态）", async () => {
    const confirmSplit = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FulfillmentCockpit
          {...BASE_PROPS}
          scenario="meetup"
          meetup={{
            seats: [{ id: "a", name: "小美", arrived: true }],
            split: { totalYuan: 100, entries: [{ party: "小美", deltaYuan: -10 }] },
          }}
          onConfirmSplit={confirmSplit}
        />,
      );
    });
    const btns = [...container.querySelectorAll("button")];
    const confirm = btns.find((b) => b.textContent?.includes("确认分摊"));
    expect(confirm).toBeDefined();
    await act(async () => {
      confirm!.click();
    });
    expect(confirmSplit).toHaveBeenCalledTimes(1);
    root.unmount();
    container.remove();
  });

  it("三场景：底部核销 CTA 点击触发 onComplete", async () => {
    const complete = vi.fn();
    await clickAction({ ...BASE_PROPS, onComplete: complete }, "complete");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("P0 接电：📞 一键虚拟通话触发 onDial", async () => {
    const dial = vi.fn();
    await clickAction({ ...BASE_PROPS, onDial: dial }, "dial");
    expect(dial).toHaveBeenCalledTimes(1);
  });

  it("P0 接电：💬 隐私聊天触发 onChat", async () => {
    const chat = vi.fn();
    await clickAction({ ...BASE_PROPS, onChat: chat }, "chat");
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("P0 接电：SOS 外骨骼胶囊点击触发 onSosClick", async () => {
    const sos = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FulfillmentCockpit {...BASE_PROPS} capsule={{ onSosClick: sos }} />,
      );
    });
    const btn = container.querySelector<HTMLButtonElement>('button[aria-label="SOS 紧急求助"]');
    expect(btn).not.toBeNull();
    await act(async () => {
      btn!.click();
    });
    expect(sos).toHaveBeenCalledTimes(1);
    root.unmount();
    container.remove();
  });
});
