import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import M20Page, {
  buildM20DemandText,
  M20_CATEGORY_TAG,
  M20_PRESETS,
} from "@/app/(growth)/m20/page";

describe("m20 男盘单页", () => {
  it("静态渲染含三套餐与契约卡", () => {
    const html = renderToStaticMarkup(<M20Page />);
    for (const p of M20_PRESETS) {
      expect(html).toContain(p.name);
      expect(html).toContain(p.price);
    }
    expect(html).toContain("一键极速下单");
    expect(html).toContain("现场增项先确认后加价");
    expect(html).toContain("资金全额官方托管");
  });

  it("需求文本合成：类目标签 + 套餐 + 微调", () => {
    const text = buildM20DemandText(M20_PRESETS[0], "自带水冷，周六下午");
    expect(text).toContain(M20_CATEGORY_TAG);
    expect(text).toContain("全套清灰装机");
    expect(text).toContain("自带水冷，周六下午");
  });

  it("空微调不带补充后缀", () => {
    const text = buildM20DemandText(M20_PRESETS[1], "   ");
    expect(text).not.toContain("补充");
    expect(text).toContain("系统与驱动维护");
  });
});
