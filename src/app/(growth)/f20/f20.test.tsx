import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import F20Page, {
  buildF20DemandText,
  F20_CATEGORY_TAG,
  F20_PRESETS,
} from "@/app/(growth)/f20/page";

describe("f20 女盘单页", () => {
  it("静态渲染含三套餐与契约卡", () => {
    const html = renderToStaticMarkup(<F20Page />);
    for (const p of F20_PRESETS) {
      expect(html).toContain(p.name);
      expect(html).toContain(p.price);
    }
    expect(html).toContain("一键极速下单");
    expect(html).toContain("公安核验");
    expect(html).toContain("双拍前后对比验收");
  });

  it("需求文本合成：类目标签 + 套餐 + 微调", () => {
    const text = buildF20DemandText(F20_PRESETS[0], "周六上午，要女性收纳师");
    expect(text).toContain(F20_CATEGORY_TAG);
    expect(text).toContain("换季衣橱整理");
    expect(text).toContain("女性收纳师");
  });

  it("空微调不带补充后缀", () => {
    const text = buildF20DemandText(F20_PRESETS[2], "");
    expect(text).not.toContain("补充");
    expect(text).toContain("搬家还原");
  });
});
