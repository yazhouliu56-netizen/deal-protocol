"use client";

import type { IAmmoDefinition, PricingModel } from "@/types/ammo-schema";
import type { IFuzePolicy } from "@/types/fuze-policy";
import { getAmmoDefinition } from "@/ammo/registry";

/**
 * 动态发布草稿卡（Dynamic Draft Card · A 需求发布视口首件）。
 *
 * 白皮书 §五 5.4.2 法则四：AI 意图转单与「拟物草稿卡」——自然语言/语音输入
 * ➔ decompose 抽取 ➔ 屏幕中央浮现半拟物化磨砂透明订单草稿卡 ➔ 用户微调确认发射。
 * §五 5.6.1 动态发布页（Dynamic Launchpad）核心组件。
 *
 * 弹药驱动（红线 2 / 4：禁止品类硬编码，一切业务参数经弹药表驱动）：
 * - 结构化参数列表 ← `IAmmoDefinition.sop` 默认值；
 * - 预估费用与计价模型 ← `pricingModel`；
 * - 安全底线徽章 ← `fuzePolicy`（IFuzePolicy 投影，随弹药自动装填）。
 */

export interface DynamicDraftCardProps {
  /** 业务类目键（如 "housekeeping" / "meetup" / "social"），经注册表整弹解析。 */
  category: string;
  /** 弹药覆盖（测试/预览注入；缺省走 getAmmoDefinition(category)）。 */
  ammo?: IAmmoDefinition;
  /** 点击微调参数（结构化参数行可点）。 */
  onTweak?: (key: string) => void;
  /** 「扣动扳机·一键发布」CTA。 */
  onPublish?: () => void;
}

/** 计价模型 → 预估费用文案（弹药表驱动展示）。 */
export function describePricing(model: PricingModel): string {
  switch (model.kind) {
    case "FIXED":
      return `预估费用：¥${model.amountYuan}（一口价）`;
    case "HOURLY":
      return `预估费用：¥${model.rateYuan}/小时 × ${model.minHours}小时起`;
    case "PER_SEAT":
      return `预估费用：¥${model.perSeatYuan}/人 · ${model.minSeats}人起（AA 均摊）`;
    case "FORMULA":
      return `预估费用：按公式 ${model.formulaId} 计价`;
  }
}

/**
 * 草稿卡定价模型解析：8D 全息镜像优先（holographic.pricingModel 为装配出厂
 * 权威源），缺省回落弹药顶层 pricingModel（历史/保底弹药零回归）。
 * 消除「顶层旧字段与全息声明脱节」导致的起步时长显示偏差风险。
 */
export function resolveDraftPricing(ammo: IAmmoDefinition): PricingModel {
  if (ammo.holographic?.pricingModel) return ammo.holographic.pricingModel;
  return ammo.pricingModel;
}

/** 引信策略 → 安全底线徽章（IFuzePolicy 投影，随弹药自动装填）。 */
export function describeSafetyBadges(fuze: IFuzePolicy): string[] {
  const badges: string[] = [];
  if (fuze.propertyInsurance) badges.push("🛡️已投保财产险");
  if (fuze.deposit.strategy !== "NONE") {
    const ratio = fuze.deposit.ratio ? ` ${Math.round(fuze.deposit.ratio * 100)}%` : "";
    badges.push(`🔒定金托管${ratio}`);
  }
  if (fuze.advanceFreeze.enabled) badges.push("⏳预付冻结");
  if (fuze.geoFence.enabled) badges.push(`📍LBS围栏${fuze.geoFence.radiusM ? ` ${fuze.geoFence.radiusM}m` : ""}`);
  if (fuze.privacy.virtualNumber) badges.push("📞虚拟号保护");
  if (fuze.sos.enabled) badges.push("🆘SOS联动");
  return badges;
}

/** SOP 默认值 → 结构化参数行（可点击微调）。 */
export function describeSopParams(ammo: IAmmoDefinition): { key: string; label: string }[] {
  const sop = ammo.sop ?? {};
  const rows: { key: string; label: string }[] = [];
  if (typeof sop.depositRate === "number") {
    rows.push({ key: "deposit", label: `押金比例 ${Math.round(sop.depositRate * 100)}%` });
  } else if (sop.depositDefault) {
    rows.push({ key: "deposit", label: "需预付定金" });
  }
  if (sop.expiresInMs) {
    rows.push({ key: "ttl", label: `${Math.round(sop.expiresInMs / 60_000)} 分钟内有效` });
  }
  if (typeof sop.capacityDefault === "number") {
    rows.push({ key: "capacity", label: `默认 ${sop.capacityDefault} 人` });
  }
  if (typeof sop.buffSeats === "number") {
    rows.push({ key: "buff", label: `拼位缓冲 ${sop.buffSeats} 席` });
  }
  if (typeof sop.maxRounds === "number") {
    rows.push({ key: "rounds", label: `磋商上限 ${sop.maxRounds} 轮` });
  }
  if (rows.length === 0) rows.push({ key: "base", label: "基础要素按默认执行" });
  return rows;
}

/** 动态表单 Schema 字段投影（D8 formSchema 声明式驱动，非硬编码字典）。 */
export type DraftFormFieldType = "string" | "number" | "enum" | "unknown";

export interface DraftFormField {
  /** 字段键（写入订单固化参数快照 bizParams）。 */
  key: string;
  /** 展示标签（缺省 = 字段键）。 */
  label: string;
  /** 输入形态：text/number → 文本数值微调；picker/select → 选项选择。 */
  type: DraftFormFieldType;
  /** 默认值（缺省 = 空串占位）。 */
  value: unknown;
  /** 选项列表（picker/select 类字段）。 */
  options?: string[];
  /** 是否必填（渲染 * 徽标）。 */
  required: boolean;
}

/** 8 维全息 formSchema → 草稿卡字段行（纯函数，仅供渲染消费）。 */
export function describeFormSchemaFields(ammo: IAmmoDefinition): DraftFormField[] {
  const schema = ammo.holographic?.formSchema;
  const fields = schema && Array.isArray(schema.fields) ? schema.fields : [];
  const rows: DraftFormField[] = [];
  for (const f of fields as Record<string, unknown>[]) {
    if (!f || typeof f !== "object") continue;
    const key = typeof f.key === "string" && f.key.trim() !== "" ? f.key : "field";
    const typeKey = String(f.type ?? "");
    const type: DraftFormFieldType =
      typeKey === "text" || typeKey === "string"
        ? "string"
        : typeKey === "number"
          ? "number"
          : typeKey === "picker" || typeKey === "select" || typeKey === "enum"
            ? "enum"
            : "unknown";
    const rawOptions =
      Array.isArray(f.options)
        ? f.options
        : Array.isArray(f.choices)
          ? f.choices
          : undefined;
    const options = rawOptions?.filter((o): o is string => typeof o === "string");
    rows.push({
      key,
      label: typeof f.label === "string" && f.label.trim() !== "" ? f.label : key,
      type,
      value: f.defaultValue ?? f.value ?? "",
      options: options && options.length > 0 ? options : undefined,
      required: f.required === true,
    });
  }
  return rows;
}

/** 弹药主题令牌 → 草稿卡主题类（D8 视觉微氛围；缺省 default 安全回落）。 */
export function resolveDraftThemeClass(ammo: IAmmoDefinition): string {
  return `draft-${ammo.holographic?.theme ?? "default"}`;
}

const DRAFT_CSS = `
.draft-card{position:relative;max-width:420px;border-radius:20px;padding:18px 18px 14px;
  background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.05));
  border:1px solid rgba(255,255,255,.22);box-shadow:0 12px 40px rgba(0,0,0,.35),
  inset 0 1px 0 rgba(255,255,255,.28);backdrop-filter:blur(24px) saturate(170%);
  color:#e2e8f0;font-size:13px}
.draft-card-title{font-size:15px;font-weight:700;margin-bottom:10px;display:flex;
  justify-content:space-between;align-items:center}
.draft-card-ammo{font-size:11px;color:#94a3b8;font-weight:400}
.draft-card-rows{display:flex;flex-direction:column;gap:6px}
.draft-card-row{display:flex;justify-content:space-between;padding:7px 10px;border-radius:10px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);cursor:pointer;
  transition:background .15s}
.draft-card-row:hover{background:rgba(255,255,255,.12)}
.draft-card-price{margin:10px 0;padding:8px 10px;border-radius:10px;font-weight:600;
  background:linear-gradient(90deg,rgba(0,240,255,.16),rgba(123,97,255,.16))}
.draft-card-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.draft-card-badge{font-size:11px;padding:3px 8px;border-radius:999px;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16)}
.draft-card-cta{width:100%;padding:11px 0;border-radius:14px;font-weight:700;font-size:14px;
  color:#05060f;background:linear-gradient(135deg,#00f0ff,#7b61ff);border:none;cursor:pointer;
  box-shadow:0 6px 20px rgba(123,97,255,.45);transition:transform .15s,filter .15s}
.draft-card-cta:hover{transform:translateY(-1px);filter:brightness(1.1)}
.draft-card-cta:active{transform:scale(.98)}
/* D8 视觉微氛围：弹药主题令牌 → 边框微染（缺省 default 无色变） */
.draft-card.draft-housekeeping{border-color:rgba(56,132,255,.45)}
.draft-card.draft-meetup{border-color:rgba(251,146,60,.45)}
.draft-card.draft-companion{border-color:rgba(167,139,250,.5)}
/* D8 动态扩展字段区（formSchema 声明式驱动，可点击微调） */
.draft-card-form{display:flex;flex-direction:column;gap:6px;margin:6px 0 2px}
.draft-card-form-row{display:flex;justify-content:space-between;align-items:center;gap:8px;
  padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.05);
  border:1px dashed rgba(255,255,255,.14);cursor:pointer;transition:background .15s}
.draft-card-form-row:hover{background:rgba(255,255,255,.1)}
.draft-card-form-row > span:first-child{display:flex;align-items:center;gap:4px;color:#cbd5e1}
.draft-card-required{color:#f87171}
.draft-card-form-options{font-size:10px;color:#94a3b8}
.draft-card-form-value{color:#cbd5e1;font-size:12px}
`;

/** 拟物磨砂玻璃草稿卡：弹药驱动参数 + 计价 + 安全徽章 + 一键发布 CTA。 */
export default function DynamicDraftCard({
  category,
  ammo,
  onTweak,
  onPublish,
}: DynamicDraftCardProps) {
  const definition = ammo ?? getAmmoDefinition(category);
  const priceText = describePricing(resolveDraftPricing(definition));
  const badges = describeSafetyBadges(definition.fuzePolicy);
  const params = describeSopParams(definition);
  const formFields = describeFormSchemaFields(definition);
  const themeClass = resolveDraftThemeClass(definition);

  return (
    <div className={`draft-card ${themeClass}`} data-ammo={definition.ammoId} data-category={category}>
      <style>{DRAFT_CSS}</style>
      <div className="draft-card-title">
        <span>✦ 需求草稿</span>
        <span className="draft-card-ammo">{definition.ammoId} · v{definition.version}</span>
      </div>
      <div className="draft-card-rows">
        {params.map((row) => (
          <button
            key={row.key}
            type="button"
            className="draft-card-row"
            data-param={row.key}
            onClick={() => onTweak?.(row.key)}
          >
            <span>{row.label}</span>
            <span aria-hidden="true">✎</span>
          </button>
        ))}
      </div>
      {formFields.length > 0 && (
        <div className="draft-card-form" data-testid="draft-form-fields">
          {formFields.map((f) => (
            <button
              key={f.key}
              type="button"
              className="draft-card-form-row"
              data-field={f.key}
              onClick={() => onTweak?.(f.key)}
            >
              <span>
                {f.required && (
                  <span className="draft-card-required" aria-hidden="true">
                    *
                  </span>
                )}
                {f.label}
                {f.options && f.options.length > 0 && (
                  <span className="draft-card-form-options">[{f.options.join("/")}]</span>
                )}
              </span>
              <span className="draft-card-form-value">
                {String(f.value === "" ? "待填写" : f.value)}
              </span>
              <span aria-hidden="true">✎</span>
            </button>
          ))}
        </div>
      )}
      <div className="draft-card-price">{priceText}</div>
      {badges.length > 0 && (
        <div className="draft-card-badges">
          {badges.map((badge) => (
            <span key={badge} className="draft-card-badge">
              {badge}
            </span>
          ))}
        </div>
      )}
      <button type="button" className="draft-card-cta" onClick={onPublish}>
        扣动扳机·一键发布
      </button>
    </div>
  );
}
