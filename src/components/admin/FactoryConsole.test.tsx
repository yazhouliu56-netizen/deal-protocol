import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FactoryConsole from "./FactoryConsole";

describe("FactoryConsole static", () => {
  it("输入＋生成键渲染", () => {
    const html = renderToStaticMarkup(<FactoryConsole />);
    expect(html).toContain("factory-console");
    expect(html).toContain("一句话开品类");
    expect(html).toContain("生成品类");
  });
});
