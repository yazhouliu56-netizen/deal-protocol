/**
 * 动态表单渲染引擎（ADR-0015，缺口 N2）。
 * Schema 声明字段 → 值校验 → 渲染描述。与具体 UI 框架解耦：
 * 产出一个"描述器"供任意端（web React / mobile RN / 原生）渲染。
 * 弹药/业务侧填 Schema 即可出新表单，不改引擎。
 */

export type FieldType = "text" | "number" | "select" | "multiselect" | "boolean" | "textarea";

export interface FieldOption {
  label: string;
  value: string;
}

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: FieldOption[];
  /** 数字范围（number 类型）。 */
  min?: number;
  max?: number;
  /** 正则校验提示（text）。 */
  pattern?: string;
  hint?: string;
}

export type FormValue = string | number | boolean | string[];
export type FormValues = Record<string, FormValue>;

export interface FieldError {
  key: string;
  message: string;
}

/** 校验：required / pattern / 范围。返回空 = 通过。 */
export function validateField(f: FormField, v: FormValue): FieldError | null {
  if (v === undefined || v === null || v === "") {
    return f.required ? { key: f.key, message: `${f.label}为必填` } : null;
  }
  if (f.type === "number") {
    const n = Number(v);
    if (Number.isNaN(n)) return { key: f.key, message: `${f.label}必须是数字` };
    if (f.min !== undefined && n < f.min) return { key: f.key, message: `${f.label}不能小于 ${f.min}` };
    if (f.max !== undefined && n > f.max) return { key: f.key, message: `${f.label}不能大于 ${f.max}` };
  }
  if (f.type === "text" && f.pattern) {
    const re = new RegExp(f.pattern);
    if (!re.test(String(v))) return { key: f.key, message: `${f.label}格式不正确` };
  }
  if (f.type === "select" && f.options && !f.options.some((o) => o.value === v)) {
    return { key: f.key, message: `请选择有效的${f.label}` };
  }
  if (f.type === "multiselect") {
    const arr = Array.isArray(v) ? v : [];
    if (f.required && arr.length === 0) return { key: f.key, message: `${f.label}至少选一项` };
  }
  return null;
}

export function validateForm(fields: FormField[], values: FormValues): FieldError[] {
  const errs: FieldError[] = [];
  for (const f of fields) {
    const e = validateField(f, values[f.key]);
    if (e) errs.push(e);
  }
  return errs;
}

/** 渲染描述器：把 schema 转成"任意端可渲染"的中性指令。 */
export interface RenderNode {
  key: string;
  type: "input" | "textarea" | "picker" | "checkbox" | "group";
  label: string;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  value: FormValue;
  hint?: string;
}

export function toRenderNodes(fields: FormField[], values: FormValues): RenderNode[] {
  const typeMap: Record<FieldType, RenderNode["type"]> = {
    text: "input",
    number: "input",
    textarea: "textarea",
    select: "picker",
    multiselect: "group",
    boolean: "checkbox",
  };
  return fields.map((f) => ({
    key: f.key,
    type: typeMap[f.type],
    label: f.label,
    required: f.required,
    placeholder: f.placeholder,
    options: f.options,
    value: values[f.key],
    hint: f.hint,
  }));
}

/** 简单 diff：值是否可提交（无 error 且必填填满）。 */
export function isSubmittable(fields: FormField[], values: FormValues): boolean {
  return validateForm(fields, values).length === 0;
}