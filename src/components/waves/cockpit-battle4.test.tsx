// @vitest-environment jsdom
/**
 * Microkernel 2.0 战役 4 · Step 0 TDD 锁相考卷。
 *
 * 在座舱 Schema 化动刀【之前】捕获四大标杆弹药座舱物理指纹：
 * 场景主题标签 / 核销 CTA 文案 / 插槽 DOM 锚点（data-slot·data-testid·data-action）
 * / 关键交互文案 / 场景解析纯函数行为——重构后本考卷必须逐字通过，
 * 即「锚点层级 + 交互文案 + 行为守恒」零漂移的物理证据。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import FulfillmentCockpit, {
  SCENARIO_THEME_META,
  describeCompletionCta,
  resolveCockpitTheme,
} from "@/components/waves/FulfillmentCockpit";
import {
  describeCtaForState,
  needsCockpit,
  nextCockpitState,
} from "@/components/waves/FulfillmentCenter";
import {
  COCKPIT_SLOT_SCENARIO,
  resolveCockpitScenario,
} from "@/components/waves/slots/cockpit-scenario";
import type { IAmmoDefinition } from "@/types/ammo-schema";
import { DEFAULT_FUZE_POLICY } from "@/types/fuze-policy";

/* ── 测试弹药工厂 ─────────────────────────────────────────────── */

function mkAmmo(ammoId: string, category: string, theme?: string): IAmmoDefinition {
  return {
    ammoId,
    category,
    version: "1.0.0",
    fiveStateHooks: [],
    pricingModel: { kind: "FIXED", amountYuan: 100 },
    fuzePolicy: DEFAULT_FUZE_POLICY,
    dispatchRule: undefined as never,
    sop: {},
    holographic: {
      ammoId,
      category,
      version: "1.0.0",
      supplyCluster: "C2_IN_HOME",
      pricingModel: { kind: "FIXED", amountYuan: 100 },
      fuzePolicy: DEFAULT_FUZE_POLICY,
      forwardHooks: [],
      ...(theme ? { theme: theme as import("@/types/ui-viewport").ScenarioTheme } : {}),
    },
  };
}

const HK_AMMO = mkAmmo("housekeeping-v1", "housekeeping", "housekeeping");
const MEETUP_AMMO = mkAmmo("meetup-social-v1", "meetup", "meetup");
const COMPANION_AMMO = mkAmmo("companion-v1", "companion", "companion");
const DRONE_AMMO: IAmmoDefinition = {
  ...mkAmmo("drone-crop-spray-v1", "DRONE_CROP_SPRAY"),
  holographic: {
    ...mkAmmo("drone-crop-spray-v1", "DRONE_CROP_SPRAY").holographic!,
    cockpitSlot: "HousekeepingSlot",
    formSchema: { fields: [{ key: "fieldAreaMu", type: "number", required: true }] },
  },
};

const BASE_PROPS = {
  status: "IN_SERVICE" as const,
  provider: { avatar: "🧑‍🔧", name: "师傅", verified: true, trustScore: 88 },
};

/* ── ① 场景主题与核销 CTA 指纹 ─────────────────────────────────── */

describe("Step0 锁相：场景主题元数据与核销 CTA 文案", () => {
  it("SCENARIO_THEME_META 四场景主题标签守恒", () => {
    expect(SCENARIO_THEME_META.housekeeping.label).toBe("清洁蓝 · 重入户");
    expect(SCENARIO_THEME_META.meetup.label).toBe("活力橙 · 轻履约");
    expect(SCENARIO_THEME_META.companion.label).toBe("夜幕紫 · 高人身风险");
    expect(SCENARIO_THEME_META.dynamic.label).toBe("自适应 · 长尾动态弹药");
  });

  it("describeCompletionCta 四场景完工动作文案守恒", () => {
    expect(describeCompletionCta("housekeeping")).toBe("🤝 双方碰一碰 NFC · 验收清单打钩");
    expect(describeCompletionCta("meetup")).toBe("🛡️ 组织者点选到场成员 · 解冻定金");
    expect(describeCompletionCta("companion")).toBe("📡 300m 脱离自动完成 · 或手动确认");
    expect(describeCompletionCta("dynamic")).toBe("✳️ 按弹药契约核销 · 或手动确认");
  });

  it("resolveCockpitTheme：制式直映 + dynamic 按弹药 holographic.theme 归一", () => {
    expect(resolveCockpitTheme("housekeeping")).toBe("housekeeping");
    expect(resolveCockpitTheme("meetup")).toBe("meetup");
    expect(resolveCockpitTheme("companion")).toBe("companion");
    expect(resolveCockpitTheme("dynamic")).toBe("default");
    expect(resolveCockpitTheme("dynamic", DRONE_AMMO)).toBe("default");
  });
});

/* ── ② 家政座舱 DOM 指纹 ──────────────────────────────────────── */

describe("Step0 锁相：housekeeping 座舱 DOM 指纹", () => {
  const html = renderToStaticMarkup(
    <FulfillmentCockpit
      {...BASE_PROPS}
      ammo={HK_AMMO}
      actions={{
        quote: { item: "深度除螨", amountYuan: 80, confirmed: false },
        photos: { before: null, after: null },
        onAcceptQuote: () => {},
        onRejectQuote: () => {},
        baseAmountYuan: 1000,
        maxSurchargeRatio: 0.5,
      }}
      onComplete={() => {}}
    />,
  );

  it("外骨骼锚点：scenario/theme 属性 + 主题标签 + 核销 CTA", () => {
    expect(html).toContain('data-scenario="housekeeping"');
    expect(html).toContain('data-theme="housekeeping"');
    expect(html).toContain("清洁蓝 · 重入户");
    expect(html).toContain("双方碰一碰 NFC · 验收清单打钩");
    expect(html).toContain('data-action="complete"');
  });

  it("插槽锚点：hk-photos / hk-proof-status / 增项卡 / 加价上限条", () => {
    expect(html).toContain('data-slot="housekeeping"');
    expect(html).toContain('data-testid="hk-photos"');
    expect(html).toContain('data-testid="hk-proof-status"');
    expect(html).toContain('data-action="hk-proof-before"');
    expect(html).toContain('data-action="hk-proof-after"');
    expect(html).toContain("拍照打卡");
    expect(html).toContain("现场增项：深度除螨");
    expect(html).toContain("确认增项");
    expect(html).toContain("拒绝");
    expect(html).toContain("防坐地起价");
    expect(html).toContain("现场加价上限为订单基础金额的 50%");
  });
});

/* ── ③ 组局座舱 DOM 指纹 ──────────────────────────────────────── */

describe("Step0 锁相：meetup 座舱 DOM 指纹", () => {
  const html = renderToStaticMarkup(
    <FulfillmentCockpit
      {...BASE_PROPS}
      ammo={MEETUP_AMMO}
      actions={{
        seats: [
          { id: "s1", name: "发起人", arrived: true },
          { id: "s2", name: "队友 A", arrived: false },
        ],
        fenceMeters: 500,
        onScanArrival: () => {},
        split: { entries: [{ party: "发起人", deltaYuan: -20 }], totalYuan: 80 },
        onConfirmSplit: () => {},
        onDisputeNoShow: () => {},
      }}
      onComplete={() => {}}
    />,
  );

  it("外骨骼锚点 + 座次表 + 围栏签到", () => {
    expect(html).toContain('data-scenario="meetup"');
    expect(html).toContain('data-theme="meetup"');
    expect(html).toContain("活力橙 · 轻履约");
    expect(html).toContain("组织者点选到场成员 · 解冻定金");
    expect(html).toContain('data-slot="meetup"');
    expect(html).toContain("实时座次表 · 1/2 已到场");
    expect(html).toContain('data-arrived="1"');
    expect(html).toContain("📍 签到围栏 500m · 扫码验真解锁定金");
    expect(html).toContain("📷 扫码到场");
  });

  it("AA 分摊对账 + 放鸽子申诉", () => {
    expect(html).toContain("AA 分摊对账 · 合计 ¥80");
    expect(html).toContain("退还 ¥20");
    expect(html).toContain("✓ 确认分摊");
    expect(html).toContain("🐦 放鸽子申诉（爽约押金判归守约方）");
  });
});

/* ── ④ 陪玩座舱 DOM 指纹 ──────────────────────────────────────── */

describe("Step0 锁相：companion 座舱 DOM 指纹", () => {
  const html = renderToStaticMarkup(
    <FulfillmentCockpit
      {...BASE_PROPS}
      ammo={COMPANION_AMMO}
      actions={{
        isPrivacyShieldArmed: true,
        onTriggerFakeCall: () => {},
        departureDistanceMeters: 300,
        onBlockUser: () => {},
      }}
      onComplete={() => {}}
    />,
  );

  it("隐私盾 + 伪装假电话 + 安全距离 + 一键拉黑", () => {
    expect(html).toContain('data-scenario="companion"');
    expect(html).toContain('data-theme="companion"');
    expect(html).toContain("夜幕紫 · 高人身风险");
    expect(html).toContain("300m 脱离自动完成 · 或手动确认");
    expect(html).toContain('data-slot="companion"');
    expect(html).toContain("🛡️ 隐私防骚扰盾");
    expect(html).toContain("虚拟号保护中 · 行程守护");
    expect(html).toContain('data-action="fake-call"');
    expect(html).toContain("📱 伪装假电话 · 紧急脱身");
    expect(html).toContain("📡 安全距离 300m");
    expect(html).toContain("超出自动停表/结账");
    expect(html).toContain('data-action="block-user"');
    expect(html).toContain("🚫 敏感词一键拉黑");
  });
});

/* ── ⑤ 动态弹药座舱 DOM 指纹 ─────────────────────────────────── */

describe("Step0 锁相：dynamic 座舱 DOM 指纹（长尾弹药通用视口）", () => {
  const html = renderToStaticMarkup(
    <FulfillmentCockpit
      {...BASE_PROPS}
      ammo={DRONE_AMMO}
      actions={{ bizParams: { fieldAreaMu: 50 } }}
      onComplete={() => {}}
    />,
  );

  it("动态插槽锚点：参数快照 + 申诉入口", () => {
    expect(html).toContain('data-scenario="dynamic"');
    expect(html).toContain("自适应 · 长尾动态弹药");
    expect(html).toContain('data-slot="dynamic-ammo"');
    expect(html).toContain('data-testid="dyn-params"');
    expect(html).toContain('data-param="fieldAreaMu"');
    expect(html).toContain('data-action="dispute"');
    expect(html).toContain("⚖️ 申请调解 / 申诉");
  });

  it("未声明 WATERMARK_CAMERA → 不渲染双拍打卡区", () => {
    expect(html).not.toContain('data-testid="dyn-proof"');
  });

  it("声明 WATERMARK_CAMERA → 双拍打卡区激活（Before/After 锚点）", () => {
    const camAmmo: IAmmoDefinition = {
      ...DRONE_AMMO,
      holographic: {
        ...DRONE_AMMO.holographic!,
        requiredSensors: ["GPS_GEOFENCE", "WATERMARK_CAMERA"],
      },
    };
    const withCam = renderToStaticMarkup(
      <FulfillmentCockpit
        {...BASE_PROPS}
        ammo={camAmmo}
        onComplete={() => {}}
      />,
    );
    expect(withCam).toContain('data-testid="dyn-proof"');
    expect(withCam).toContain('data-action="proof-before"');
    expect(withCam).toContain('data-action="proof-after"');
    expect(withCam).toContain('data-testid="dyn-proof-status"');
  });
});

/* ── ⑥ 场景解析纯函数指纹（FulfillmentCenter）────────────────── */

describe("Step0 锁相：resolveCockpitScenario 场景解析守恒", () => {
  it("COCKPIT_SLOT_SCENARIO 特化插槽键映射", () => {
    expect(COCKPIT_SLOT_SCENARIO).toEqual({
      HousekeepingSlot: "housekeeping",
      MeetupSlot: "meetup",
      CompanionSlot: "companion",
    });
  });

  it("官方三弹 ammoId 直映制式场景", () => {
    expect(resolveCockpitScenario({ ammoId: "housekeeping-v1", basics: { category: "x" } })).toBe("housekeeping");
    expect(resolveCockpitScenario({ ammoId: "meetup-social-v1", basics: { category: "x" } })).toBe("meetup");
    expect(resolveCockpitScenario({ ammoId: "companion-v1", basics: { category: "x" } })).toBe("companion");
  });

  it("cockpitSlot 声明优先仅对注册池内弹药生效；未注册弹回落 dynamic", () => {
    // drone-crop-spray-v1 未在官方/动态池注册 → getAmmoById 回落默认弹（无
    // cockpitSlot）→ 中文正则不命中 → dynamic 兜底（现状物理行为）。
    expect(resolveCockpitScenario({ ammoId: "drone-crop-spray-v1", basics: { category: "DRONE_CROP_SPRAY" } })).toBe("dynamic");
  });

  it("无 ammoId → 中文类目正则兜底；全不命中 → dynamic", () => {
    expect(resolveCockpitScenario({ basics: { category: "家政保洁" } })).toBe("housekeeping");
    expect(resolveCockpitScenario({ basics: { category: "羽毛球约局" } })).toBe("meetup");
    expect(resolveCockpitScenario({ basics: { category: "陪玩" } })).toBe("companion");
    expect(resolveCockpitScenario({ basics: { category: "宠物寄养" } })).toBe("dynamic");
  });
});

/* ── ⑦ 五态挂载与 CTA 态机指纹 ───────────────────────────────── */

describe("Step0 锁相：五态挂载与核销 CTA 态机", () => {
  it("needsCockpit 仅 MATCHED/IN_SERVICE/INSPECTED 挂载", () => {
    expect(needsCockpit("MATCHED")).toBe(true);
    expect(needsCockpit("IN_SERVICE")).toBe(true);
    expect(needsCockpit("INSPECTED")).toBe(true);
    expect(needsCockpit("SETTLED")).toBe(false);
    expect(needsCockpit(null)).toBe(false);
  });

  it("nextCockpitState 推进链 MATCHED→IN_SERVICE→INSPECTED→SETTLED", () => {
    expect(nextCockpitState("MATCHED")).toBe("IN_SERVICE");
    expect(nextCockpitState("IN_SERVICE")).toBe("INSPECTED");
    expect(nextCockpitState("INSPECTED")).toBe("SETTLED");
    expect(nextCockpitState("SETTLED")).toBe("SETTLED");
  });

  it("describeCtaForState 三态文案守恒", () => {
    expect(describeCtaForState("MATCHED")).toBe("🚀 开始履约 · 服务者已就位");
    expect(describeCtaForState("IN_SERVICE")).toBe("📱 双方碰一碰 / 扫码确认完工");
    expect(describeCtaForState("INSPECTED")).toBe("✅ 确认收款 · 完成结算");
  });
});
