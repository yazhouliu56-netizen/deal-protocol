import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BookingTimeRow, { bookingRuleLine, formatSlotRange } from "./booking-time-row";

describe("bookingRuleLine（表驱动，下单即告知）", () => {
  it("读标准档：需求方车马费¥30＋服务方全退扣保证金", () => {
    const line = bookingRuleLine();
    expect(line).toContain("¥30");
    expect(line).toContain("全额退");
  });
});

describe("formatSlotRange（本地墙钟 24h＋区间，跨 TZ 稳定）", () => {
  it("本地 14:00 起 2 小时 → 09-29 14:00–16:00（2 小时）", () => {
    // 本地构造子（跨 TZ 意图一致：本地墙钟 14 点）。
    const s = new Date(2026, 8, 29, 14, 0, 0).toISOString();
    const e = new Date(2026, 8, 29, 16, 0, 0).toISOString();
    expect(formatSlotRange(s, e)).toBe("09-29 14:00–16:00（2 小时）");
  });

  it("非法输入回空串，不抛", () => {
    expect(formatSlotRange("bad", "bad")).toBe("");
  });
});
describe("BookingTimeRow 静态渲染", () => {
  it("首帧 idle：双钮在位，明细收起", () => {
    const html = renderToStaticMarkup(<BookingTimeRow value={null} onChange={() => {}} />);
    expect(html).toContain('data-testid="booking-time-row"');
    expect(html).toContain("现在就要");
    expect(html).toContain("预约时间");
    expect(html).not.toContain('data-testid="booking-detail"');
  });
});
