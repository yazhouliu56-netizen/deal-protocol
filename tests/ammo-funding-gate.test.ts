/**
 * Microkernel 2.0 战役 1（P1-4）· SLA 弹药化门禁考卷：
 * 工厂质检期对未支持资金模式一票否决（UNSUPPORTED_FUNDING_MODE），
 * 白名单内声明放行；slaPhases 合法数值放行。
 */
import { describe, expect, it } from "vitest";
import { validateAmmoConfig } from "@/ammo/factory";
import { IMPACT_FUZE_TEMPLATE } from "@/types/fuze-policy";
import type { IHolographicAmmoConfig } from "@/types/ammo-schema";

function baseConfig(overrides: Partial<IHolographicAmmoConfig> = {}): IHolographicAmmoConfig {
  return {
    ammoId: "pet-board-v1",
    category: "pet-board",
    version: "1.0.0",
    supplyCluster: "C1_MOBILITY",
    pricingModel: "FIXED",
    fuzePolicy: { ...IMPACT_FUZE_TEMPLATE },
    ...overrides,
  } as IHolographicAmmoConfig;
}

describe("弹药工厂 · 资金模式能力白名单（裁决 a Fail-Fast）", () => {
  it("未支持模式（streaming）→ UNSUPPORTED_FUNDING_MODE 一票否决", () => {
    const r = validateAmmoConfig(baseConfig({ fundingMode: "streaming" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.startsWith("UNSUPPORTED_FUNDING_MODE"))).toBe(true);
  });

  it("发明词汇 DIRECT_PAY（零实现）同样拒出厂——严禁第三套词汇表", () => {
    const r = validateAmmoConfig(baseConfig({ fundingMode: "DIRECT_PAY" }));
    expect(r.ok).toBe(false);
  });

  it("白名单内三模式全部放行；缺省（undefined）不触发拦截", () => {
    for (const mode of ["full_prepay", "commitment", "milestone_staged"]) {
      const r = validateAmmoConfig(baseConfig({ fundingMode: mode }));
      expect(r.ok, `mode=${mode} 应放行`).toBe(true);
    }
    expect(validateAmmoConfig(baseConfig()).ok).toBe(true);
  });
});
