import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DynamicDraftCard, {
  describeFormSchemaFields,
  describePricing,
  describeSafetyBadges,
  describeSopParams,
  resolveDraftThemeClass,
} from "@/components/waves/DynamicDraftCard";
import { registerDynamicAmmo } from "@/ammo/factory";
import { getAmmoDefinition } from "@/ammo/registry";
import { DEFAULT_FUZE_POLICY } from "@/types/fuze-policy";
import type { IHolographicAmmoConfig } from "@/types/ammo-schema";

describe("DynamicDraftCard 弹药驱动草稿卡", () => {
  it("保洁弹药（housekeeping-v1）：时薪计价 + 碰炸引信徽章 + SOP 默认参数", () => {
    const html = renderToStaticMarkup(<DynamicDraftCard category="housekeeping" />);
    expect(html).toContain('data-ammo="housekeeping-v1"');
    expect(html).toContain("housekeeping-v1");
    // HOURLY 计价：¥60/小时 × 2小时起
    expect(html).toContain("预估费用：¥60/小时 × 2小时起");
    // IMPACT 引信投影徽章
    expect(html).toContain("🛡️已投保财产险");
    expect(html).toContain("🔒定金托管 20%");
    // IMPACT 无近炸隐私（不应出现虚拟号徽章）
    expect(html).not.toContain("📞虚拟号保护");
    // SOP 默认参数行（depositRate 0.2 → 押金比例 20%）
    expect(html).toContain("押金比例 20%");
    expect(html).toContain("120 分钟内有效");
    expect(html).toContain("默认 1 人");
    expect(html).toContain("磋商上限 3 轮");
    // 标准化 CTA
    expect(html).toContain("扣动扳机·一键发布");
  });

  it("组局弹药（meetup）：人均计价 + 延期/近炸双引信徽章 + 拼位缓冲", () => {
    const html = renderToStaticMarkup(<DynamicDraftCard category="meetup" />);
    expect(html).toContain('data-ammo="meetup-social-v1"');
    // PER_SEAT 计价
    expect(html).toContain("预估费用：¥80/人 · 2人起（AA 均摊）");
    // DELAY 引信徽章
    expect(html).toContain("⏳预付冻结");
    expect(html).toContain("📍LBS围栏 500m");
    // PROXIMITY 引信徽章
    expect(html).toContain("📞虚拟号保护");
    expect(html).toContain("🆘SOS联动");
    // SOP：拼位缓冲 + 24h TTL + 4 人容量
    expect(html).toContain("拼位缓冲 1 席");
    expect(html).toContain("1440 分钟内有效");
    expect(html).toContain("默认 4 人");
  });

  it("未配置类目：默认保底弹药（零钩子/零徽章/基础参数占位）", () => {
    const html = renderToStaticMarkup(<DynamicDraftCard category="不存在品类" />);
    expect(html).toContain('data-ammo="default-ammo"');
    expect(html).toContain("基础要素按默认执行");
    // FIXED ¥0 保底计价
    expect(html).toContain("预估费用：¥0（一口价）");
    // 零防护：无安全徽章挂载（badge span 出现 0 次；CSS 常量含类名词不参与判定）
    expect((html.match(/class="draft-card-badge"/g) ?? []).length).toBe(0);
  });

  it("参数行可点击微调（onTweak 回调携带参数键）", () => {
    const tweaks: string[] = [];
    renderToStaticMarkup(
      <DynamicDraftCard
        category="meetup"
        onTweak={(key) => tweaks.push(key)}
      />,
    );
    // 渲染期不触发回调（回调仅绑定点击），至少验证参数行按钮存在
    expect(tweaks).toEqual([]);
    const html = renderToStaticMarkup(<DynamicDraftCard category="housekeeping" />);
    expect(html).toContain("data-param=");
  });

  it("describePricing / describeSafetyBadges / describeSopParams 纯函数语义", () => {
    const hk = getAmmoDefinition("housekeeping");
    const meetup = getAmmoDefinition("meetup");

    expect(describePricing(hk.pricingModel)).toContain("60/小时");
    expect(describePricing(meetup.pricingModel)).toContain("80/人");
    expect(describePricing({ kind: "FIXED", amountYuan: 199 })).toBe("预估费用：¥199（一口价）");
    expect(describePricing({ kind: "FORMULA", formulaId: "f1" })).toContain("按公式 f1 计价");

    const hkBadges = describeSafetyBadges(hk.fuzePolicy);
    expect(hkBadges).toContain("🛡️已投保财产险");
    expect(hkBadges).not.toContain("📞虚拟号保护");
    const meetupBadges = describeSafetyBadges(meetup.fuzePolicy);
    expect(meetupBadges).toContain("📞虚拟号保护");
    expect(meetupBadges).toContain("⏳预付冻结");

    expect(describeSopParams(hk).map((r) => r.key)).toContain("deposit");
    expect(describeSopParams(meetup).map((r) => r.key)).toContain("buff");
  });

  it("注入 ammo 覆盖优先于注册表解析（预览/测试注入点）", () => {
    const custom = getAmmoDefinition("housekeeping");
    const html = renderToStaticMarkup(
      <DynamicDraftCard category="unmapped" ammo={custom} />,
    );
    expect(html).toContain('data-ammo="housekeeping-v1"');
  });
});

/** D8 动态弹药草稿卡测试装配（formSchema 声明式驱动 + 默认主题）。 */
function buildDraftConfig(): IHolographicAmmoConfig {
  return {
    ammoId: "longtail-farm-v1",
    category: "LONGTAIL_FARM",
    version: "1.0.0",
    supplyCluster: "C1_MOBILITY",
    pricingModel: { kind: "FIXED", amountYuan: 500 },
    fuzePolicy: { ...DEFAULT_FUZE_POLICY, fuzeId: "fuze-longtail" },
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
        { key: "cropKind", label: "作物", type: "text" },
      ],
    },
  };
}

describe("DynamicDraftCard D8 动态扩展字段（formSchema 声明式驱动）", () => {
  it("含 formSchema 的弹药：渲染扩展字段行（必填星标/选项提示/默认值）", () => {
    const reg = registerDynamicAmmo(buildDraftConfig());
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    const html = renderToStaticMarkup(
      <DynamicDraftCard category="LONGTAIL_FARM" ammo={reg.ammo} />,
    );
    expect(html).toContain('data-testid="draft-form-fields"');
    // 数值必填字段：星标 + 无默认 → 待填写占位
    expect(html).toContain('data-field="fieldAreaMu"');
    expect(html).toContain("作业亩数");
    expect(html).toContain('class="draft-card-required"');
    expect(html).toContain("待填写");
    // 选项字段：默认值 + 选项提示
    expect(html).toContain('data-field="pesticideType"');
    expect(html).toContain("农药类型");
    expect(html).toContain("[除草剂/杀菌剂]");
    expect(html).toContain(">除草剂<");
    // 文本字段
    expect(html).toContain('data-field="cropKind"');
    // 主题类：default 安全回落
    expect(html).toContain('class="draft-card draft-default"');
  });

  it("未声明 formSchema 的制式弹药：不渲染扩展字段区（渲染回归保护）", () => {
    const html = renderToStaticMarkup(<DynamicDraftCard category="housekeeping" />);
    expect(html).not.toContain('data-testid="draft-form-fields"');
    expect(html).toContain('data-ammo="housekeeping-v1"');
    // 制式弹药自带主题声明（theme: housekeeping）→ 相应主题类
    expect(html).toContain('class="draft-card draft-housekeeping"');
  });

  it("弹药主题令牌 → 草稿卡主题类（D8 视觉微氛围）", () => {
    const themed = registerDynamicAmmo({
      ...buildDraftConfig(),
      ammoId: "themed-farm-v1",
      category: "THEMED_FARM",
      theme: "housekeeping",
    });
    if (!themed.ok) throw new Error(themed.errors.join(";"));
    const html = renderToStaticMarkup(
      <DynamicDraftCard category="THEMED_FARM" ammo={themed.ammo} />,
    );
    expect(html).toContain('class="draft-card draft-housekeeping"');
    expect(resolveDraftThemeClass(themed.ammo)).toBe("draft-housekeeping");
  });

  it("describeFormSchemaFields 纯函数：字段投影语义（类型归一/必填/默认值）", () => {
    const reg = registerDynamicAmmo(buildDraftConfig());
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    const fields = describeFormSchemaFields(reg.ammo);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toMatchObject({
      key: "fieldAreaMu",
      label: "作业亩数",
      type: "number",
      required: true,
    });
    expect(fields[1]).toMatchObject({
      key: "pesticideType",
      type: "enum",
      options: ["除草剂", "杀菌剂"],
      value: "除草剂",
    });
    expect(fields[2]).toMatchObject({ key: "cropKind", type: "string", required: false });
    // 制式弹药无 formSchema → 空数组（不渲染扩展区）
    expect(describeFormSchemaFields(getAmmoDefinition("housekeeping"))).toEqual([]);
  });
});
