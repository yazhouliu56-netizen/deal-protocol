// @vitest-environment jsdom
/**
 * ProfilePage 访客身份口径收敛 + 我的订单双源聚合单测（P1 第 3 步）。
 * 覆盖：访客态徽标/钱包文案/P5 代号出清、Alex 硬编码根治、
 * waves+bookings 双源聚合 createdAt 倒序混排、类型徽标显式区分。
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore, type Booking } from "@/store/useAppStore";
import { useIdentityStore } from "@/store/useIdentityStore";
import { useWaveStore } from "@/store/useWaveStore";
import ProfilePage from "./ProfilePage";

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function renderPage() {
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host!);
  act(() => {
    root!.render(<ProfilePage onGoHome={() => {}} />);
  });
}

function text() {
  return host?.textContent ?? "";
}

beforeEach(() => {
  localStorage.clear();
  // 访客态基线：清空 auth（readAuthAccount → null）+ 重置三店
  act(() => {
    useWaveStore.setState({
      waves: [],
      claims: [],
      fulfilment: {},
      privacySessions: [],
    });
    useAppStore.setState({ bookings: [] });
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  host?.remove();
  host = null;
  root = null;
});

describe("访客身份口径收敛", () => {
  it("访客态：展示 [ 演示体验 ] 徽标与本地昵称，钻石会员不可见", () => {
    renderPage();
    const t = text();
    expect(t).toContain("[ 演示体验 ]");
    expect(t).not.toContain("钻石会员");
    expect(document.querySelector('[data-testid="guest-demo-badge"]')).not.toBeNull();
  });

  it("钱包文案：P5 内部代号彻底出清，沙盒模拟余额标注可见", () => {
    renderPage();
    const t = text();
    expect(t).not.toMatch(/P5/);
    expect(t).toContain("虚拟钱包（沙盒模拟余额）");
    expect(t).toContain("沙盒体验环境 · 生产环境将直连持牌银行账户");
  });
});

describe("我的订单双源聚合", () => {
  const me = useIdentityStore.getState().identity.id;

  function seedStores() {
    const now = Date.now();
    const waveOld = {
      id: "wave-old",
      authorId: me,
      basics: { category: "家政保洁", time: "明天10点", area: "A区", radiusKm: 5 },
      budget: 100,
      customs: [],
      negotiable: false,
      capacity: 1,
      expiresAt: now + 3_600_000,
      createdAt: now - 5_000,
      status: "active" as const,
      ammoId: "housekeeping-v1",
    };
    const waveNew = {
      ...waveOld,
      id: "wave-new",
      basics: { ...waveOld.basics, category: "摄影师约拍" },
      budget: 300,
      createdAt: now - 1_000,
      ammoId: "companion-v1",
    };
    const booking: Booking = {
      id: "bk-1",
      category: "羽毛球约局",
      title: "星羽球馆拼局",
      time: "周六14:00",
      providerName: "阿凯",
      price: "¥25/局",
      status: "upcoming",
      createdAt: now - 3_000,
    };
    act(() => {
      useWaveStore.setState({ waves: [waveNew, waveOld] });
      useAppStore.setState({ bookings: [booking] });
    });
  }

  it("waves 弹药单即时可见（跨屏零割裂），带类型徽标与五态状态", () => {
    seedStores();
    renderPage();
    const t = text();
    expect(t).not.toContain("还没有订单");
    expect(t).toContain("[ 弹药单 ]");
    expect(t).toContain("广播中");
    expect(t).toContain("摄影师约拍 · ¥300");
    expect(t).toContain("家政保洁 · ¥100");
  });

  it("bookings 预订卡混排展示，状态中文映射", () => {
    seedStores();
    renderPage();
    const t = text();
    expect(t).toContain("[ 预订卡 ]");
    expect(t).toContain("待出行");
    expect(t).toContain("星羽球馆拼局");
  });

  it("统一按 createdAt 倒序：最新弹药单 → 预订卡 → 较旧弹药单", () => {
    seedStores();
    renderPage();
    const items = Array.from(
      document.querySelectorAll('[data-testid="my-orders"] button'),
    );
    // DOM 不渲染原始 id —— 以业务内容标记判定顺序（摄影师=最新 wave，星羽=booking，家政=较旧 wave）
    const order = items.map((el) => el.textContent ?? "");
    expect(order.length).toBe(3);
    expect(order[0]).toContain("摄影师约拍");
    expect(order[1]).toContain("星羽球馆拼局");
    expect(order[2]).toContain("家政保洁");
  });

  it("登录态：昵称取账号名且钻石会员徽标恢复展示", async () => {
    seedStores();
    localStorage.setItem(
      "oto-auth-account",
      JSON.stringify({ nickname: "王姐", emoji: "👩‍🌾", role: "provider", method: "demo", at: Date.now() }),
    );
    renderPage();
    // syncAuth 为异步 effect：冲刷微任务后读取
    await act(async () => {
      await Promise.resolve();
    });
    const t = text();
    expect(t).toContain("王姐");
    expect(t).toContain("钻石会员");
    expect(t).not.toContain("[ 演示体验 ]");
  });
});
