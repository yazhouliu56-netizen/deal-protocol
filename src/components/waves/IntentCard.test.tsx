import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import IntentCard from "./IntentCard";
import type { IntentCard as IntentCardData } from "@/types/intent-card";

const base: IntentCardData = {
  id: "t1",
  scene: { ammoId: "a", version: 1 },
  title: "今晚7点·上门做饭",
  lines: [
    { key: "time", label: "时间", value: "今晚7点", source: "user", editable: true },
    { key: "area", label: "地点", value: "幸福家园", source: "ai", confidence: 0.7, editable: true },
  ],
  price: { totalYuan: 80, basis: "quote", changeRule: "加项需确认", refundRule: "未上门全退" },
  assurance: [{ key: "lock", label: "锁价" }],
  irreversible: ["接单后取消扣款"],
  aiMarks: [{ lineKey: "area", level: "mid", reason: "根据你上次地址" }],
  state: "ready",
  expiresAt: Date.now() + 900000,
  traceId: "intent-t1",
};

const noop = () => {};

describe("IntentCard static", () => {
  it("ready: 价格暖色＋AI标＋未勾选发射禁用", () => {
    const html = renderToStaticMarkup(<IntentCard card={base} onEditLine={noop} onRelaunch={noop} onLaunch={noop} />);
    expect(html).toContain("¥80");
    expect(html).toContain("text-orange-600");
    expect(html).toContain("AI依据:地点");
    expect(html).toContain("已知晓价格与退款规则");
    expect(html).toContain("disabled");
  });

  it("assembling: 骨架屏占位", () => {
    const html = renderToStaticMarkup(
      <IntentCard card={{ ...base, state: "assembling" }} onEditLine={noop} onRelaunch={noop} onLaunch={noop} />,
    );
    expect(html).toContain("intent-skeleton");
  });

  it("locked: 章戳不可编辑；stale: 灰化重组", () => {
    const locked = renderToStaticMarkup(
      <IntentCard card={{ ...base, state: "locked" }} onEditLine={noop} onRelaunch={noop} onLaunch={noop} />,
    );
    expect(locked).toContain("已锁 ¥80");
    const stale = renderToStaticMarkup(
      <IntentCard card={{ ...base, state: "stale" }} onEditLine={noop} onRelaunch={noop} onLaunch={noop} />,
    );
    expect(stale).toContain("重新组装");
  });

  it("长辈态：三样元素", () => {
    const html = renderToStaticMarkup(
      <IntentCard card={base} mode="elder" onEditLine={noop} onRelaunch={noop} onLaunch={noop} />,
    );
    expect(html).toContain("今晚7点·上门做饭");
    expect(html).toContain("¥80");
    expect(html).toContain("发射");
  });

  it("价格闪现文案透出", () => {
    const html = renderToStaticMarkup(
      <IntentCard card={base} flashText="＋¥10，因加洗油烟机" onEditLine={noop} onRelaunch={noop} onLaunch={noop} />,
    );
    expect(html).toContain("intent-price-flash");
  });
});
