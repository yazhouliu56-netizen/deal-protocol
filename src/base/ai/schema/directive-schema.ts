/**
 * P2-3 · Zod 意图校验核（Base 纯函数，红线 1+3，条文 #1/#2/#5/#10）。
 *
 * 硬化目标：
 *  - 动态品类白名单通过 `availableCategories` 注入（红线 3，零硬编码）；
 *  - 文本字段 `trim` + 控制字符过滤（\u0000-\u001F\u007F）；
 *  - `category` 非字符串或不在白名单安全归一为 `null`；
 *  - `need` / `slots` 字典过滤原型污染 `__proto__ / prototype / constructor`；
 *  - `confidence` / `scores` 钳制 `[0,1]`；
 *  - 非法/脏数据 0ms 返回 `fallback`，绝不抛未捕获（条文 #10）。
 */

import { z } from "zod";
import type {
  ICustomRequirements,
  INormalizedCustomIntent,
} from "../../../types/ammo-schema.ts";

// ---------------------------------------------------------------------------
// 清洗工具（纯函数，条文 #10）
// ---------------------------------------------------------------------------

const CONTROL_RE = /[\u0000-\u001F\u007F]/g;
function cleanString(v: string): string {
  return v.replace(CONTROL_RE, "").trim();
}

const PROTO_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export const NEED_KEYS: Array<"level" | "partySize" | "area" | "budget" | "style"> = [
  "level",
  "partySize",
  "area",
  "budget",
  "style",
];

// ---------------------------------------------------------------------------
// Directive（LlmDirective 兼容，条文 #2）
// ---------------------------------------------------------------------------

export type DirectiveSlots = Record<string, string | number>;

export interface DirectiveData {
  text: string;
  action: "ask" | "slots" | "done";
  category: string | null;
  need?: Partial<Record<"level" | "partySize" | "area" | "budget" | "style", string | number>>;
  slots?: DirectiveSlots;
  confidence?: number;
  scores?: Record<string, number>;
  budget?: number;
  time?: string;
}

export type ParseDirectiveResult =
  | { success: true; data: DirectiveData }
  | { success: false; error: z.ZodError; fallback: DirectiveData };

const FALLBACK_DIRECTIVE: DirectiveData = {
  text: "",
  action: "ask",
  category: null,
};

function sanitizeNeed(input: unknown): DirectiveData["need"] | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const src = input as Record<string, unknown>;
  const out: Record<string, string | number> = {};
  for (const key of NEED_KEYS) {
    if (PROTO_KEYS.has(key)) continue;
    // 使用 Object.prototype.hasOwnProperty 过滤原型污染通过 `in` 的假阳性
    if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
    const v = src[key];
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const cleaned = cleanString(v);
      if (cleaned) out[key] = cleaned;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
    }
    // 其他类型（对象/数组/布尔）直接丢弃，防类型污染
  }
  // 额外防御：若 need 本身被原型污染为数组原型，需确保输出不含污染键
  // 仅保留 NEED_KEYS，其他任意键丢弃（零硬编码品类，但 need 键白名单化）
  return Object.keys(out).length > 0 ? (out as DirectiveData["need"]) : undefined;
}

function sanitizeSlots(input: unknown): DirectiveSlots | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const src = input as Record<string, unknown>;
  const out: DirectiveSlots = {};
  for (const [k, v] of Object.entries(src)) {
    if (PROTO_KEYS.has(k)) continue;
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (typeof v === "string") {
      const cleaned = cleanString(v);
      if (cleaned) out[k] = cleaned;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeScores(input: unknown): Record<string, number> | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const src = input as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(src)) {
    if (PROTO_KEYS.has(k)) continue;
    if (typeof v === "number" && Number.isFinite(v)) {
      const clamped = Math.max(0, Math.min(1, v));
      out[k] = clamped;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function createDirectiveSchema(availableCategories?: string[]) {
  const categorySchema: z.ZodType<string | null> = z
    .unknown()
    .transform((val) => {
      if (typeof val !== "string") return null;
      const cleaned = cleanString(val);
      if (!cleaned) return null;
      if (
        availableCategories &&
        availableCategories.length > 0 &&
        !availableCategories.includes(cleaned)
      ) {
        return null;
      }
      return cleaned;
    })
    .pipe(z.union([z.string(), z.null()])) as z.ZodType<string | null>;

  // need / slots 采用 unknown 输入 + 自定义清洗，避免 Zod 原型污染直通
  const needInputSchema = z.unknown().transform((v) => sanitizeNeed(v));
  const slotsInputSchema = z.unknown().transform((v) => sanitizeSlots(v));

  const confidenceSchema = z.unknown().transform((v) => {
    if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
    return Math.max(0, Math.min(1, v));
  });

  const scoresSchema = z.unknown().transform((v) => sanitizeScores(v));

  const budgetSchema = z.unknown().transform((v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v.trim()))) return Number(v.trim());
    return undefined;
  });

  const timeSchema = z.unknown().transform((v) => {
    if (typeof v !== "string") return undefined;
    const c = cleanString(v);
    return c || undefined;
  });

  return z
    .object({
      text: z
        .unknown()
        .transform((v) => (typeof v === "string" ? cleanString(v) : ""))
        .pipe(z.string()),
      action: z
        .unknown()
        .transform((v) => (typeof v === "string" ? cleanString(v) : v))
        .pipe(z.enum(["ask", "slots", "done"])),
      category: categorySchema.optional().nullable().default(null).transform((v) => v ?? null),
      need: needInputSchema.optional(),
      slots: slotsInputSchema.optional(),
      confidence: confidenceSchema.optional(),
      scores: scoresSchema.optional(),
      budget: budgetSchema.optional(),
      time: timeSchema.optional(),
    })
    .passthrough()
    .transform((obj) => {
      // slots 归一到 need 的补充：若 slots 存在且 need 缺键，则合并（不覆盖 need 已有键）
      const out: DirectiveData = {
        text: obj.text,
        action: obj.action,
        category: obj.category ?? null,
      };
      const need = obj.need as DirectiveData["need"];
      const slots = obj.slots as DirectiveSlots | undefined;
      if (need || slots) {
        const merged: Record<string, string | number> = { ...(need ?? {}) };
        if (slots) {
          for (const [k, v] of Object.entries(slots)) {
            if (!(k in merged)) merged[k] = v;
            // 若 NEED_KEYS 内键已存在则保留 need 优先，防脏数据覆盖
            // 非 NEED_KEYS 的 slots 键也保留（动态槽位，零硬编码）
            if (!NEED_KEYS.includes(k as (typeof NEED_KEYS)[number]) && !(k in (need ?? {}))) {
              merged[k] = v;
            }
          }
        }
        if (Object.keys(merged).length > 0) out.need = merged as DirectiveData["need"];
      }
      if (obj.confidence !== undefined) out.confidence = obj.confidence as number;
      if (obj.scores !== undefined) out.scores = obj.scores as Record<string, number>;
      if (obj.budget !== undefined) out.budget = obj.budget as number;
      if (obj.time !== undefined) out.time = obj.time as string;
      // 处理 need 与 slots 的重复键：已在上面合并时保留 need 优先
      return out;
    });
}

export function safeParseDirective(
  input: unknown,
  opts?: { availableCategories?: string[] },
): ParseDirectiveResult {
  // 空输入安全兜底（条文 #10）
  if (input === null || input === undefined) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "invalid_type",
          expected: "object",
          received: input === null ? "null" : "undefined",
          path: [],
          message: "empty input",
        } as z.ZodIssue,
      ]),
      fallback: { ...FALLBACK_DIRECTIVE },
    };
  }

  let obj: unknown = input;

  // 字符串输入：兼容 LLM 原始输出（去围栏 + 首个 JSON 对象提取），物理等价于 parseDirective
  if (typeof input === "string") {
    const cleaned = input.replace(/```(?:json)?/gi, "").trim();
    if (!cleaned) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: "invalid_type",
            expected: "object",
            received: "string",
            path: [],
            message: "empty string",
          } as z.ZodIssue,
        ]),
        fallback: { ...FALLBACK_DIRECTIVE },
      };
    }
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: "invalid_type",
            expected: "object",
            received: "string",
            path: [],
            message: "no json object",
          } as z.ZodIssue,
        ]),
        fallback: { ...FALLBACK_DIRECTIVE },
      };
    }
    const slice = cleaned.slice(start, end + 1);
    try {
      obj = JSON.parse(slice);
    } catch (e) {
      return {
        success: false,
        error: new z.ZodError([
          {
            code: "invalid_type",
            expected: "object",
            received: "string",
            path: [],
            message: (e as Error).message,
          } as z.ZodIssue,
        ]),
        fallback: { ...FALLBACK_DIRECTIVE },
      };
    }
    // 防原型污染：JSON.parse("__proto__") 会污染原型，需深层过滤
    // 对顶层及 need/slots 的 __proto__ 已在 sanitize 中过滤，此处仅需确保 obj 本身非污染原型
    if (typeof obj === "object" && obj !== null) {
      // 使用 JSON 往返可剥离原型链上的污染，但保留可枚举自有属性
      // 更轻量：若存在 __proto__ 自有属性则删除
      const rec = obj as Record<string, unknown>;
      if (Object.prototype.hasOwnProperty.call(rec, "__proto__")) {
        delete rec["__proto__"];
      }
      if (Object.prototype.hasOwnProperty.call(rec, "constructor")) {
        delete rec["constructor"];
      }
      if (Object.prototype.hasOwnProperty.call(rec, "prototype")) {
        delete rec["prototype"];
      }
    }
  }

  // 非对象输入（如 number/boolean/array）直接兜底
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "invalid_type",
          expected: "object",
          received: Array.isArray(obj) ? "array" : typeof obj,
          path: [],
          message: "not an object",
        } as z.ZodIssue,
      ]),
      fallback: { ...FALLBACK_DIRECTIVE },
    };
  }

  // 预过滤顶层原型污染键，避免 Zod passthrough 透传
  const src = obj as Record<string, unknown>;
  if (
    Object.prototype.hasOwnProperty.call(src, "__proto__") ||
    Object.prototype.hasOwnProperty.call(src, "constructor") ||
    Object.prototype.hasOwnProperty.call(src, "prototype")
  ) {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (PROTO_KEYS.has(k)) continue;
      cleaned[k] = v;
    }
    obj = cleaned;
  }

  const schema = createDirectiveSchema(opts?.availableCategories);
  const result = schema.safeParse(obj);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error, fallback: { ...FALLBACK_DIRECTIVE } };
}

// ---------------------------------------------------------------------------
// CustomIntent（着装/年龄/性别，红线 1 纯函数）
// ---------------------------------------------------------------------------

export type CustomIntentInput = Partial<ICustomRequirements> & {
  cleanText?: string;
  isSensitiveCustomization?: boolean;
  blockedReason?: string | null;
  dressCode?: ICustomRequirements["dressCode"];
  ageRange?: [number, number];
  genderPreference?: "MALE" | "FEMALE" | "ANY";
};

export type ParseCustomIntentResult =
  | { success: true; data: INormalizedCustomIntent }
  | { success: false; error: z.ZodError; fallback: INormalizedCustomIntent };

const FALLBACK_CUSTOM_INTENT: INormalizedCustomIntent = {
  cleanText: "",
  isSensitiveCustomization: false,
  blockedReason: null,
};

const dressCodeSchema = z
  .object({
    required: z.boolean(),
    type: z.enum(["THEMED_MAID", "THEMED_COSPLAY", "FORMAL_UNIFORM", "CUSTOM"] as const),
    rawKeyword: z
      .string()
      .transform((v) => cleanString(v).slice(0, 8))
      .pipe(z.string().min(1).max(8)),
  })
  .strict()
  .optional();

const ageRangeSchema = z
  .tuple([z.number().int().min(14).max(100), z.number().int().min(14).max(100)])
  .refine(([a, b]) => a <= b && a >= 14 && b <= 100, { message: "invalid ageRange" })
  .optional();

const genderPreferenceSchema = z.enum(["MALE", "FEMALE", "ANY"]).optional();

const customIntentSchema = z
  .object({
    dressCode: dressCodeSchema,
    ageRange: ageRangeSchema,
    genderPreference: genderPreferenceSchema,
    cleanText: z
      .unknown()
      .transform((v) => (typeof v === "string" ? cleanString(v) : ""))
      .pipe(z.string())
      .optional(),
    isSensitiveCustomization: z.boolean().optional(),
    blockedReason: z.union([z.string().transform((v) => cleanString(v)), z.null()]).optional(),
  })
  .passthrough()
  .transform((obj) => {
    const out: INormalizedCustomIntent = {
      cleanText: obj.cleanText ?? "",
      isSensitiveCustomization: obj.isSensitiveCustomization ?? false,
      blockedReason: obj.blockedReason ?? null,
    };
    if (obj.dressCode) out.dressCode = obj.dressCode as ICustomRequirements["dressCode"];
    if (obj.ageRange) out.ageRange = obj.ageRange as [number, number];
    if (obj.genderPreference) out.genderPreference = obj.genderPreference as INormalizedCustomIntent["genderPreference"];
    return out;
  });

export function safeParseCustomIntent(input: unknown): ParseCustomIntentResult {
  if (input === null || input === undefined) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "invalid_type",
          expected: "object",
          received: input === null ? "null" : "undefined",
          path: [],
          message: "empty input",
        } as z.ZodIssue,
      ]),
      fallback: { ...FALLBACK_CUSTOM_INTENT },
    };
  }
  // 字符串输入：视为 rawPrompt 直接归一为 cleanText 的最简兜底（不抛异常）
  if (typeof input === "string") {
    const cleaned = cleanString(input);
    if (!cleaned) {
      return { success: true, data: { ...FALLBACK_CUSTOM_INTENT } };
    }
    // 字符串无法推导结构化字段，返回仅含 cleanText 的安全结构（条文 #10）
    return {
      success: true,
      data: {
        cleanText: cleaned,
        isSensitiveCustomization: false,
        blockedReason: null,
      },
    };
  }
  if (typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "invalid_type",
          expected: "object",
          received: Array.isArray(input) ? "array" : typeof input,
          path: [],
          message: "not an object",
        } as z.ZodIssue,
      ]),
      fallback: { ...FALLBACK_CUSTOM_INTENT },
    };
  }
  const src = input as Record<string, unknown>;
  // 顶层原型污染过滤
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (PROTO_KEYS.has(k)) continue;
    cleaned[k] = v;
  }
  const result = customIntentSchema.safeParse(cleaned);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error, fallback: { ...FALLBACK_CUSTOM_INTENT } };
}

// ---------------------------------------------------------------------------
// DecomposeDraft（AI 拆解草稿，红线 1 纯函数）
// ---------------------------------------------------------------------------

export interface DecomposeDraft {
  modules: Array<{ name: string; acceptance: string; weight: number }>;
  source?: "llm" | "mock";
  budget?: number;
  category?: string | null;
}

export type ParseDecomposeDraftResult =
  | { success: true; data: DecomposeDraft }
  | { success: false; error: z.ZodError; fallback: DecomposeDraft };

const FALLBACK_DECOMPOSE_DRAFT: DecomposeDraft = {
  modules: [],
};

const taskModuleSchema = z.object({
  name: z
    .string()
    .transform((v) => cleanString(v))
    .pipe(z.string().min(1).max(100)),
  acceptance: z
    .string()
    .transform((v) => cleanString(v))
    .pipe(z.string().min(1).max(500)),
  weight: z.number().int().min(0).max(100),
});

export const DecomposeDraftSchema = z
  .object({
    modules: z.array(taskModuleSchema).min(1),
    source: z.enum(["llm", "mock"]).optional(),
    budget: z.number().int().min(0).max(1000000).optional(),
    category: z
      .unknown()
      .transform((v) => (typeof v === "string" ? cleanString(v) : null))
      .pipe(z.union([z.string(), z.null()]))
      .optional()
      .nullable(),
  })
  .passthrough()
  .refine(
    (data) => {
      const total = data.modules.reduce((s, m) => s + m.weight, 0);
      return total === 100 || data.modules.length === 1;
    },
    { message: "weights sum must be 100 or single module", path: ["modules"] },
  )
  .transform((data) => ({
    modules: data.modules.map((m) => ({
      name: m.name,
      acceptance: m.acceptance,
      weight: m.weight,
    })),
    source: data.source,
    budget: data.budget,
    category: data.category ?? null,
  }));

export function safeParseDecomposeDraft(input: unknown): ParseDecomposeDraftResult {
  if (input === null || input === undefined || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: "invalid_type",
          expected: "object",
          received: input === null ? "null" : Array.isArray(input) ? "array" : typeof input,
          path: [],
          message: "not an object",
        } as z.ZodIssue,
      ]),
      fallback: { ...FALLBACK_DECOMPOSE_DRAFT },
    };
  }
  const src = input as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (PROTO_KEYS.has(k)) continue;
    cleaned[k] = v;
  }
  const result = DecomposeDraftSchema.safeParse(cleaned);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error, fallback: { ...FALLBACK_DECOMPOSE_DRAFT } };
}
