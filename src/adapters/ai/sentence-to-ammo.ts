/**
 * 旁路量产链（Microkernel 3.1 P2 · 适配器层 AI 编排）。
 *
 * 链路：compileAmmoPrompt（base 纯核）→ LLM 传输（注入式 completeFn，
 * 复用 base/ai/llm-port CompleteTextFn 端口；缺省直连 gateway decompose
 * 任务）→ JSON 提取 → validateAmmoConfig 质检 → 单次确定性修复 →
 * assembleAmmo 冻结 → registerDynamicAmmo 入池。
 *
 * 铁律：未过闸对象永不入池；失败一律结构化返回，永不抛错；
 * Auto-Repair 白名单 = 数值边界钳制 + 缺失别名回补 + 字段格式 Trim，
 * 严禁改 pricingModel.kind 与 forwardHooks（语义漂移宁可失败上报）。
 */

import {
  compileAmmoPrompt,
  COMPILER_PRICE_CEILING_CENTS,
  COMPILER_PRICE_FLOOR_CENTS,
} from "../../base/ai/prompt-compiler.ts";
import type { CompleteTextFn } from "../../base/ai/llm-port.ts";
import {
  registerDynamicAmmo,
  validateAmmoConfig,
} from "../../ammo/factory.ts";
import type {
  IAmmoDefinition,
  IHolographicAmmoConfig,
} from "../../types/ammo-schema.ts";
import { completeText as gatewayCompleteText } from "./gateway/engine.ts";

export type AmmoFailureDimension =
  | "PRICE"
  | "FUZE"
  | "HOOK"
  | "CLUSTER"
  | "TIMEOUT"
  | "PARSE"
  | "UNKNOWN";

export interface ISentenceToAmmoResult {
  ok: boolean;
  ammoId?: string;
  ammo?: IAmmoDefinition;
  errors?: string[];
  latencyMs: number;
  tokens?: { prompt: number; completion: number };
  failureDimension?: AmmoFailureDimension;
  autoRepaired?: boolean;
}

export interface IGenerateAmmoOpts {
  categoryHint?: string;
  /** 默认 8000ms（旁路 SLA）。 */
  timeoutMs?: number;
  /** 依赖注入（单测/CI Mock；缺省直连 gateway）。 */
  completeFn?: CompleteTextFn;
}

export const SENTENCE_TO_AMMO_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AMMO_COMPLETE_TIMEOUT")), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}

/** 传输层原文提取（string 直通 / {content} 形态兼容网关 TextOutcome）。 */
function extractContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw !== null && typeof raw === "object") {
    const c = (raw as Record<string, unknown>).content;
    if (typeof c === "string") return c;
  }
  return "";
}

/** Markdown 围栏剥离 + 首尾花括号截取 → JSON.parse。 */
export function extractAmmoJson(text: string): {
  ok: boolean;
  value?: Record<string, unknown>;
} {
  const stripped = text
    .replace(/```(?:json)?\s*/gi, "```")
    .replace(/```/g, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false };
  try {
    const value = JSON.parse(stripped.slice(start, end + 1)) as unknown;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return { ok: true, value: value as Record<string, unknown> };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

function normalizeVersion(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim().replace(/^v/i, "");
  const m = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(t);
  if (!m) return v;
  return `${m[1]}.${m[2] ?? "0"}.${m[3] ?? "0"}`;
}

/**
 * 单次确定性修复（白名单内）：数值钳制 + 别名回补 + 格式 Trim。
 * 返回 true 表示发生过改动（调用方标 autoRepaired）。
 */
export function autoRepairAmmoConfig(
  value: Record<string, unknown>,
  fallbackCategory: string,
): boolean {
  let touched = false;
  const touch = () => {
    touched = true;
  };
  for (const k of ["ammoId", "category", "version"] as const) {
    const v = value[k];
    if (typeof v === "string") {
      const t = v.trim();
      if (t !== v) {
        value[k] = t;
        touch();
      }
    }
  }
  const nv = normalizeVersion(value.version);
  if (nv !== value.version) {
    value.version = nv;
    touch();
  }
  const floor = value.minFloorPrice;
  if (typeof floor === "number" && Number.isFinite(floor)) {
    const clamped = Math.max(floor, COMPILER_PRICE_FLOOR_CENTS);
    if (clamped !== floor) {
      value.minFloorPrice = clamped;
      touch();
    }
  }
  const ceiling = value.maxCeilingPrice;
  if (typeof ceiling === "number" && Number.isFinite(ceiling)) {
    const clamped = Math.min(ceiling, COMPILER_PRICE_CEILING_CENTS);
    if (clamped !== ceiling) {
      value.maxCeilingPrice = clamped;
      touch();
    }
  }
  const ratio = value.maxSurchargeRatio;
  if (typeof ratio === "number" && Number.isFinite(ratio)) {
    const clamped = Math.min(Math.max(ratio, 0), 0.5);
    if (clamped !== ratio) {
      value.maxSurchargeRatio = clamped;
      touch();
    }
  }
  const aliases = value.aliases;
  if (!Array.isArray(aliases) || aliases.length === 0) {
    value.aliases = [fallbackCategory];
    touch();
  } else {
    const cleaned = aliases.filter(
      (a): a is string => typeof a === "string" && a.trim() !== "",
    );
    if (cleaned.length !== aliases.length) {
      value.aliases = cleaned.length > 0 ? cleaned : [fallbackCategory];
      touch();
    }
  }
  return touched;
}

/** 校验错误码 → 失败维度（确定性映射，供归因矩阵消费）。 */
export function toFailureDimension(errors: string[]): AmmoFailureDimension {
  const joined = errors.join("\n");
  if (/UNKNOWN_HOOK_OPERATOR/.test(joined)) return "HOOK";
  if (
    /SPLIT_|PRICE_|ANTI_GOUGING_|CANCELLATION_|PRICING_MODEL|FUNDING/.test(joined)
  ) {
    return "PRICE";
  }
  if (/FUZE_POLICY|FUZE/.test(joined)) return "FUZE";
  if (/IN_HOME_SAFETY_GATE|CLUSTER|POLICE|SAFETY/.test(joined)) return "CLUSTER";
  if (/INVALID_AMMO_ID|INVALID_CATEGORY|INVALID_VERSION|INVALID_AMMO_ALIAS/.test(joined)) {
    return "PARSE";
  }
  return "UNKNOWN";
}

function pickTokens(raw: unknown): { prompt: number; completion: number } | undefined {
  if (raw !== null && typeof raw === "object") {
    const u = (raw as Record<string, unknown>).usage ??
      (raw as Record<string, unknown>).tokens;
    if (u !== null && typeof u === "object") {
      const prompt = (u as Record<string, unknown>).prompt;
      const completion = (u as Record<string, unknown>).completion;
      if (typeof prompt === "number" && typeof completion === "number") {
        return { prompt, completion };
      }
    }
  }
  return undefined;
}

/**
 * 一句话量产（永不抛错；所有失败走结构化返回）。
 */
export async function generateAmmoFromSentence(
  sentence: string,
  opts?: IGenerateAmmoOpts,
): Promise<ISentenceToAmmoResult> {
  const startedAt = Date.now();
  const timeoutMs = opts?.timeoutMs ?? SENTENCE_TO_AMMO_TIMEOUT_MS;
  const finish = (
    rest: Omit<ISentenceToAmmoResult, "latencyMs">,
  ): ISentenceToAmmoResult => ({ ...rest, latencyMs: Date.now() - startedAt });

  if (typeof sentence !== "string" || sentence.trim() === "") {
    return finish({ ok: false, errors: ["EMPTY_SENTENCE"], failureDimension: "PARSE" });
  }

  const compiled = compileAmmoPrompt(sentence, {
    categoryHint: opts?.categoryHint,
  });

  let raw: unknown;
  try {
    const transport: CompleteTextFn =
      opts?.completeFn ??
      (async (args) =>
        gatewayCompleteText({
          task: "decompose",
          messages: args.messages,
          temperature: args.temperature ?? 0,
          maxTokens: args.maxTokens ?? 2048,
          timeoutMs: args.timeoutMs ?? timeoutMs,
        }));
    raw = await withTimeout(
      transport({
        task: "decompose",
        messages: [
          { role: "system", content: compiled.systemPrompt },
          { role: "user", content: compiled.userPrompt },
        ],
        temperature: 0,
        maxTokens: 2048,
        timeoutMs,
      }),
      timeoutMs,
    );
  } catch {
    return finish({
      ok: false,
      errors: ["AMMO_COMPLETE_TIMEOUT"],
      failureDimension: "TIMEOUT",
    });
  }

  const tokens = pickTokens(raw);
  const content = extractContent(raw);
  if (!content) {
    return finish({
      ok: false,
      errors: ["EMPTY_COMPLETION"],
      failureDimension: "PARSE",
      ...(tokens ? { tokens } : {}),
    });
  }

  const parsed = extractAmmoJson(content);
  if (!parsed.ok || !parsed.value) {
    return finish({
      ok: false,
      errors: ["AMMO_JSON_UNPARSEABLE"],
      failureDimension: "PARSE",
      ...(tokens ? { tokens } : {}),
    });
  }

  const candidate = parsed.value;
  let verdict = validateAmmoConfig(candidate as unknown as IHolographicAmmoConfig);
  let autoRepaired = false;
  if (!verdict.ok) {
    const repaired = autoRepairAmmoConfig(candidate, compiled.targetCategory);
    if (repaired) {
      autoRepaired = true;
      verdict = validateAmmoConfig(candidate as unknown as IHolographicAmmoConfig);
    }
  }
  if (!verdict.ok) {
    const errors = verdict.errors;
    return finish({
      ok: false,
      errors,
      failureDimension: toFailureDimension(errors),
      autoRepaired,
      ...(tokens ? { tokens } : {}),
    });
  }

  const registered = registerDynamicAmmo(candidate as unknown as IHolographicAmmoConfig);
  if (!registered.ok) {
    return finish({
      ok: false,
      errors: registered.errors,
      failureDimension: "UNKNOWN",
      autoRepaired,
      ...(tokens ? { tokens } : {}),
    });
  }

  return finish({
    ok: true,
    ammoId: registered.ammo.ammoId,
    ammo: registered.ammo as IAmmoDefinition,
    autoRepaired,
    ...(tokens ? { tokens } : {}),
  });
}
