// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import PublishFormSchemaBridge, {
  budgetWordBlocks,
  durationWordBlocks,
  TIME_WORD_BLOCKS,
} from "@/components/waves/_components/PublishFormSchemaBridge";
import type { DraftFormField } from "@/components/waves/DynamicDraftCard";
import type { PricingModel } from "@/types/ammo-schema";

const HOURLY: PricingModel = { kind: "HOURLY", rateYuan: 60, minHours: 2 };
const FIXED: PricingModel = { kind: "FIXED", amountYuan: 88 };
const FORMULA_ZERO_FLOOR: PricingModel = { kind: "FORMULA", formulaId: "test-formula" };

const FIELDS: DraftFormField[] = [
  { key: "roomCount", label: "房间数量", type: "enum", value: "1室", options: ["1室", "2室"], required: true },
  { key: "hours", label: "服务时长", type: "number", value: 2, required: false },
  { key: "hasPet", label: "家有宠物", type: "boolean", value: false, required: false },
  { key: "note", label: "备注", type: "string", value: "", required: false },
];

type BridgeProps = Parameters<typeof PublishFormSchemaBridge>[0];

async function mountBridge(overrides: Partial<BridgeProps> = {}) {
  const props: BridgeProps = {
    fields: FIELDS,
    ammoId: "housekeeping-v1",
    bizParams: { roomCount: "1室", hours: 2, hasPet: false, note: "" },
    onBizParamsChange: vi.fn(),
    pricingModel: HOURLY,
    onBackfillTime: vi.fn(),
    onBackfillBudget: vi.fn(),
    ...overrides,
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<PublishFormSchemaBridge {...props} />);
  });
  return {
    container,
    props,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

describe("词块派生纯函数（宪法 #5：价格 100% 弹药 D2 派生，零硬编码）", () => {
  it("预算三档锁定公式：经济=floor / 推荐=ceil(floor×1.5) / 加急=floor×2", () => {
    expect(budgetWordBlocks(HOURLY)).toEqual([
      { label: "经济 ¥120", yuan: 120 },
      { label: "推荐 ¥180", yuan: 180 },
      { label: "加急 ¥240", yuan: 240 },
    ]);
  });

  it("底价为 0（FORMULA 缺 baseRate）→ 空档不渲染（杜绝 ¥0 词块）", () => {
    expect(budgetWordBlocks(FORMULA_ZERO_FLOOR)).toEqual([]);
  });

  it("时长词块仅 HOURLY 弹药：4 档 = rateYuan × h；FIXED → null 不渲染", () => {
    expect(durationWordBlocks(HOURLY)).toEqual([
      { label: "1小时", hours: 1, yuan: 60 },
      { label: "2小时", hours: 2, yuan: 120 },
      { label: "半天 (4h)", hours: 4, yuan: 240 },
      { label: "全天 (8h)", hours: 8, yuan: 480 },
    ]);
    expect(durationWordBlocks(FIXED)).toBeNull();
  });

  it("时段词块表驱动常量：4 档且文案锁定", () => {
    expect(TIME_WORD_BLOCKS.map((b) => b.label)).toEqual([
      "尽快上门",
      "今晚 19:00",
      "明天上午",
      "周末下午",
    ]);
  });
});

describe("词块渲染与回填（真实 state 绑定，杜绝假按钮）", () => {
  it("既有调用零变化：不传 pricingModel/回调 → 词块区不渲染，动态表单照常", async () => {
    const { container, unmount } = await mountBridge({
      pricingModel: undefined,
      onBackfillTime: undefined,
      onBackfillBudget: undefined,
    });
    expect(container.querySelector('[data-testid="publish-word-bank"]')).toBeNull();
    expect(container.querySelector('[data-testid="publish-dynamic-form"]')).not.toBeNull();
    expect(container.querySelector('[data-field="roomCount"]')).not.toBeNull();
    unmount();
  });

  it("fields 为空且无词块能力 → 整体 null（既有早退语义保留）", async () => {
    const { container, unmount } = await mountBridge({
      fields: [],
      pricingModel: undefined,
      onBackfillTime: undefined,
      onBackfillBudget: undefined,
    });
    expect(container.childElementCount).toBe(0);
    unmount();
  });

  it("HOURLY 弹药 + 回调 → 词块区渲染：4 时段 + 4 时长 + 3 预算", async () => {
    const { container, unmount } = await mountBridge();
    const bank = container.querySelector('[data-testid="publish-word-bank"]');
    expect(bank).not.toBeNull();
    expect(container.querySelectorAll('[data-word-kind="time"]')).toHaveLength(TIME_WORD_BLOCKS.length);
    expect(container.querySelectorAll('[data-word-kind="duration"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-word-kind="budget"]')).toHaveLength(3);
    unmount();
  });

  it("点时段词块 → onBackfillTime 收到原文（time 自由文本零格式约定）", async () => {
    const { container, props, unmount } = await mountBridge();
    const pill = container.querySelector(
      '[data-word-kind="time"][data-word-label="今晚 19:00"]',
    ) as HTMLButtonElement;
    await act(async () => {
      pill.click();
    });
    expect(props.onBackfillTime).toHaveBeenCalledWith("今晚 19:00");
    unmount();
  });

  it("点预算「推荐」档 → onBackfillBudget 收到 ceil(floor×1.5)=180", async () => {
    const { container, props, unmount } = await mountBridge();
    const pill = container.querySelector(
      '[data-word-kind="budget"][data-word-label="推荐 ¥180"]',
    ) as HTMLButtonElement;
    await act(async () => {
      pill.click();
    });
    expect(props.onBackfillBudget).toHaveBeenCalledWith(180);
    unmount();
  });

  it("点时长「全天 (8h)」→ 预算联动 rateYuan×8=480（HOURLY 专属行为）", async () => {
    const { container, props, unmount } = await mountBridge();
    const pill = container.querySelector(
      '[data-word-kind="duration"][data-word-label="全天 (8h)"]',
    ) as HTMLButtonElement;
    await act(async () => {
      pill.click();
    });
    expect(props.onBackfillBudget).toHaveBeenCalledWith(480);
    unmount();
  });

  it("FIXED 弹药 → 时长词块行不渲染（非 HOURLY 零死字段）", async () => {
    const { container, unmount } = await mountBridge({ pricingModel: FIXED });
    expect(container.querySelector('[data-testid="publish-word-bank"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-word-kind="duration"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-word-kind="budget"]')).toHaveLength(3);
    unmount();
  });
});
