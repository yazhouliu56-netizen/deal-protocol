// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, beforeAll } from "vitest";

import DynamicDraftCard, {
  resolveAmmoTheme,
  resolveDraftThemeClass,
} from "@/components/waves/DynamicDraftCard";
import FulfillmentCockpit, {
  resolveCockpitTheme,
  SCENARIO_THEME_META,
  type FulfillmentCockpitProps,
} from "@/components/waves/FulfillmentCockpit";
import DynamicAmmoSlot, {
  normalizeAmmoTheme,
} from "@/components/waves/slots/DynamicAmmoSlot";
import StatusCapsule from "@/components/oto-ui/StatusCapsule";
import FloatingDock from "@/components/oto-ui/FloatingDock";
import { DEFAULT_FUZE_POLICY } from "@/types/fuze-policy";
import type { IAmmoDefinition } from "@/types/ammo-schema";
import { getAmmoById } from "@/ammo/registry";

/**
 * D-8 战役 · 弹药主题 Token 与视界投影隔离单测（红线 6 前端视界隔离）。
 *
 * 断言面：
 * 1. `data-theme` 作用域键随弹药 `holographic.theme` 精准挂载（四大弹药 + default 兜底）；
 * 2. 未知/缺失主题安全回落 default，严禁样式崩溃；
 * 3. tech 主题（工业绿）令牌声明即生效；
 * 4. 外骨骼组件（StatusCapsule / FloatingDock）零 `data-theme` 侵入 —— 红线 6。
 */

/** FloatingDock 依赖 window.matchMedia（桌面断点探测），jsdom 缺失 → 全文件级 polyfill。 */
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

/** 合成探针弹药：可注入任意 theme 声明（含非法值破坏性用例）。 */
function buildProbeAmmo(theme?: unknown): IAmmoDefinition {
  return {
    ammoId: "theme-probe-v1",
    category: "PROBE",
    version: "1.0.0",
    supplyCluster: "C2_IN_HOME",
    fiveStateHooks: [],
    pricingModel: { kind: "FIXED", amountYuan: 99 },
    fuzePolicy: DEFAULT_FUZE_POLICY,
    holographic:
      theme === undefined
        ? undefined
        : ({ theme } as IAmmoDefinition["holographic"]),
  };
}

const COCKPIT_BASE: FulfillmentCockpitProps = {
  status: "IN_SERVICE",
  ammo: getAmmoById("housekeeping-v1"),
  provider: { avatar: "🧹", name: "王姐", verified: true, trustScore: 86 },
};

describe("normalizeAmmoTheme 主题令牌归一（唯一归一点）", () => {
  it("四大业务主题直通", () => {
    expect(normalizeAmmoTheme("housekeeping")).toBe("housekeeping");
    expect(normalizeAmmoTheme("meetup")).toBe("meetup");
    expect(normalizeAmmoTheme("companion")).toBe("companion");
    expect(normalizeAmmoTheme("tech")).toBe("tech");
  });

  it("缺失 / null / 非法字符串 → 安全回落 default", () => {
    expect(normalizeAmmoTheme(undefined)).toBe("default");
    expect(normalizeAmmoTheme(null)).toBe("default");
    expect(normalizeAmmoTheme("")).toBe("default");
    expect(normalizeAmmoTheme("cyber-pop")).toBe("default");
    expect(normalizeAmmoTheme(42)).toBe("default");
  });
});

describe("DynamicDraftCard 草稿卡 · data-theme 精准注入", () => {
  it("保洁弹药 → data-theme=\"housekeeping\"（专业蓝）", () => {
    const html = renderToStaticMarkup(<DynamicDraftCard category="housekeeping" />);
    expect(html).toContain('data-theme="housekeeping"');
    expect(html).toContain("draft-card draft-housekeeping");
  });

  it("组局弹药 → data-theme=\"meetup\"（活力橙）", () => {
    const html = renderToStaticMarkup(<DynamicDraftCard category="meetup" />);
    expect(html).toContain('data-theme="meetup"');
    expect(html).toContain("draft-card draft-meetup");
  });

  it("陪玩弹药 → data-theme=\"companion\"（夜幕紫）", () => {
    const html = renderToStaticMarkup(<DynamicDraftCard category="companion" />);
    expect(html).toContain('data-theme="companion"');
    expect(html).toContain("draft-card draft-companion");
  });

  it("未声明主题弹药 → data-theme=\"default\" 安全兜底", () => {
    const html = renderToStaticMarkup(
      <DynamicDraftCard category="probe" ammo={buildProbeAmmo()} />,
    );
    expect(html).toContain('data-theme="default"');
    expect(html).toContain("draft-card draft-default");
  });

  it("tech 主题弹药（工业绿）→ data-theme=\"tech\" 声明即生效", () => {
    const html = renderToStaticMarkup(
      <DynamicDraftCard category="probe" ammo={buildProbeAmmo("tech")} />,
    );
    expect(html).toContain('data-theme="tech"');
    expect(html).toContain("draft-card draft-tech");
  });

  it("非法主题声明 → data-theme=\"default\" 兜底（严禁样式崩溃）", () => {
    const html = renderToStaticMarkup(
      <DynamicDraftCard category="probe" ammo={buildProbeAmmo("unknown-fake")} />,
    );
    expect(html).toContain('data-theme="default"');
  });

  it("resolveAmmoTheme / resolveDraftThemeClass 纯函数语义对齐", () => {
    expect(resolveAmmoTheme(buildProbeAmmo("companion"))).toBe("companion");
    expect(resolveAmmoTheme(buildProbeAmmo("tech"))).toBe("tech");
    expect(resolveAmmoTheme(buildProbeAmmo("nope"))).toBe("default");
    expect(resolveDraftThemeClass(buildProbeAmmo("meetup"))).toBe("draft-meetup");
    expect(resolveDraftThemeClass(buildProbeAmmo())).toBe("draft-default");
  });
});

describe("FulfillmentCockpit 座舱 · 视口 data-theme 注入", () => {
  it("制式三场景直映主题键（由各官方弹 theme 派生）", () => {
    const hk = renderToStaticMarkup(<FulfillmentCockpit {...COCKPIT_BASE} />);
    expect(hk).toContain('data-theme="housekeeping"');
    const mu = renderToStaticMarkup(
      <FulfillmentCockpit {...COCKPIT_BASE} ammo={getAmmoById("meetup-social-v1")} />,
    );
    expect(mu).toContain('data-theme="meetup"');
    const cp = renderToStaticMarkup(
      <FulfillmentCockpit {...COCKPIT_BASE} ammo={getAmmoById("companion-v1")} />,
    );
    expect(cp).toContain('data-theme="companion"');
  });

  it("dynamic 场景：随弹药 theme 精准挂载（tech 弹药 → data-theme=\"tech\"）", () => {
    const tech = buildProbeAmmo("tech");
    const html = renderToStaticMarkup(
      <FulfillmentCockpit {...COCKPIT_BASE} ammo={tech} />,
    );
    expect(html).toContain('data-theme="tech"');
  });

  it("dynamic 场景：未声明主题 → data-theme=\"default\"", () => {
    const naked = renderToStaticMarkup(
      <FulfillmentCockpit
        {...COCKPIT_BASE}
        ammo={buildProbeAmmo()}
      />,
    );
    expect(naked).toContain('data-theme="default"');
  });

  it("dynamic 场景：非法主题声明 → default 兜底，插槽 data-theme 同步归一", () => {
    const broken = buildProbeAmmo("cyber-pop");
    const html = renderToStaticMarkup(
      <FulfillmentCockpit {...COCKPIT_BASE} ammo={broken} />,
    );
    expect(html).toContain('data-theme="default"');
    expect(html).not.toContain('data-theme="theme-default"');
    expect(html).not.toContain('data-theme="cyber-pop"');
  });

  it("resolveCockpitTheme 纯函数：制式直映 + dynamic 弹药投影 + 兜底", () => {
    expect(resolveCockpitTheme("housekeeping")).toBe("housekeeping");
    expect(resolveCockpitTheme("meetup")).toBe("meetup");
    expect(resolveCockpitTheme("companion")).toBe("companion");
    expect(resolveCockpitTheme("dynamic", buildProbeAmmo("meetup"))).toBe("meetup");
    expect(resolveCockpitTheme("dynamic", buildProbeAmmo("tech"))).toBe("tech");
    expect(resolveCockpitTheme("dynamic")).toBe("default");
    expect(resolveCockpitTheme("dynamic", buildProbeAmmo("bogus"))).toBe("default");
  });

  it("SCENARIO_THEME_META 展示令牌不受 data-theme 键改造影响", () => {
    expect(SCENARIO_THEME_META.housekeeping.themeClass).toBe("theme-housekeeping");
    expect(SCENARIO_THEME_META.dynamic.accent).toBe("#00f0ff");
  });
});

describe("DynamicAmmoSlot 插槽 · data-theme 纯键与传统 theme-* 前缀的隔离", () => {
  it("tech 弹药插槽 data-theme 为纯键 tech（无 theme- 前缀残留）", () => {
    const tech = buildProbeAmmo("tech");
    const html = renderToStaticMarkup(
      <DynamicAmmoSlot ammo={tech} />,
    );
    expect(html).toContain('data-theme="tech"');
    expect(html).not.toContain('data-theme="theme-tech"');
    expect(html).not.toContain('data-theme="theme-default"');
  });

  it("插槽缺省主题 → data-theme=\"default\"", () => {
    const html = renderToStaticMarkup(
      <DynamicAmmoSlot ammo={buildProbeAmmo()} />,
    );
    expect(html).toContain('data-theme="default"');
  });
});

describe("红线 6 · 外骨骼零侵入（主题 Token 仅限定视口容器）", () => {
  it("StatusCapsule 顶栏无 data-theme 属性", () => {
    const html = renderToStaticMarkup(
      <StatusCapsule status="IN_SERVICE" options={{ isOffline: false, distanceMeters: 380 }} />,
    );
    expect(html).not.toContain("data-theme");
  });

  it("FloatingDock 底栏无 data-theme 属性", () => {
    const html = renderToStaticMarkup(<FloatingDock />);
    expect(html).not.toContain("data-theme");
  });

  it("座舱根容器 data-theme 仅挂载在视口容器，外骨骼 StatusCapsule 子节点无侵入", () => {
    const html = renderToStaticMarkup(<FulfillmentCockpit {...COCKPIT_BASE} />);
    const capsuleFrag = html.slice(html.indexOf('class="cockpit-capsule"'));
    expect(capsuleFrag).not.toContain('data-theme="');
    expect(html).toContain('data-theme="housekeeping"');
  });
});

describe("FloatingDock 渲染环境配套（matchMedia polyfill 于文件级 beforeAll）", () => {
  it("FloatingDock 渲染输出正常（深空中性外骨骼存活）", () => {
    const html = renderToStaticMarkup(<FloatingDock />);
    expect(html).toContain("首页");
    expect(html).toContain("行程");
  });
});