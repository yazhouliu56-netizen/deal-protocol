"use client";
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
  compact = false,
}: {
  fields: FormField[];
  values: FormValues;
  onChange: (next: FormValues) => void;
  submitLabel?: string;
  onSubmit?: (values: FormValues) => void;
  compact?: boolean;
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
            <label className="flex items-center gap-1 text-[10px] text-white/60">
              {n.label}
              {n.required && <span className="text-red-400">*</span>}
            </label>
            {n.type === "input" && (
              <input
                value={String(n.value ?? "")}
                onChange={(e) => set(n.key, e.target.value)}
                placeholder={n.placeholder}
                className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-[10px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-brandPurple/50"
              />
            )}
            {n.type === "textarea" && (
              <textarea
                value={String(n.value ?? "")}
                onChange={(e) => set(n.key, e.target.value)}
                placeholder={n.placeholder}
                className="w-full rounded-lg bg-white/[0.06] border border-white/10 px-2.5 py-1.5 text-[10px] text-white/80 placeholder:text-white/25 focus:outline-none focus:border-brandPurple/50 resize-none"
              />
            )}
            {n.type === "picker" && (
              <select
                value={String(n.value ?? "")}
                onChange={(e) => set(n.key, e.target.value)}
                className="w-full rounded-lg bg-white/[0.08] border border-white/10 px-2 py-1.5 text-[10px] text-white/80 focus:outline-none focus:border-brandPurple/50 [&>option]:bg-black"
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
                className={`w-full px-2.5 py-1.5 rounded-lg border text-[10px] font-bold text-left transition-all ${
                  n.value
                    ? "bg-brandPurple/20 border-brandPurple/50 text-brandPurple-foreground"
                    : "bg-white/[0.04] border-white/10 text-white/50"
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
                      className={`px-2.5 py-1 rounded-full border text-[9.5px] transition-all ${
                        on
                          ? "bg-brandCyan/20 border-brandCyan/50 text-brandCyan"
                          : "bg-white/[0.04] border-white/10 text-white/50"
                      }`}
                    >
                      {on ? "✓ " : ""}{o.label}
                    </button>
                  );
                })}
              </div>
            )}
            {n.hint && !err && (
              <p className="text-[8.5px] text-white/30">{n.hint}</p>
            )}
            {err && (
              <p className="text-[8.5px] text-red-300/90">{err.message}</p>
            )}
          </div>
        );
      })}
      {onSubmit && (
        <button
          type="button"
          disabled={!ready}
          onClick={() => onSubmit(values)}
          className={`w-full py-2 rounded-xl text-[10.5px] font-bold transition-all ${
            compact ? "" : ""
          } ${
            ready
              ? "btn-primary glow-purple-strong active:scale-95"
              : "bg-white/[0.04] border border-white/10 text-white/30"
          }`}
        >
          {submitLabel}
        </button>
      )}
    </div>
  );
}
