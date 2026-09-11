import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { METRIC_NAMES } from "@/lib/track-metric";
import LandingPage from "@/app/landing/page";

describe("landing 漏斗可见性（Batch④-1）", () => {
  it("漏斗三事件已注册（分母 page_view＋诊断 click/result）", () => {
    for (const n of ["growth.page_view", "growth.diagnose_click", "growth.diagnose_result"] as const) {
      expect(METRIC_NAMES).toContain(n);
    }
  });

  it("静态渲染含漏斗三触点：输入区＋品类＋诊断 CTA", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toContain("textarea");
    expect(html).toContain("选择故障分类");
    expect(html).toContain("AI 诊断并生成协议");
  });
});
