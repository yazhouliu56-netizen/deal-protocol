"use client";
import DuoButton from "@/components/ui/DuoButton";
/**
 * 动态表单渲染端（ADR-0015，N2 接线）：消费 base/form 的描述器/校验，
 * 渲染 schema 声明的表单。弹药/业务侧填 FormField[] 即出新表单，
 * 不改渲染器 —— 与 mobile RN 端共享同一描述器契约。
 */
import type { FormField, FormValue, FormValues, RenderNode } from "@/base/form/dynamicForm";
import { isSubmittable, toRenderNodes, validateForm } from "@/base/form/dynamicForm";

export type { FormField, FormValues };

export default function DynamicFormView({
  fields,
  values,
  onChange,
  submitLabel = "提交",
  onSubmit,
}: {
  fields: FormField[];
  values: FormValues;
  onChange: (next: FormValues) => void;
  submitLabel?: string;
  onSubmit?: (values: FormValues) => void;
}) {
  const nodes: RenderNode[] = toRenderNodes(fields, values);
  const errors = validateForm(fields, values);
  const ready = isSubmittable(fields, values);
  const set = (key: string, v: FormValue) => onChange({ ...values, [key]: v });

  return (
    <div className="space-y-2">
      {nodes.map((n) => {
        const err = errors.find((e) => e.key === n.key);
        return (
          <div key={n.key} className="space-y-1">
            <label className="flex items-center gap-1 text-xs text-[#777777]">
              {n.label}
              {n.required && <span className="text-[#ea2b2b]">*</span>}
            </label>
            {n.type === "input" && (
              <input
                value={String(n.value ?? "")}
                onChange={(e) => set(n.key, e.target.value)}
                placeholder={n.placeholder}
                className="w-full rounded-lg bg-white border-2 border-[#e5e5e5] px-2.5 py-1.5 text-xs text-[#4b4b4b] placeholder:text-[#afafaf] focus:outline-none focus:border-[#1cb0f6]"
              />
            )}
            {n.type === "textarea" && (
              <textarea
                value={String(n.value ?? "")}
                onChange={(e) => set(n.key, e.target.value)}
                placeholder={n.placeholder}
                className="w-full rounded-lg bg-white border-2 border-[#e5e5e5] px-2.5 py-1.5 text-xs text-[#4b4b4b] placeholder:text-[#afafaf] focus:outline-none focus:border-[#1cb0f6] resize-none"
              />
            )}
            {n.type === "picker" && (
              <select
                value={String(n.value ?? "")}
                onChange={(e) => set(n.key, e.target.value)}
                className="w-full rounded-lg bg-white border-2 border-[#e5e5e5] px-2 py-1.5 text-xs text-[#4b4b4b] focus:outline-none focus:border-[#1cb0f6]"
              >
                <option value="" disabled>
                  请选择
                </option>
                {(n.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}
            {n.type === "checkbox" && (
              <button
                type="button"
                onClick={() => set(n.key, !n.value)}
                className={`w-full px-2.5 py-1.5 rounded-lg border-2 text-xs font-bold text-left transition-all ${
                  n.value
                    ? "bg-[#58cc02]/10 border-[#58cc02]/50 text-[#357a00]"
                    : "bg-[#f7f7f7] border-[#e5e5e5] text-[#afafaf]"
                }`}
              >
                {n.value ? "✓ 已开启" : "未开启"}
              </button>
            )}
            {n.type === "group" && (
              <div className="flex flex-wrap gap-1.5">
                {(n.options ?? []).map((o) => {
                  const arr = Array.isArray(n.value) ? n.value : [];
                  const on = arr.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        set(
                          n.key,
                          on ? arr.filter((v) => v !== o.value) : [...arr, o.value]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full border-2 text-xs transition-all ${
                        on
                          ? "bg-[#1cb0f6]/10 border-[#1cb0f6]/50 text-[#0a6ea8]"
                          : "bg-[#f7f7f7] border-[#e5e5e5] text-[#afafaf]"
                      }`}
                    >
                      {on ? "✓ " : ""}{o.label}
                    </button>
                  );
                })}
              </div>
            )}
            {n.hint && !err && (
              <p className="text-xs text-[#afafaf]">{n.hint}</p>
            )}
            {err && (
              <p className="text-xs text-[#ea2b2b]">{err.message}</p>
            )}
          </div>
        );
      })}
      {onSubmit && (
        <DuoButton
          type="button"
          disabled={!ready}
          onClick={() => onSubmit(values)}
          variant="primary"
          size="sm"
          fullWidth
        >
          {submitLabel}
        </DuoButton>
      )}
    </div>
  );
}
