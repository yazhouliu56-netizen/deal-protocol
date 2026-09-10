import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FactoryConsole, { pricingText, strList } from "./FactoryConsole";

describe("FactoryConsole static", () => {
  it("输入＋生成键渲染", () => {
    const html = renderToStaticMarkup(<FactoryConsole />);
    expect(html).toContain("factory-console");
    expect(html).toContain("一句话开品类");
    expect(html).toContain("生成品类");
  });
});

describe("FactoryConsole pure", () => {
  it("定价四式＋缺数回落", () => {
    expect(pricingText({ pricingModel: { kind: "FIXED", amountYuan: 50 } })).toContain("¥50");
    expect(pricingText({ pricingModel: { kind: "HOURLY", rateYuan: 60, minHours: 2 } })).toContain("¥60");
    expect(pricingText({ pricingModel: { kind: "PER_SEAT", perSeatYuan: 80, minSeats: 2 } })).toContain("¥80");
    expect(pricingText({ pricingModel: { kind: "FORMULA" } })).toContain("公式");
    expect(pricingText({})).toBe("见配置");
  });

  it("strList 只收字符串", () => {
    expect(strList(["a", 1, null, "b"])).toEqual(["a", "b"]);
    expect(strList("x")).toEqual([]);
  });
});
