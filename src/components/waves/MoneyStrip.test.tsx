import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MoneyStrip from "./MoneyStrip";

const base = {
  budgetYuan: 150,
  fiveState: "MATCHED" as const,
  fulfilled: false,
  settled: false,
  openDispute: false,
  removed: false,
};

describe("MoneyStrip static", () => {
  it("托管态：条＋金额＋五段", () => {
    const html = renderToStaticMarkup(<MoneyStrip {...base} />);
    expect(html).toContain("money-strip");
    expect(html).toContain("¥150");
    expect(html).toContain("托管中");
    expect(html).toContain("已结算");
  });

  it("争议态：红色覆盖", () => {
    const html = renderToStaticMarkup(<MoneyStrip {...base} openDispute />);
    expect(html).toContain("争议冻结");
    expect(html).toContain("text-red-500");
  });

  it("缺数：同步中", () => {
    const html = renderToStaticMarkup(<MoneyStrip {...base} budgetYuan={NaN} />);
    expect(html).toContain("同步中");
  });
});
