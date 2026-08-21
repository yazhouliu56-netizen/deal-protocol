"use client";

import { useState } from "react";

import type { IAmmoDefinition, PricingModel } from "@/types/ammo-schema";
import type { IFuzePolicy } from "@/types/fuze-policy";
import type { ScenarioTheme } from "@/types/ui-viewport";
import { resolveAmmoIdForPublish, getAmmoById, getAmmoDefinition } from "@/ammo/registry";
import { normalizeAmmoTheme } from "./slots/DynamicAmmoSlot";

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

/**
 * 计价模型 → 预估费用文案（弹药表驱动展示）。
 * FORMULA（公式计价）：公式名 + 上门检测费（params.baseRate）保底呈现。
 */
export function describePricing(model: PricingModel): string {
  switch (model.kind) {
    case "FIXED":
      return `预估费用：¥${model.amountYuan}（一口价）`;
    case "HOURLY":
      return `预估费用：¥${model.rateYuan}/小时 × ${model.minHours}小时起`;
    case "PER_SEAT":
      return `预估费用：¥${model.perSeatYuan}/人 · ${model.minSeats}人起（AA 均摊）`;
    case "FORMULA":
      return `预估费用：按公式 ${model.formulaId} 计价（上门检测费 ¥${Number(model.params?.baseRate ?? 0).toFixed(2)}）`;
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

/** SOP 行 → 内联调节器描述（岗位级微调：数值/单位/步长/护栏，弹药表驱动零硬编码）。 */
export interface SopAdjuster {
  key: string;
  base: number;
  unit: string;
  min: number;
  max: number;
  step: number;
}

export function describeSopAdjusters(ammo: IAmmoDefinition): SopAdjuster[] {
  const sop = ammo.sop ?? {};
  const rows: SopAdjuster[] = [];
  if (typeof sop.depositRate === "number") {
    rows.push({ key: "deposit", base: Math.round(sop.depositRate * 100), unit: "%", min: 0, max: 50, step: 5 });
  }
  if (sop.expiresInMs) {
    const minutes = Math.round(sop.expiresInMs / 60_000);
    rows.push({ key: "ttl", base: minutes, unit: " 分钟内有效", min: 30, max: 1440, step: 30 });
  }
  if (typeof sop.capacityDefault === "number") {
    rows.push({ key: "capacity", base: sop.capacityDefault, unit: " 人", min: 1, max: 20, step: 1 });
  }
  if (typeof sop.buffSeats === "number") {
    rows.push({ key: "buff", base: sop.buffSeats, unit: " 席", min: 0, max: 5, step: 1 });
  }
  if (typeof sop.maxRounds === "number") {
    rows.push({ key: "rounds", base: sop.maxRounds, unit: " 轮", min: 1, max: 6, step: 1 });
  }
  return rows;
}

/** 内联微调后的实时费用估算（PER_SEAT × 人数 / HOURLY × 时长；无联动参数 → null 不渲染）。 */
export function describeLiveEstimate(
  ammo: IAmmoDefinition,
  overrides: Record<string, number | string>
): string | null {
  const pm = resolveDraftPricing(ammo);
  if (pm.kind === "PER_SEAT" && typeof overrides.capacity === "number") {
    return `按当前参数估算：¥${pm.perSeatYuan * overrides.capacity}（${overrides.capacity} 人 AA 均摊）`;
  }
  if (pm.kind === "HOURLY" && typeof overrides.ttl === "number") {
    const h = Math.max(1, Math.ceil(overrides.ttl / 60));
    return `按当前参数估算：¥${pm.rateYuan} × ${h}h = ¥${pm.rateYuan * h}`;
  }
  return null;
}

/** 数值夹取（调节器护栏 min/max）。 */
export function clampAdj(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 动态表单 Schema 字段投影（D8 formSchema 声明式驱动，非硬编码字典）。 */
export type DraftFormFieldType = "string" | "number" | "enum" | "boolean" | "unknown";

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
  const schema = ammo.holographic?.formSchema as Record<string, unknown> | undefined;
  let fields: Record<string, unknown>[] = [];
  if (schema && Array.isArray((schema as { fields?: unknown }).fields)) {
    fields = (schema as { fields: Record<string, unknown>[] }).fields;
  } else if (schema && typeof schema === "object") {
    const entries = Object.entries(schema as Record<string, unknown>);
    const isMap = entries.some(([, v]) => v !== null && typeof v === "object" && "type" in (v as Record<string, unknown>));
    if (isMap) {
      fields = entries.map(([key, def]) => ({ key, ...(def as Record<string, unknown>) }));
    }
  }
  const rows: DraftFormField[] = [];
  for (const f of fields) {
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
            : typeKey === "boolean" || typeKey === "bool" || typeKey === "switch"
              ? "boolean"
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
      value: f.defaultValue ?? f.value ?? f.default ?? "",
      options: options && options.length > 0 ? options : undefined,
      required: f.required === true,
    });
  }
  return rows;
}

/** 弹药主题令牌 → 草稿卡主题类（D8 视觉微氛围；未知/缺失安全回落 default）。 */
export function resolveDraftThemeClass(ammo: IAmmoDefinition): string {
  return `draft-${normalizeAmmoTheme(ammo.holographic?.theme)}`;
}

/** 弹药主题令牌 → `data-theme` 作用域键（D-8 视口主题注入；缺省 default 兜底）。 */
export function resolveAmmoTheme(ammo: IAmmoDefinition): ScenarioTheme {
  return normalizeAmmoTheme(ammo.holographic?.theme);
}

/** D7 自动验收时效 → 质保徽标文案（缺省不渲染；48h → "⏱️ 48h 质保验收"）。 */
export function describeWarrantyBadge(ammo: IAmmoDefinition): string | null {
  const hours = ammo.autoAcceptanceTimeoutHours;
  if (typeof hours !== "number" || hours <= 0) return null;
  return `⏱️ ${hours}h 质保验收`;
}

const DRAFT_CSS = `
.draft-card{position:relative;max-width:420px;border-radius:20px;padding:18px 18px 14px;
  background:linear-gradient(135deg,var(--theme-surface-tint),rgba(255,255,255,.05));
  border:1px solid var(--theme-border);box-shadow:0 12px 40px rgba(0,0,0,.35),
  inset 0 1px 0 rgba(255,255,255,.28),0 0 32px var(--theme-glow);backdrop-filter:blur(24px) saturate(170%);
  color:#e2e8f0;font-size:14px;line-height:1.5}
.draft-card-title{font-size:18px;font-weight:700;margin-bottom:10px;display:flex;
  justify-content:space-between;align-items:center;color:#f1f5f9}
.draft-card-ammo{font-size:12px;color:rgba(255,255,255,.68);font-weight:500}
.draft-card-rows{display:flex;flex-direction:column;gap:6px}
.draft-card-row{display:flex;justify-content:space-between;padding:7px 10px;border-radius:10px;
  background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);cursor:pointer;
  transition:background .15s;font-size:14px;font-weight:500;color:#ecf1f8;line-height:1.5}
.draft-card-row:hover{background:rgba(255,255,255,.12)}
.draft-card-price{margin:10px 0;padding:8px 10px;border-radius:10px;font-weight:600;font-size:14px;
  color:#f1f5f9;background:linear-gradient(90deg,var(--theme-surface-tint),rgba(123,97,255,.16))}
.draft-card-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
.draft-card-badge{font-size:12px;font-weight:500;padding:4px 10px;border-radius:999px;
  background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);color:#dbe4f0}
.draft-card-cta{width:100%;padding:11px 0;border-radius:14px;font-weight:800;font-size:15px;
  color:#fff;background:linear-gradient(135deg,var(--theme-primary),var(--theme-primary-active));
  border:none;cursor:pointer;box-shadow:0 6px 20px var(--theme-glow);
  transition:transform .15s,filter .15s}
.draft-card-cta:hover{transform:translateY(-1px);filter:brightness(1.1)}
.draft-card-cta:active{transform:scale(.98)}
/* D8 视觉微氛围：弹药主题令牌经 [data-theme] 作用域注入（--theme-border/glow/primary），
   draft-* 类保留输出以兼容既有断言；未知/缺失主题由 data-theme="default" 安全兜底 */
/* D8 动态扩展字段区（formSchema 声明式驱动，可点击微调） */
.draft-card-form{display:flex;flex-direction:column;gap:6px;margin:6px 0 2px}
.draft-card-form-row{display:flex;justify-content:space-between;align-items:center;gap:8px;
  padding:7px 10px;border-radius:10px;background:rgba(255,255,255,.05);
  border:1px dashed rgba(255,255,255,.14);cursor:pointer;transition:background .15s}
.draft-card-form-row:hover{background:rgba(255,255,255,.1)}
.draft-card-form-row > span:first-child{display:flex;align-items:center;gap:4px;color:#d7dee9;font-size:14px;
  font-weight:500}
.draft-card-required{color:#f87171}
.draft-card-form-options{font-size:12px;color:#cbd5e1}
.draft-card-form-value{color:#e2e8f0;font-size:13px;font-weight:600}
/* 内联参数调节器（点击参数行展开抽屉式微调） */
.draft-card-adj{display:flex;align-items:center;gap:8px;margin:-2px 0 8px;padding:8px 10px;
  border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(123,97,255,.35)}
.draft-adj-btn{min-width:28px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.18);
  background:rgba(255,255,255,.08);color:#e2e8f0;font-size:14px;font-weight:800;cursor:pointer;
  user-select:none;transition:background .12s,transform .12s}
.draft-adj-btn:hover{background:rgba(255,255,255,.16)}
.draft-adj-btn:active{transform:scale(.92)}
.draft-adj-value{flex:1;text-align:center;color:#f1f5f9;font-size:14px;font-weight:700;
  font-variant-numeric:tabular-nums}
.draft-adj-hint{font-size:12px;color:#cbd5e1}
.draft-adj-reset{border:none;background:none;color:#cbd5e1;font-size:12px;cursor:pointer;
  padding:4px 6px;border-radius:6px;font-weight:500}
.draft-adj-reset:hover{color:#e2e8f0;background:rgba(255,255,255,.08)}
/* 深压 CTA 反馈：点击涟漪 + 按压内缩 */
.draft-card-cta{position:relative;overflow:hidden}
.draft-card-cta:active{transform:scale(.97)}
.draft-card-ripple{position:absolute;left:50%;top:50%;width:120px;height:120px;margin:-60px 0 0 -60px;
  border-radius:50%;background:rgba(255,255,255,.35);pointer-events:none;
  animation:draft-ripple-kf .55s ease-out forwards}
@keyframes draft-ripple-kf{from{transform:scale(.05);opacity:.85}to{transform:scale(3);opacity:0}}
`;

/** 拟物磨砂玻璃草稿卡：弹药驱动参数 + 计价 + 安全徽章 + 一键发布 CTA。 */
export default function DynamicDraftCard({
  category,
  ammo,
  onTweak,
  onPublish,
}: DynamicDraftCardProps) {
  // 弹药解析对齐落库语义（W1）：发布链路写 Wave.ammoId 走 resolveAmmoIdForPublish
  // （动态池 → 中文类目归一化直拨官方弹药），预览卡同链解析保证「所见即所发」——
  // 中文别名（如「修空调」）在发布面板直拨 appliance-repair-v1 整弹而非聚合保底。
  const definition = ammo ?? getAmmoById(resolveAmmoIdForPublish(category));
  const priceText = describePricing(resolveDraftPricing(definition));
  const badges = describeSafetyBadges(definition.fuzePolicy);
  const warrantyBadge = describeWarrantyBadge(definition);
  if (warrantyBadge) badges.push(warrantyBadge);
  const params = describeSopParams(definition);
  const formFields = describeFormSchemaFields(definition);
  const themeClass = resolveDraftThemeClass(definition);

  // 内联微调状态：正在展开的参数行 + 用户覆盖值（初始 = 弹药出厂默认，SSR 逐字一致）
  const [editing, setEditing] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number | string | boolean>>({});
  const [ripple, setRipple] = useState(0);
  const adjusters = describeSopAdjusters(definition);
  const adjByKey = new Map(adjusters.map((a) => [a.key, a]));
  const liveEstimate = describeLiveEstimate(definition, overrides as Record<string, number | string>);

  const setAdj = (key: string, value: number) => {
    setOverrides((prev) => ({ ...prev, [key]: clampAdj(value, adjByKey.get(key)?.min ?? 0, adjByKey.get(key)?.max ?? 9999) }));
  };

  return (
    <div
      className={`draft-card ${themeClass}`}
      data-ammo={definition.ammoId}
      data-category={category}
      data-theme={resolveAmmoTheme(definition)}
    >
      <style>{DRAFT_CSS}</style>
      <div className="draft-card-title">
        <span>✦ 需求草稿</span>
        <span className="draft-card-ammo">{definition.ammoId} · v{definition.version}</span>
      </div>
      <div className="draft-card-rows">
        {params.map((row) => {
          const adj = adjByKey.get(row.key);
          if (editing === row.key && adj) {
            const current = typeof overrides[row.key] === "number" ? (overrides[row.key] as number) : adj.base;
            return (
              <div key={row.key}>
                <button
                  type="button"
                  className="draft-card-row"
                  data-param={row.key}
                  onClick={() => { setEditing(null); onTweak?.(row.key); }}
                >
                  <span>{row.label}</span>
                  <span aria-hidden="true">▲</span>
                </button>
                <div className="draft-card-adj" data-testid={`sop-adjuster-${row.key}`}>
                  <button type="button" data-minus className="draft-adj-btn" onClick={() => setAdj(row.key, current - adj.step)}>−</button>
                  <span className="draft-adj-value">{current}{adj.unit}</span>
                  <button type="button" data-plus className="draft-adj-btn" onClick={() => setAdj(row.key, current + adj.step)}>+</button>
                  <button
                    type="button"
                    className="draft-adj-reset"
                    onClick={() => setOverrides((prev) => {
                      const next = { ...prev };
                      delete next[row.key];
                      return next;
                    })}
                  >
                    重置
                  </button>
                </div>
              </div>
            );
          }
          if (editing === row.key) {
            return (
              <div key={row.key}>
                <button
                  type="button"
                  className="draft-card-row"
                  data-param={row.key}
                  onClick={() => { setEditing(null); onTweak?.(row.key); }}
                >
                  <span>{row.label}</span>
                  <span aria-hidden="true">▲</span>
                </button>
                <div className="draft-card-adj" data-testid={`sop-adjuster-${row.key}`}>
                  <span className="draft-adj-value" style={{ flex: "none" }}>已按出厂默认锁定</span>
                  <span className="draft-adj-hint">完整发布面板可再微调</span>
                </div>
              </div>
            );
          }
          return (
            <button
              key={row.key}
              type="button"
              className="draft-card-row"
              data-param={row.key}
              onClick={() => { setEditing(row.key); onTweak?.(row.key); }}
            >
              <span>{row.label}</span>
              <span aria-hidden="true">✎</span>
            </button>
          );
        })}
      </div>
      {formFields.length > 0 && (
        <div className="draft-card-form" data-testid="draft-form-fields">
          {formFields.map((f) => {
            const current = typeof overrides[f.key] !== "undefined" ? overrides[f.key] : f.value;
            const active = editing === f.key;
            const type: "number" | "enum" | "string" | "boolean" =
              f.type === "number"
                ? "number"
                : f.type === "enum"
                  ? "enum"
                  : f.type === "boolean"
                    ? "boolean"
                    : "string";
            const num = (t: number) => setOverrides((prev) => ({ ...prev, [f.key]: clampAdj(t, 0, 9999) }));
            return (
              <div key={f.key}>
                <button
                  type="button"
                  className="draft-card-form-row"
                  data-field={f.key}
                  onClick={() => { setEditing(active ? null : f.key); onTweak?.(f.key); }}
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
                    {String(current === "" ? "待填写" : current)}
                  </span>
                  <span aria-hidden="true">{active ? "▲" : "✎"}</span>
                </button>
                {active && (
                  <div className="draft-card-adj" data-testid={`field-adjuster-${f.key}`}>
                    {type === "number" && (
                      <>
                        <button type="button" data-minus className="draft-adj-btn" onClick={() => num(typeof current === "number" ? current - 1 : 0)}>−</button>
                        <span className="draft-adj-value">{String(current === "" ? 0 : current)}</span>
                        <button type="button" data-plus className="draft-adj-btn" onClick={() => num(typeof current === "number" ? current + 1 : 1)}>+</button>
                      </>
                    )}
                    {type === "enum" && f.options && f.options.length > 0 && (
                      <>
                        <button
                          type="button"
                          data-minus
                          className="draft-adj-btn"
                          onClick={() => {
                            const i = f.options!.indexOf(String(current));
                            const next = f.options![(i - 1 + f.options!.length) % f.options!.length];
                            setOverrides((prev) => ({ ...prev, [f.key]: next }));
                          }}
                        >
                          ‹
                        </button>
                        <span className="draft-adj-value">{String(current === "" ? "请选择" : current)}</span>
                        <button
                          type="button"
                          data-plus
                          className="draft-adj-btn"
                          onClick={() => {
                            const i = f.options!.indexOf(String(current));
                            const next = f.options![(i + 1) % f.options!.length];
                            setOverrides((prev) => ({ ...prev, [f.key]: next }));
                          }}
                        >
                          ›
                        </button>
                      </>
                    )}
                    {type === "string" && (
                      <input
                        data-input
                        name={`draft-field-${f.key}`}
                        className="draft-adj-value flex-1 bg-transparent border border-white/20 rounded-lg px-2 py-1.5 outline-none"
                        value={String(current)}
                        placeholder="填写"
                        onChange={(e) => setOverrides((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      />
                    )}
                    {type === "boolean" && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(current)}
                        data-testid={`field-boolean-${f.key}`}
                        className={`draft-adj-btn ${Boolean(current) ? "bg-emerald-500/30 border-emerald-400/50" : ""}`}
                        onClick={() => setOverrides((prev) => ({ ...prev, [f.key]: !Boolean(current) }))}
                      >
                        {Boolean(current) ? "✅ 已开启" : "⭕ 已关闭"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="draft-card-price">
        <span className="font-tabular">{priceText}</span>
        {liveEstimate && (
          <span key={liveEstimate} className="price-roll block mt-1 text-xs opacity-90 font-tabular">
            {liveEstimate}
          </span>
        )}
      </div>
      {badges.length > 0 && (
        <div className="draft-card-badges">
          {badges.map((badge) => (
            <span key={badge} className="draft-card-badge">
              {badge}
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        className="draft-card-cta"
        onPointerDown={() => setRipple((n) => n + 1)}
        onClick={onPublish}
      >
        {ripple > 0 && <span key={ripple} className="draft-card-ripple" />}
        扣动扳机·一键发布
      </button>
    </div>
  );
}
