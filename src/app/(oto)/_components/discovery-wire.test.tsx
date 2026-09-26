import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HeroAiDemandCabin from "@/app/(oto)/_components/HeroAiDemandCabin";
import AmmoPillBar, { type AmmoPillDescriptor } from "@/app/(oto)/_components/AmmoPillBar";

const noop = () => {};

describe("B4 发现推荐接线", () => {
  it("cabin 缺省不渲染联想（E2E 零影响）；有 suggestions 且聚焦才展开", () => {
    const bare = renderToStaticMarkup(
      <HeroAiDemandCabin value="" onChange={noop} onLaunch={noop} onMic={noop} />,
    );
    expect(bare).not.toContain("ai-suggest-list");
    expect(bare).toContain('data-testid="ai-demand-cabin"');
    expect(bare).toContain('data-testid="launch-button"');
  });

  it("推荐开关行：缺席不渲染（存量零回归）；出席渲染 toggle", () => {
    const pills: AmmoPillDescriptor[] = [
      { ammoId: "t0", category: "c0", label: "L0", icon: "🛠", theme: "default" },
    ];
    const bare = renderToStaticMarkup(
      <AmmoPillBar pills={pills} onSelectDraft={noop} variant="compact" />,
    );
    expect(bare).not.toContain("discovery-prefs-toggle");
    const withToggle = renderToStaticMarkup(
      <AmmoPillBar pills={pills} onSelectDraft={noop} variant="compact" prefsOn={false} onTogglePrefs={noop} />,
    );
    expect(withToggle).toContain('data-testid="discovery-prefs-toggle"');
    expect(withToggle).toContain("aria-pressed=\"false\"");
  });
});

describe("P2-a 复购回路 recordDiscoveryOrder", () => {
  it("完单即记类目（同类目累加，不同类目分立）", async () => {
    const { recordDiscoveryOrder, loadDiscoveryProfile } = await import("@/lib/discovery-profile");
    recordDiscoveryOrder("p2-cat-a");
    recordDiscoveryOrder("p2-cat-a");
    recordDiscoveryOrder("p2-cat-b");
    const p = loadDiscoveryProfile();
    expect(p.orderCounts["p2-cat-a"]).toBe(2);
    expect(p.orderCounts["p2-cat-b"]).toBe(1);
  });
});