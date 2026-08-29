"use client";
import type { Dispatch } from "react";
import {
  type DraftFormField,
} from "../DynamicDraftCard";
import type { PricingModel } from "@/types/ammo-schema";

/** P1-5：formSchema 字段 → 默认参数快照（纯函数；value 非空才入快照，零硬编码）。 */
export function defaultParamsOf(fields: DraftFormField[]): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.value !== "" && f.value !== undefined && f.value !== null) {
      next[f.key] = f.value;
    }
  }
  return next;
}

/** P1 第 4 步：弹药起步底价投影（组件层消费 D2，零硬编码；未识别结构 → 0）。 */
export function pricingFloorYuan(model: PricingModel): number {
  switch (model.kind) {
    case "HOURLY":
      return model.rateYuan * model.minHours;
    case "PER_SEAT":
      return model.perSeatYuan * model.minSeats;
    case "FORMULA":
      return Number(model.params?.baseRate ?? 0);
    case "FIXED":
      return model.amountYuan;
  }
}

/**
 * Microkernel 4.4 批次 2 · 词块化无键盘发单（Word Bank Ingestion · 宪法 #5 引信跟弹药）：
 * 时段/时长/预算三类一键点选词块，全部由弹药 D2 计价模型派生，零品类价格硬编码。
 */

/** 时段词块（表驱动常量；回填 PublishSheet time 自由文本，零格式约定无 422 风险）。 */
export const TIME_WORD_BLOCKS: { label: string; text: string }[] = [
  { label: "尽快上门", text: "尽快上门" },
  { label: "今晚 19:00", text: "今晚 19:00" },
  { label: "明天上午", text: "明天上午" },
  { label: "周末下午", text: "周末下午" },
];

/** 预算三档派生（参谋部裁决锁定公式）：经济 = floor / 推荐 = ceil(floor×1.5) / 加急 = floor×2。 */
export function budgetWordBlocks(
  model: PricingModel,
): { label: string; yuan: number }[] {
  const floor = pricingFloorYuan(model);
  if (floor <= 0) return [];
  return [
    { label: `经济 ¥${floor}`, yuan: floor },
    { label: `推荐 ¥${Math.ceil(floor * 1.5)}`, yuan: Math.ceil(floor * 1.5) },
    { label: `加急 ¥${floor * 2}`, yuan: floor * 2 },
  ];
}

/** 时长词块：仅 HOURLY 计价弹药渲染（宪法 #5），yuan = rateYuan × hours 预算联动；非 HOURLY → null。 */
export function durationWordBlocks(
  model: PricingModel,
): { label: string; hours: number; yuan: number }[] | null {
  if (model.kind !== "HOURLY") return null;
  return [
    { label: "1小时", hours: 1, yuan: model.rateYuan * 1 },
    { label: "2小时", hours: 2, yuan: model.rateYuan * 2 },
    { label: "半天 (4h)", hours: 4, yuan: model.rateYuan * 4 },
    { label: "全天 (8h)", hours: 8, yuan: model.rateYuan * 8 },
  ];
}

interface PublishFormSchemaBridgeProps {
  fields: DraftFormField[];
  /** 当前选定弹药的 ammoId（标题行展示用；未选品类时 undefined）。 */
  ammoId?: string;
  bizParams: Record<string, unknown>;
  onBizParamsChange: Dispatch<React.SetStateAction<Record<string, unknown>>>;
  /** 当前弹药计价模型（词块派生源；缺省 = 词块区不渲染，既有调用零变化）。 */
  pricingModel?: PricingModel;
  /** 时段词块回填（PublishSheet setTime 真实 state 绑定）。 */
  onBackfillTime?: (text: string) => void;
  /** 预算/时长词块回填（PublishSheet setBudget 真实 state 绑定，时长档 = rateYuan × h 联动）。 */
  onBackfillBudget?: (yuan: number) => void;
}

/** 词块胶囊通用样式（圆润高饱和 3D 触感，48px 触控靶区）。 */
const WORD_PILL_CLASS =
  "px-3.5 min-h-10 rounded-full text-xs font-bold glass-panel-interactive text-white/75 hover:text-white border border-white/15 border-b-2 active:translate-y-px transition-[transform,color]";

/**
 * P1-5 表单 Schema 渲染桥接：100% 由弹药 D8 formSchema 驱动，零品类硬编码分支。
 * （PublishSheet 内嵌渲染段子组件化搬移，selector/DOM 零漂移。）
 * Microkernel 4.4 批次 2：增补词块化无键盘发单区（时段/时长/预算，弹药派生零硬编码）。
 */
export default function PublishFormSchemaBridge({
  fields,
  ammoId,
  bizParams,
  onBizParamsChange: setBizParams,
  pricingModel,
  onBackfillTime,
  onBackfillBudget,
}: PublishFormSchemaBridgeProps) {
  const budgetBlocks = pricingModel ? budgetWordBlocks(pricingModel) : [];
  const durationBlocks = pricingModel ? durationWordBlocks(pricingModel) : null;
  const wordBankVisible =
    Boolean(pricingModel) && Boolean(onBackfillTime || onBackfillBudget);
  if (fields.length === 0 && !wordBankVisible) return null;
  return (
    <>
      {wordBankVisible && pricingModel && (
        <div
          className="mb-3 rounded-2xl bg-white/[0.04] border border-white/10 p-3"
          data-testid="publish-word-bank"
          data-word-bank
        >
          <div className="text-xs font-bold text-white/85 mb-2 flex items-center gap-1.5">
            ⚡ 一键词块 <span className="text-white/35 font-normal">· 点选即填，免键盘</span>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {TIME_WORD_BLOCKS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  className={WORD_PILL_CLASS}
                  data-word-kind="time"
                  data-word-label={b.label}
                  onClick={() => onBackfillTime?.(b.text)}
                >
                  🕐 {b.label}
                </button>
              ))}
            </div>
            {durationBlocks && (
              <div className="flex flex-wrap gap-1.5">
                {durationBlocks.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    className={WORD_PILL_CLASS}
                    data-word-kind="duration"
                    data-word-label={b.label}
                    onClick={() => onBackfillBudget?.(b.yuan)}
                  >
                    ⏱️ {b.label}
                  </button>
                ))}
              </div>
            )}
            {budgetBlocks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {budgetBlocks.map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    className={WORD_PILL_CLASS}
                    data-word-kind="budget"
                    data-word-label={b.label}
                    onClick={() => onBackfillBudget?.(b.yuan)}
                  >
                    💰 {b.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {fields.length > 0 && (
        <div className="mb-3 rounded-2xl bg-white/[0.04] border border-white/10 p-3" data-testid="publish-dynamic-form" data-dynamic-form>
      <div className="text-xs font-bold text-white/85 mb-2 flex items-center gap-1.5">📋 方案专属表单 <span className="text-white/35 font-normal">· {ammoId} · {fields.length} 项</span></div>
      <div className="space-y-2">
        {fields.map((field) => {
          const val = bizParams[field.key];
          const strVal = val === undefined || val === null ? "" : String(val);
          if (field.type === "enum" && field.options && field.options.length > 0) {
            return (
              <label key={field.key} className="block">
                <span className="text-xs font-semibold text-white/70 flex items-center gap-1 mb-1">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </span>
                <select
                  value={strVal}
                  onChange={(e) => setBizParams((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  aria-label={field.label}
                  name={field.key}
                  data-field={field.key}
                  className="w-full min-h-[48px] rounded-2xl bg-white/[0.06] border border-white/10 px-3.5 text-xs text-white/90 outline-none focus:border-brandPurple/50"
                >
                  <option value="" className="bg-[#1a1a2e]">请选择{field.label}</option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt} className="bg-[#1a1a2e]">{opt}</option>
                  ))}
                </select>
              </label>
            );
          }
          if (field.type === "number") {
            return (
              <label key={field.key} className="block">
                <span className="text-xs font-semibold text-white/70 flex items-center gap-1 mb-1">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  value={strVal}
                  onChange={(e) => {
                    const v = e.target.value;
                    setBizParams((prev) => ({ ...prev, [field.key]: v === "" ? "" : Number(v) }));
                  }}
                  placeholder={`请输入${field.label}`}
                  aria-label={field.label}
                  name={field.key}
                  data-field={field.key}
                  className="w-full min-h-[48px] rounded-2xl bg-white/[0.06] border border-white/10 px-3.5 text-xs text-white/90 placeholder:text-white/25 outline-none focus:border-brandPurple/50"
                />
              </label>
            );
          }
          if (field.type === "boolean") {
            return (
              <label key={field.key} className="flex items-center justify-between min-h-[48px] rounded-2xl bg-white/[0.04] border border-white/10 px-3.5">
                <span className="text-xs font-semibold text-white/70 flex items-center gap-1">
                  {field.label} {field.required && <span className="text-red-400">*</span>}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(val)}
                  aria-label={field.label}
                  name={field.key}
                  data-field={field.key}
                  onClick={() => setBizParams((prev) => ({ ...prev, [field.key]: !Boolean(prev[field.key]) }))}
                  className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${Boolean(val) ? "bg-emerald-400/70" : "bg-white/15"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${Boolean(val) ? "left-[22px]" : "left-0.5"}`} />
                </button>
              </label>
            );
          }
          return (
            <label key={field.key} className="block">
              <span className="text-xs font-semibold text-white/70 flex items-center gap-1 mb-1">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </span>
              <input
                value={strVal}
                onChange={(e) => setBizParams((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={`请输入${field.label}`}
                aria-label={field.label}
                name={field.key}
                data-field={field.key}
                className="w-full min-h-[48px] rounded-2xl bg-white/[0.06] border border-white/10 px-3.5 text-xs text-white/90 placeholder:text-white/25 outline-none focus:border-brandPurple/50"
              />
            </label>
          );
        })}
      </div>
        </div>
      )}
    </>
  );
}
