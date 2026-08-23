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

interface PublishFormSchemaBridgeProps {
  fields: DraftFormField[];
  /** 当前选定弹药的 ammoId（标题行展示用；未选品类时 undefined）。 */
  ammoId?: string;
  bizParams: Record<string, unknown>;
  onBizParamsChange: Dispatch<React.SetStateAction<Record<string, unknown>>>;
}

/**
 * P1-5 表单 Schema 渲染桥接：100% 由弹药 D8 formSchema 驱动，零品类硬编码分支。
 * （PublishSheet 内嵌渲染段子组件化搬移，selector/DOM 零漂移。）
 */
export default function PublishFormSchemaBridge({
  fields,
  ammoId,
  bizParams,
  onBizParamsChange: setBizParams,
}: PublishFormSchemaBridgeProps) {
  if (fields.length === 0) return null;
  return (
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
  );
}
