import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BookingTimeRow, { bookingRuleLine } from "./booking-time-row";

describe("bookingRuleLine（表驱动，下单即告知）", () => {
  it("读标准档：需求方车马费¥30＋服务方全退扣保证金", () => {
    const line = bookingRuleLine();
    expect(line).toContain("¥30");
    expect(line).toContain("全额退");
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
