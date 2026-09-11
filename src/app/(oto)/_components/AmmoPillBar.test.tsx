import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ScenarioTheme } from "@/types/ui-viewport";
import AmmoPillBar, { pillTagFor, THEME_TONE, type AmmoPillDescriptor } from "@/app/(oto)/_components/AmmoPillBar";

const THEMES: ScenarioTheme[] = ["housekeeping", "meetup", "companion", "tech", "default"];
const pills: AmmoPillDescriptor[] = THEMES.map((theme, i) => ({
  ammoId: `t${i}`,
  category: `c${i}`,
  label: `L${i}`,
  icon: "🛠",
  theme,
}));
const noop = () => {};

describe("AmmoPillBar Batch④-4：暗岛 hex 出清", () => {
  it("THEME_TONE 覆盖全部 ScenarioTheme（未知 theme 兜底 default，不抛）", () => {
    for (const t of THEMES) expect(THEME_TONE[t]).toBeTruthy();
    expect(THEME_TONE["nope" as ScenarioTheme] ?? THEME_TONE.default).toBe("green");
  });

  it("变体 tiles：零 hex 内联色＋锚点保留", () => {
    const html = renderToStaticMarkup(<AmmoPillBar pills={pills} onSelectDraft={noop} variant="tiles" />);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    for (const p of pills) {
      expect(html).toContain(`data-testid="pill-${p.ammoId}"`);
      expect(html).toContain(`data-theme="${p.theme}"`);
    }
  });

  it("变体 compact：前 4 枚＋零 hex", () => {
    const html = renderToStaticMarkup(<AmmoPillBar pills={pills} onSelectDraft={noop} variant="compact" />);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    for (const p of pills.slice(0, 4)) expect(html).toContain(`data-testid="pill-${p.ammoId}"`);
    expect(html).not.toContain('data-testid="pill-t4"');
  });

  it("变体 featured：按注册表展位过滤＋零 hex", () => {
    const featured: AmmoPillDescriptor[] = [
      { ammoId: "meetup-social-v1", category: "meetup", label: "组局", icon: "🎉", theme: "meetup" },
      { ammoId: "housekeeping-v1", category: "housekeeping", label: "家政", icon: "🧹", theme: "housekeeping" },
      { ammoId: "companion-v1", category: "companion", label: "陪伴", icon: "☕", theme: "companion" },
      { ammoId: "appliance-repair-v1", category: "appliance", label: "维修", icon: "🔧", theme: "tech" },
    ];
    const html = renderToStaticMarkup(<AmmoPillBar pills={featured} onSelectDraft={noop} variant="featured" />);
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    for (const p of featured) {
      expect(html).toContain(`data-testid="pill-${p.ammoId}"`);
      expect(html).toContain(`data-theme="${p.theme}"`);
    }
  });

  it("pillTagFor 口径不变（theme→标签零漂移）", () => {
    expect([pillTagFor("meetup"), pillTagFor("housekeeping"), pillTagFor("companion"), pillTagFor("tech"), pillTagFor("default")])
      .toEqual(["热门", "高效", "艺术", "极速", "精选"]);
  });
});
