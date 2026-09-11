"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { RISE_8 } from "@/components/ui/motion";

import type { IAmmoDefinition, PricingModel } from "@/types/ammo-schema";
import type { IFuzePolicy } from "@/types/fuze-policy";
import type { ScenarioTheme } from "@/types/ui-viewport";
import { resolveAmmoIdForPublish, getAmmoById } from "@/ammo/registry";
import { normalizeAmmoTheme } from "./slots/DynamicAmmoSlot";
import DuoButton from "@/components/ui/DuoButton";
import DuoPill from "@/components/ui/DuoPill";
import { fireDuoConfetti } from "@/lib/duo-confetti";

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
 *
 * Duo 化（Batch① 2026-09）：玻璃拟物暗岛 `<style>`（DRAFT_CSS）删除，内层全部
 * 收敛 Duo 白底原语（polar 行 / DuoPill 徽章 / eel 正文）；外层 motion + 首类名
 * `draft-card` + `draft-*` 主题类 + data-* + 文案保持（单测硬锚点）。
 */

export interface DynamicDraftCardProps {
  /** 业务品类名（如 "housekeeping" / "meetup" / "social"，兼容注音别名容错） */
  category: string;
  /** 弹药覆盖（测试/预览注入；缺省走 getAmmoDefinition(category)） */
  ammo?: IAmmoDefinition;
  /** 参数微调回调（参数行全部可点） */
  onTweak?: (key: string) => void;
  /** 扣动扳机·一键发布（CTA） */
  onPublish?: () => void;
  /**
   * P1 第 4 步：内嵌模式 —— 被 PublishSheet 等父级收编为「可微调参数摘要」时，
   * 隐藏卡片自带的发射按钮，保证视口单一操作出口（单 CTA 原则）。
   * 默认 false：独立卡片（首页 DraftSheet 入口）行为零变化。
   */
  hideLaunchButton?: boolean;
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

/**
 * Microkernel 4.2 #2 · 成本透视（Cost Guide · 宪法 #5 引信跟弹药）：
 * D2 pricingModel → 人话市场参考（纯函数，0 I/O）。
 * 空值安全：未知 kind 返回 null（不渲染）。
 */
export function describePricingGuide(model: PricingModel): string | null {
  switch (model.kind) {
    case "FIXED":
      return `💡 市场参考：¥${model.amountYuan} 一口价`;
    case "HOURLY":
      return `💡 市场参考：¥${model.rateYuan}/小时 × ${model.minHours}小时起`;
    case "PER_SEAT":
      return `💡 市场参考：¥${model.perSeatYuan}/人 · ${model.minSeats}人起 · AA均摊`;
    case "FORMULA":
      return `💡 市场参考：上门检测 ¥${Number(model.params?.baseRate ?? 30).toFixed(0)} 起 + 按公式计价`;
    default:
      return null;
  }
}

/**
 * Microkernel 4.2 #2 · 保障徽章（Assurance Badge · 宪法 #5）：
 * D3 fuzePolicy → 人话资金与风险保障（纯函数，财产险有无条件分支）。
 */
export function describeAssuranceBadge(fuze: IFuzePolicy): string {
  const insurance = fuze.propertyInsurance ? "财产险先行赔付 · " : "";
  return `🛡️ 平台全额托管 · 完工前资金不落服务者 · ${insurance}争议 100% 证据包定责`;
}

// Duo 内联调节器抽屉（polar 底 + 白按钮；替代已删 .draft-card-adj 暗岛）。
const ADJ_DRAWER =
  "flex items-center gap-2 -mt-0.5 mb-2 px-2.5 py-2 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)]";
const ADJ_BTN =
  "min-w-7 h-[26px] px-2 rounded-lg border-2 border-[var(--color-duo-swan)] bg-white text-[var(--color-duo-eel)] text-sm font-extrabold cursor-pointer select-none transition-[filter] hover:brightness-[1.03] active:translate-y-[1px]";
const ADJ_VALUE =
  "flex-1 text-center text-[var(--color-duo-eel)] text-sm font-extrabold tabular-nums";

/** 参数胶囊（白底 Duo 小按钮；替代已删 .draft-card-row 暗岛）。 */
const PARAM_PILL =
  "rounded-full bg-white border border-[var(--color-duo-swan)] border-b-[3px] px-4 py-2 text-sm font-bold text-[var(--color-duo-eel)] shadow-sm hover:brightness-[1.02] transition-[transform,filter] active:translate-y-[2px] active:border-b-0";

/** 拟物草稿卡（已 Duo 化）：弹药驱动参数 + 计价 + 安全徽章 + 一键发布 CTA。 */
export default function DynamicDraftCard({
  category,
  ammo,
  onTweak,
  onPublish,
  hideLaunchButton = false,
}: DynamicDraftCardProps) {
  // 弹药解析对齐落库语义（W1）：发布链路写 Wave.ammoId 走 resolveAmmoIdForPublish
  // （动态池 → 中文类目归一化直拨官方弹药），预览卡同链解析保证「所见即所发」——
  // 中文别名（如「修空调」）在发布面板直拨 appliance-repair-v1 整弹而非聚合保底。
  const definition = ammo ?? getAmmoById(resolveAmmoIdForPublish(category));
  const priceText = describePricing(resolveDraftPricing(definition));
  const pricingGuide = describePricingGuide(resolveDraftPricing(definition));
  const assuranceBadge = describeAssuranceBadge(definition.fuzePolicy);
  const badges = describeSafetyBadges(definition.fuzePolicy);
  const warrantyBadge = describeWarrantyBadge(definition);
  if (warrantyBadge) badges.push(warrantyBadge);
  const params = describeSopParams(definition);
  const formFields = describeFormSchemaFields(definition);
  const themeClass = resolveDraftThemeClass(definition);

  // 内联微调状态：正在展开的参数行 + 用户覆盖值（初始 = 弹药出厂默认，SSR 逐字一致）
  const [editing, setEditing] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, number | string | boolean>>({});
  const adjusters = describeSopAdjusters(definition);
  const adjByKey = new Map(adjusters.map((a) => [a.key, a]));
  const liveEstimate = describeLiveEstimate(definition, overrides as Record<string, number | string>);

  const setAdj = (key: string, value: number) => {
    setOverrides((prev) => ({ ...prev, [key]: clampAdj(value, adjByKey.get(key)?.min ?? 0, adjByKey.get(key)?.max ?? 9999) }));
  };

  const handleLaunch = () => {
    try {
      fireDuoConfetti();
    } catch {}
    onPublish?.();
  };

  return (
    <motion.div
      initial={{ ...RISE_8.initial, scale: 0.985 }}
      animate={{ ...RISE_8.animate, scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={`draft-card ${themeClass} duo-3d-card bg-white rounded-3xl border-2 border-b-[6px] border-[var(--color-duo-swan)] shadow-[0_8px_24px_rgba(0,0,0,0.06)]`}
      data-testid="draft-card"
      data-ammo={definition.ammoId}
      data-category={category}
      data-theme={resolveAmmoTheme(definition)}
      style={{ willChange: "transform, opacity" }}
    >
      <div className="mb-2.5 flex items-center justify-between text-lg font-extrabold text-[var(--color-duo-eel)]">
        <span>✦ 需求草稿</span>
        <span className="text-xs font-bold text-[var(--color-duo-hare)]">{definition.ammoId} · v{definition.version}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {params.map((row) => {
          const adj = adjByKey.get(row.key);
          if (editing === row.key && adj) {
            const current = typeof overrides[row.key] === "number" ? (overrides[row.key] as number) : adj.base;
            return (
              <div key={row.key} className="w-full">
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-4 py-2.5 ${PARAM_PILL}`}
                  data-param={row.key}
                  onClick={() => { setEditing(null); onTweak?.(row.key); }}
                >
                  <span>{row.label}</span>
                  <span aria-hidden="true">▲</span>
                </button>
                <div className={ADJ_DRAWER} data-testid={`sop-adjuster-${row.key}`}>
                  <button type="button" data-minus className={ADJ_BTN} onClick={() => setAdj(row.key, current - adj.step)}>−</button>
                  <span className={ADJ_VALUE}>{current}{adj.unit}</span>
                  <button type="button" data-plus className={ADJ_BTN} onClick={() => setAdj(row.key, current + adj.step)}>+</button>
                  <button
                    type="button"
                    className="border-none bg-none px-1.5 py-1 rounded-md text-xs font-bold text-[var(--color-duo-wolf)] cursor-pointer hover:text-[var(--color-duo-eel)] hover:bg-[var(--color-duo-swan)]/60"
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
              <div key={row.key} className="w-full">
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-4 py-2.5 ${PARAM_PILL}`}
                  data-param={row.key}
                  onClick={() => { setEditing(null); onTweak?.(row.key); }}
                >
                  <span>{row.label}</span>
                  <span aria-hidden="true">▲</span>
                </button>
                <div className={ADJ_DRAWER} data-testid={`sop-adjuster-${row.key}`}>
                  <span className={`${ADJ_VALUE} flex-none`}>已按出厂默认锁定</span>
                  <span className="text-xs text-[var(--color-duo-wolf)]">完整发布面板可再微调</span>
                </div>
              </div>
            );
          }
          return (
            <button
              key={row.key}
              type="button"
              className={PARAM_PILL}
              data-param={row.key}
              onClick={() => { setEditing(row.key); onTweak?.(row.key); }}
            >
              <span>{row.label}</span>
              <span aria-hidden="true" className="ml-1.5">✎</span>
            </button>
          );
        })}
      </div>
      {formFields.length > 0 && (
        <div className="flex flex-col gap-1.5 my-1.5" data-testid="draft-form-fields">
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
                  className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 ${PARAM_PILL}`}
                  data-field={f.key}
                  onClick={() => { setEditing(active ? null : f.key); onTweak?.(f.key); }}
                >
                  <span>
                    {f.required && (
                      <span className="draft-card-required" aria-hidden="true" style={{ color: "var(--color-duo-red-dark)" }}>
                        *
                      </span>
                    )}
                    {f.label}
                    {f.options && f.options.length > 0 && (
                      <span className="text-xs text-[var(--color-duo-wolf)]">[{f.options.join("/")}]</span>
                    )}
                  </span>
                  <span className="text-[13px] font-extrabold text-[var(--color-duo-eel)]">
                    {String(current === "" ? "待填写" : current)}
                  </span>
                  <span aria-hidden="true">{active ? "▲" : "✎"}</span>
                </button>
                {active && (
                  <div className={ADJ_DRAWER} data-testid={`field-adjuster-${f.key}`}>
                    {type === "number" && (
                      <>
                        <button type="button" data-minus className={ADJ_BTN} onClick={() => num(typeof current === "number" ? current - 1 : 0)}>−</button>
                        <span className={ADJ_VALUE}>{String(current === "" ? 0 : current)}</span>
                        <button type="button" data-plus className={ADJ_BTN} onClick={() => num(typeof current === "number" ? current + 1 : 1)}>+</button>
                      </>
                    )}
                    {type === "enum" && f.options && f.options.length > 0 && (
                      <>
                        <button
                          type="button"
                          data-minus
                          className={ADJ_BTN}
                          onClick={() => {
                            const i = f.options!.indexOf(String(current));
                            const next = f.options![(i - 1 + f.options!.length) % f.options!.length];
                            setOverrides((prev) => ({ ...prev, [f.key]: next }));
                          }}
                        >
                          ‹
                        </button>
                        <span className={ADJ_VALUE}>{String(current === "" ? "请选择" : current)}</span>
                        <button
                          type="button"
                          data-plus
                          className={ADJ_BTN}
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
                        className="flex-1 rounded-lg border-2 border-[var(--color-duo-swan)] bg-white px-2 py-1.5 text-[13px] font-bold text-[var(--color-duo-eel)] outline-none tabular-nums"
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
                        className={`${ADJ_BTN} ${Boolean(current) ? "bg-[var(--color-duo-green)]/20 border-[var(--color-duo-green-dark)]/60" : ""}`}
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
      <div className="my-2.5 px-2.5 py-2 rounded-xl bg-[var(--color-duo-polar)] border-2 border-[var(--color-duo-swan)] text-sm font-extrabold text-[var(--color-duo-eel)]">
        <span className="font-tabular">{priceText}</span>
        {liveEstimate && (
          <span key={liveEstimate} className="price-roll block mt-1 text-xs opacity-90 font-tabular">
            {liveEstimate}
          </span>
        )}
      </div>
      {pricingGuide && (
        <div className="my-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[var(--color-duo-wolf)] bg-[var(--color-duo-polar)] border-2 border-dashed border-[var(--color-duo-swan)]" data-testid="pricing-guide">
          {pricingGuide}
        </div>
      )}
      <div className="my-1 mb-2 px-2.5 py-1.5 rounded-xl text-xs font-bold text-[var(--color-duo-green-ink)] bg-[var(--color-duo-green)]/10 border-2 border-[var(--color-duo-green-dark)]/50" data-testid="assurance-badge">
        {assuranceBadge}
      </div>
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {badges.map((badge) => (
            <DuoPill key={badge} tone="neutral" variant="soft">
              {badge}
            </DuoPill>
          ))}
        </div>
      )}
      {/* Phase 1.2 Feather：发射 CTA 换装 3D DuoButton（Duo Green 4px 底边 + 提示音 + 撒花） */}
      {!hideLaunchButton && (
        <DuoButton
          variant="primary"
          size="lg"
          sound="correct"
          fullWidth
          data-testid="launch-button"
          onClick={handleLaunch}
          className="mt-2 rounded-2xl"
        >
          扣动扳机·一键发布
        </DuoButton>
      )}
    </motion.div>
  );
}
