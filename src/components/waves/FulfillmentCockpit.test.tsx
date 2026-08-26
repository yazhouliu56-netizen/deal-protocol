// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import FulfillmentCockpit, {
  describeCompletionCta,
  SCENARIO_THEME_META,
  sixDimensionScores,
  describeCustomRequirementTags,
  ENHANCED_SAFETY_BADGE_DEFAULT,
  type FulfillmentCockpitProps,
} from "@/components/waves/FulfillmentCockpit";
import { getAmmoById } from "@/ammo/registry";
import { registerDynamicAmmo } from "@/ammo/factory";
import { DEFAULT_FUZE_POLICY } from "@/types/fuze-policy";
import type { IHolographicAmmoConfig, IAmmoDefinition } from "@/types/ammo-schema";

/* 战役 4 · 弹药驱动座舱：ammo 为唯一数据源（官方三弹自 registry 取整弹） */
const HK_AMMO: IAmmoDefinition = getAmmoById("housekeeping-v1");
const MEETUP_AMMO: IAmmoDefinition = getAmmoById("meetup-social-v1");
const COMPANION_AMMO: IAmmoDefinition = getAmmoById("companion-v1");

const BASE_PROPS: FulfillmentCockpitProps = {
  status: "IN_SERVICE",
  ammo: HK_AMMO,
  provider: { avatar: "🧹", name: "王姐", verified: true, trustScore: 86 },
};

function renderStatic(props: FulfillmentCockpitProps): string {
  return renderToStaticMarkup(<FulfillmentCockpit {...props} />);
}

/** jsdom 挂载渲染并触发 data-action 按钮点击。 */
async function clickAction(
  props: FulfillmentCockpitProps,
  action: string,
): Promise<void> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<FulfillmentCockpit {...props} />);
  });
  const btn = container.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  expect(btn).not.toBeNull();
  await act(async () => {
    btn!.click();
  });
  root.unmount();
  container.remove();
}

describe("FulfillmentCockpit 通用五态履约主屏", () => {
  it("家政场景：清洁蓝主题 + 增项改价卡 + Before/After 双拍池 + NFC 核销 CTA", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      actions: {
        quote: { item: "深度除螨", amountYuan: 80, confirmed: false },
        photos: { before: "/p1.jpg", after: "/p2.jpg" },
        onClaimDamage: () => {},
      },
    });
    expect(html).toContain('data-scenario="housekeeping"');
    expect(html).toContain('data-theme="housekeeping"');
    expect(html).toContain("清洁蓝");
    expect(html).toContain("现场增项：深度除螨");
    expect(html).toContain("+¥80");
    expect(html).toContain("确认增项");
    expect(html).toContain('alt="服务前照片"');
    expect(html).toContain('alt="服务后照片"');
    expect(html).toContain("✅ 双拍验真已通过");
    expect(html).toContain("🛡️ 损坏包赔 · 财产险理赔直连");
    expect(html).toContain(describeCompletionCta("housekeeping"));
    expect(html).toContain("碰一碰 NFC");
  });

  it("组局场景：活力橙主题 + 座次表 + 500m 围栏 + AA 分摊 + 组织者解冻 CTA", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      ammo: MEETUP_AMMO,
      actions: {
        seats: [
          { id: "a", name: "小美", arrived: true },
          { id: "b", name: "阿凯", arrived: false },
        ],
        fenceMeters: 500,
        onScanArrival: () => {},
        split: {
          totalYuan: 240,
          entries: [
            { party: "小美", deltaYuan: -40 },
            { party: "阿凯", deltaYuan: 80 },
          ],
        },
        onDisputeNoShow: () => {},
      },
    });
    expect(html).toContain('data-theme="meetup"');
    expect(html).toContain("活力橙");
    expect(html).toContain("实时座次表 · 1/2 已到场");
    expect(html).toContain('data-arrived="1"');
    expect(html).toContain("签到围栏 500m");
    expect(html).toContain("扫码到场");
    expect(html).toContain("AA 分摊对账 · 合计 ¥240");
    expect(html).toContain("补缴 +¥80");
    expect(html).toContain("退还 ¥40");
    expect(html).toContain("放鸽子申诉");
    expect(html).toContain(describeCompletionCta("meetup"));
    expect(html).toContain("组织者点选到场成员");
  });

  it("陪玩场景：夜幕紫主题 + 隐私盾 + 伪装假电话 + 300m 距离 + 脱离自动完成 CTA", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      ammo: COMPANION_AMMO,
      actions: {
        isPrivacyShieldArmed: true,
        departureDistanceMeters: 300,
        onTriggerFakeCall: () => {},
        onBlockUser: () => {},
      },
    });
    expect(html).toContain('data-theme="companion"');
    expect(html).toContain("夜幕紫");
    expect(html).toContain("🛡️ 隐私防骚扰盾");
    expect(html).toContain("虚拟号保护中 · 行程守护");
    expect(html).toContain("📱 伪装假电话 · 紧急脱身");
    expect(html).toContain("安全距离 300m");
    expect(html).toContain("超出自动停表/结账");
    expect(html).toContain("🚫 敏感词一键拉黑");
    expect(html).toContain(describeCompletionCta("companion"));
    expect(html).toContain("300m 脱离自动完成");
  });

  it("外骨骼顶栏：StatusCapsule 集成五态标签 + LBS 距离 + 离线徽标 + SOS", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      status: "IN_SERVICE",
      capsule: { isOffline: true, distanceMeters: 380, onSosClick: () => {} },
    });
    expect(html).toContain("履约保护中 · GPS锁定");
    expect(html).toContain("距服务者 380m");
    expect(html).toContain("📴 离线");
    expect(html).toContain('aria-label="SOS 紧急求助"');
  });

  it("服务者通用卡片：实名徽章 + 六维信用分 + 虚拟通话/隐私聊天按钮", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      provider: { avatar: "🧹", name: "王姐", verified: true, trustScore: 86 },
    });
    expect(html).toContain("王姐");
    expect(html).toContain("✓ 实名");
    expect(html).toContain("信用 86 分");
    expect(html).toContain('aria-label="一键虚拟通话"');
    expect(html).toContain('aria-label="隐私聊天"');
    const dims = sixDimensionScores(86);
    expect(dims).toHaveLength(6);
    expect(dims.map((d) => d.label)).toEqual(["守时", "专业", "礼貌", "沟通", "诚信", "复购"]);
  });

  it("sixDimensionScores 信用分拆分为 6 维且钳制在 0-100", () => {
    const dims = sixDimensionScores(100);
    expect(dims).toHaveLength(6);
    for (const d of dims) {
      expect(d.value).toBeGreaterThanOrEqual(0);
      expect(d.value).toBeLessThanOrEqual(100);
    }
  });

  it("SCENARIO_THEME_META 三场景主题令牌完备", () => {
    expect(SCENARIO_THEME_META.housekeeping.accent).toBe("#3884ff");
    expect(SCENARIO_THEME_META.meetup.accent).toBe("#f97316");
    expect(SCENARIO_THEME_META.companion.accent).toBe("#a78bfa");
  });

  it("D8 动态场景：SCENARIO_THEME_META.dynamic 令牌与 CTA 文案", () => {
    expect(SCENARIO_THEME_META.dynamic.themeClass).toBe("theme-dynamic");
    expect(describeCompletionCta("dynamic")).toContain("按弹药契约核销");
  });
});

/** 长尾动态弹药测试装配（三引信并联 + 水印相机传感 + formSchema）。 */
function buildLongtailConfig(): IHolographicAmmoConfig {
  return {
    ammoId: "longtail-farm-v1",
    category: "LONGTAIL_FARM",
    version: "1.0.0",
    supplyCluster: "C1_MOBILITY",
    pricingModel: { kind: "FIXED", amountYuan: 500 },
    fuzePolicy: {
      ...DEFAULT_FUZE_POLICY,
      fuzeId: "fuze-longtail",
      fuzeTypes: ["IMPACT", "DELAY", "PROXIMITY"],
      propertyInsurance: true,
      deposit: { strategy: "RATIO", ratio: 0.2 },
      advanceFreeze: { enabled: true, ratio: 0.3 },
      geoFence: { enabled: true, radiusM: 800, unlockOnArrival: true },
      privacy: {
        virtualNumber: true,
        blurLocation: true,
        sensitiveWordIntervention: true,
      },
      sos: {
        enabled: true,
        autoLocationReport: true,
        autoEvidenceAppend: true,
        notifyEmergencyContacts: true,
      },
    },
    requiredSensors: ["GPS_GEOFENCE", "WATERMARK_CAMERA"],
    forwardHooks: [],
    theme: "default",
    formSchema: {
      fields: [
        { key: "fieldAreaMu", label: "作业亩数", type: "number", required: true },
        {
          key: "pesticideType",
          label: "农药类型",
          type: "picker",
          options: ["除草剂", "杀菌剂"],
          defaultValue: "除草剂",
        },
      ],
    },
  };
}

describe("FulfillmentCockpit D8 动态弹药插槽", () => {
  it("dynamic 场景：DynamicAmmoSlot 渲染参数快照 + 水印打卡区 + 引信徽标 + 申诉入口", () => {
    const reg = registerDynamicAmmo(buildLongtailConfig());
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    const html = renderStatic({
      ...BASE_PROPS,
      ammo: reg.ammo,
      actions: {
        bizParams: { fieldAreaMu: 50, pesticideType: "除草剂" },
        evidencePhotos: { before: "/b.jpg", after: null },
        onUploadProof: () => {},
        onActionClick: () => {},
      },
    });
    expect(html).toContain('data-scenario="dynamic"');
    expect(html).toContain('data-theme="default"');
    expect(html).toContain("自适应 · 长尾动态弹药");
    expect(html).toContain('data-slot="dynamic-ammo"');
    expect(html).toContain("动态履约 · LONGTAIL_FARM");
    // 动态参数快照（订单固化 bizParams 结构化展示）
    expect(html).toContain('data-param="fieldAreaMu"');
    expect(html).toContain(">50<");
    expect(html).toContain('data-param="pesticideType"');
    expect(html).toContain("除草剂");
    // WATERMARK_CAMERA 传感声明 → Before/After 打卡区（before 已拍 / after 待拍）
    expect(html).toContain('data-testid="dyn-proof"');
    expect(html).toContain('alt="存证 Before 照片"');
    expect(html).toContain('data-action="proof-after"');
    expect(html).toContain("⚠️ 完成 Before/After 双拍后按弹药契约核销");
    // 三引信并联徽标投影（🛡️财产险 / ⏳预付冻结 / 📞虚拟号）
    expect(html).toContain("🛡️财产险");
    expect(html).toContain("🔒定金托管");
    expect(html).toContain("⏳预付冻结");
    expect(html).toContain("📍LBS围栏 800m");
    expect(html).toContain("📞虚拟号");
    expect(html).toContain("🆘SOS联动");
    // 标准申诉入口 + 底部核销 CTA
    expect(html).toContain("⚖️ 申请调解 / 申诉");
    expect(html).toContain(describeCompletionCta("dynamic"));
  });

  it("dynamic 空载荷：宿主仍装配通用插槽（零白屏）+ 核销 CTA", () => {
    const bareAmmo: IAmmoDefinition = {
      ammoId: "bare-longtail-v1",
      category: "BARE_LONGTAIL",
      version: "1.0.0",
      fiveStateHooks: [],
      pricingModel: { kind: "FIXED", amountYuan: 100 },
      fuzePolicy: DEFAULT_FUZE_POLICY,
      dispatchRule: undefined as never,
      sop: {},
      holographic: {
        ammoId: "bare-longtail-v1",
        category: "BARE_LONGTAIL",
        version: "1.0.0",
        supplyCluster: "C1_MOBILITY",
        pricingModel: { kind: "FIXED", amountYuan: 100 },
        fuzePolicy: DEFAULT_FUZE_POLICY,
        forwardHooks: [],
        theme: "default",
      },
    };
    const html = renderStatic({ ...BASE_PROPS, ammo: bareAmmo });
    expect(html).toContain('data-slot="dynamic-ammo"');
    expect(html).toContain('data-theme="default"');
    expect(html).toContain("场景主题");
    expect(html).toContain('data-action="complete"');
  });

  it("dynamic 插槽：申诉按钮触发 onActionClick('dispute')", async () => {
    const action = vi.fn();
    const reg = registerDynamicAmmo(buildLongtailConfig());
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    await clickAction(
      {
        ...BASE_PROPS,
        ammo: reg.ammo,
        actions: { onActionClick: action },
      },
      "dispute",
    );
    expect(action).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledWith("dispute");
  });

  it("dynamic 插槽：拍照打卡按钮打开水印相机模态（P0-3 全链）", async () => {
    const proof = vi.fn();
    const reg = registerDynamicAmmo(buildLongtailConfig());
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FulfillmentCockpit
          {...BASE_PROPS}
          ammo={reg.ammo}
          actions={{ onUploadProof: proof }}
        />,
      );
    });
    const btn = container.querySelector<HTMLButtonElement>('button[data-action="proof-after"]');
    expect(btn).not.toBeNull();
    await act(async () => {
      btn!.click();
    });
    expect(container.querySelector('[data-testid="dyn-proof-modal"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="proof-camera"]')).not.toBeNull();
    // 拍照入口为 ProofCamera 模态，旧 onUploadProof 不再立即触发（待 ProofCamera onCaptured 结构化回传）
    expect(proof).not.toHaveBeenCalled();
    root.unmount();
    container.remove();
  });
});

describe("FulfillmentCockpit 事件回调", () => {
  it("陪玩：点击伪装假电话触发 onTriggerFakeCall", async () => {
    const fakeCall = vi.fn();
    await clickAction(
      {
        ...BASE_PROPS,
        ammo: COMPANION_AMMO,
        actions: { isPrivacyShieldArmed: true, onTriggerFakeCall: fakeCall },
      },
      "fake-call",
    );
    expect(fakeCall).toHaveBeenCalledTimes(1);
  });

  it("家政：点击确认增项触发 onAcceptQuote（OnsiteQuoteHook 放行）", async () => {
    const acceptQuote = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FulfillmentCockpit
          {...BASE_PROPS}
          actions={{
            quote: { item: "深度除螨", amountYuan: 80, confirmed: false },
            onAcceptQuote: acceptQuote,
          }}
        />,
      );
    });
    const btns = [...container.querySelectorAll("button")];
    const accept = btns.find((b) => b.textContent?.includes("确认增项"));
    expect(accept).toBeDefined();
    await act(async () => {
      accept!.click();
    });
    expect(acceptQuote).toHaveBeenCalledTimes(1);
    root.unmount();
    container.remove();
  });

  it("组局：点击确认分摊触发 onConfirmSplit（AASplitSettleHook 确认态）", async () => {
    const confirmSplit = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FulfillmentCockpit
          {...BASE_PROPS}
          ammo={MEETUP_AMMO}
          actions={{
            seats: [{ id: "a", name: "小美", arrived: true }],
            split: { totalYuan: 100, entries: [{ party: "小美", deltaYuan: -10 }] },
            onConfirmSplit: confirmSplit,
          }}
        />,
      );
    });
    const btns = [...container.querySelectorAll("button")];
    const confirm = btns.find((b) => b.textContent?.includes("确认分摊"));
    expect(confirm).toBeDefined();
    await act(async () => {
      confirm!.click();
    });
    expect(confirmSplit).toHaveBeenCalledTimes(1);
    root.unmount();
    container.remove();
  });

  it("三场景：底部核销 CTA 点击触发 onComplete", async () => {
    const complete = vi.fn();
    await clickAction({ ...BASE_PROPS, onComplete: complete }, "complete");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("P0 接电：📞 一键虚拟通话触发 onDial", async () => {
    const dial = vi.fn();
    await clickAction({ ...BASE_PROPS, onDial: dial }, "dial");
    expect(dial).toHaveBeenCalledTimes(1);
  });

  it("P0 接电：💬 隐私聊天触发 onChat", async () => {
    const chat = vi.fn();
    await clickAction({ ...BASE_PROPS, onChat: chat }, "chat");
    expect(chat).toHaveBeenCalledTimes(1);
  });

  it("P0 接电：SOS 外骨骼胶囊点击触发 onSosClick", async () => {
    const sos = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <FulfillmentCockpit {...BASE_PROPS} capsule={{ onSosClick: sos }} />,
      );
    });
    const btn = container.querySelector<HTMLButtonElement>('button[aria-label="SOS 紧急求助"]');
    expect(btn).not.toBeNull();
    await act(async () => {
      btn!.click();
    });
    expect(sos).toHaveBeenCalledTimes(1);
    root.unmount();
    container.remove();
  });
});

/* =====================================================================
 * 阶段4：强化安全守护徽标 + 定制需求参数可视化
 * ===================================================================== */

const CUSTOM_MAID_2025: import("@/types/ammo-schema").INormalizedCustomIntent = {
  cleanText: "要求：指定工作着装(女仆主题) · 期望年龄: 20-25岁",
  isSensitiveCustomization: true,
  blockedReason: null,
  dressCode: { required: true, type: "THEMED_MAID", rawKeyword: "女仆装" },
  ageRange: [20, 25],
  genderPreference: "ANY",
};

describe("FulfillmentCockpit 阶段4 强化安全守护徽标", () => {
  it("forceArmed=true：渲染强化安全守护条（默认文案 + 三强制副标 + data 标记）", () => {
    const html = renderStatic({ ...BASE_PROPS, forceArmed: true });
    expect(html).toContain('data-force-armed="true"');
    expect(html).toContain('data-testid="cockpit-armed-banner"');
    expect(html).toContain(ENHANCED_SAFETY_BADGE_DEFAULT);
    expect(html).toContain("虚拟号 · 行程守护 · 敏感词监听 已强制开启");
  });

  it("forceArmed=true + safetyBadge：引擎权威文案优先于默认常量", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      forceArmed: true,
      safetyBadge: "🛡️ 强化安全守护中（虚拟号+实时存证）",
    });
    expect(html).toContain("🛡️ 强化安全守护中（虚拟号+实时存证）");
    expect(html).not.toContain("敏感词实时监听）");
  });

  it("forceArmed=false：不渲染强化守护条（标准回退，布局零变化）", () => {
    const html = renderStatic({ ...BASE_PROPS });
    expect(html).not.toContain('data-force-armed="true"');
    expect(html).not.toContain("强化安全守护中");
    expect(html).toContain('data-action="complete"');
  });
});

describe("FulfillmentCockpit 阶段4 定制需求参数可视化", () => {
  it("customRequirements 存在：座舱渲染中性化定制标签（工作着装 + 期望年龄）", () => {
    const html = renderStatic({ ...BASE_PROPS, customRequirements: CUSTOM_MAID_2025 });
    expect(html).toContain('data-testid="cockpit-custom-requirements"');
    expect(html).toContain("[工作着装: 女仆主题]");
    expect(html).toContain("[期望年龄: 20-25岁]");
    expect(html).not.toContain("女仆装");
  });

  it("customRequirements 透传至家政插槽（hk-custom-requirements 标签区）", () => {
    const html = renderStatic({
      ...BASE_PROPS,
      customRequirements: CUSTOM_MAID_2025,
      actions: { photos: { before: null, after: null } },
    });
    expect(html).toContain('data-testid="hk-custom-requirements"');
    expect(html).toContain("[期望年龄: 20-25岁]");
  });

  it("customRequirements 透传至动态插槽（dyn-custom-requirements 标签区）", () => {
    const reg = registerDynamicAmmo(buildLongtailConfig());
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    const html = renderStatic({
      ...BASE_PROPS,
      ammo: reg.ammo,
      customRequirements: CUSTOM_MAID_2025,
    });
    expect(html).toContain('data-testid="dyn-custom-requirements"');
    expect(html).toContain("[工作着装: 女仆主题]");
    expect(html).toContain("[期望年龄: 20-25岁]");
  });

  it("无定制需求：零标签渲染，参数快照保持既有紧凑布局（标准回退）", () => {
    const html = renderStatic({ ...BASE_PROPS });
    expect(html).not.toContain('data-custom-requirements');
    expect(html).not.toContain("[工作着装:");
    expect(html).not.toContain("[期望年龄:");
    expect(html).not.toContain("期望年龄");
  });

  it("describeCustomRequirementTags 纯函数：结构化投影 + 无定制空数组", () => {
    expect(describeCustomRequirementTags(CUSTOM_MAID_2025)).toEqual([
      "[工作着装: 女仆主题]",
      "[期望年龄: 20-25岁]",
    ]);
    expect(describeCustomRequirementTags(undefined)).toEqual([]);
    expect(
      describeCustomRequirementTags({
        ...CUSTOM_MAID_2025,
        genderPreference: "FEMALE",
      }),
    ).toContain("[性别偏好: 女性]");
    expect(
      describeCustomRequirementTags({
        cleanText: "",
        isSensitiveCustomization: false,
        blockedReason: null,
      }),
    ).toEqual([]);
  });
});
