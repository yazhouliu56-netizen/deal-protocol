/**
 * 提示词编译器（Prompt Compiler · Microkernel 3.1 P1）。
 *
 * 纯确定性函数（宪法 #1 底座优先 · 红线 3 单向依赖）：0 I/O、0 网络、
 * 0 时钟内生（时间一律由调用方经 `opts.now` 注入），输入口语文本 →
 * 脱敏清洗 → 类目推导 → 强约束标准提示词组装。
 *
 * 职责边界：只产提示词结构，不调 LLM、不碰注册表、不执行钩子。
 * 白名单（钩子/运力池/计价/引信）与价格护栏与
 * `docs/GROWTH-SEED-20.md` 靶心字典同源，LLM 输出仍须过
 * `validateAmmoConfig` 确定性闸门方可入池。
 */

import { detectContactLeaks } from "../risk/contact-leak.ts";
import type { IHolographicAmmoConfig } from "../../types/ammo-schema.ts";
import { IMPACT_FUZE_TEMPLATE } from "../../types/fuze-policy.ts";

/** 编译器标准输出（P1 Spec 冻结契约）。 */
export interface ICompiledPromptOutput {
  systemPrompt: string;
  userPrompt: string;
  targetCategory: string;
  sanitizedInput: string;
  detectedLeak: boolean;
  constraints: {
    allowedHooks: string[];
    allowedClusters: string[];
    allowedPricingKinds: string[];
    allowedFuzes: string[];
    priceBounds: { floorCents: number; ceilingCents: number };
  };
}

export interface ICompileAmmoPromptOpts {
  /** 显式类目提示（命中合法类目时优先于关键词推导）。 */
  categoryHint?: string;
  /** 调用方注入的参考时间戳（毫秒；缺省 0，函数内禁 Date.now）。 */
  now?: number;
}

/** 六算子白名单（HOOK_OPERATOR_REGISTRY 键名，严禁虚构）。 */
export const COMPILER_ALLOWED_HOOKS: readonly string[] = [
  "ArrivalCheckHook",
  "CleaningCheckHook",
  "OnsiteQuoteHook",
  "AASplitSettleHook",
  "PrivacyShieldHook",
  "DepartureFinishHook",
];

/** 合法运力池枚举。 */
export const COMPILER_ALLOWED_CLUSTERS: readonly string[] = [
  "C1_MOBILITY",
  "C2_IN_HOME",
  "C3_TECH_B2B",
];

/** 合法计价模型枚举。 */
export const COMPILER_ALLOWED_PRICING_KINDS: readonly string[] = [
  "FIXED",
  "HOURLY",
  "PER_SEAT",
  "FORMULA",
];

/** 合法引信模板（P0 底线：仅现役三模板）。 */
export const COMPILER_ALLOWED_FUZES: readonly string[] = [
  "IMPACT_FUZE_TEMPLATE",
  "IMPACT_INHOME_FUZE_TEMPLATE",
  "DELAY_FUZE_TEMPLATE",
];

/** 价格护栏（分）：地板 30 元，天花板 2000 元，与 P0 靶心同源。 */
export const COMPILER_PRICE_FLOOR_CENTS = 3000;
export const COMPILER_PRICE_CEILING_CENTS = 200000;

/** 合法目标类目（含通用兜底）。 */
const KNOWN_CATEGORIES: readonly string[] = [
  "pc-assembly",
  "home-organizing",
  "general",
];

const PC_ASSEMBLY_KEYWORDS: readonly string[] = [
  "电脑",
  "装机",
  "清灰",
  "硅脂",
  "水冷",
  "开机",
  "点不亮",
  "风扇",
  "显卡",
  "主板",
  "散件",
  "布线",
  "网吧",
  "黑苹果",
  "烤机",
  "内存",
  "硬盘",
];

const HOME_ORGANIZING_KEYWORDS: readonly string[] = [
  "衣柜",
  "收纳",
  "整理",
  "衣橱",
  "鞋柜",
  "搬家",
  "还原",
  "玩具",
  "儿童房",
  "换季",
  "亚克力",
  "衣帽间",
  "搬完",
  "堆",
];

/**
 * Few-Shot 内联骨架（纯数据字面量，零 import @/ammo —— 红线 3）。
 * 取 P0 `pc-assembly-v1` 靶心最小合法形，引信复用 types 模板常量。
 */
const FEW_SHOT_SKELETON: IHolographicAmmoConfig = {
  ammoId: "pc-assembly-v1",
  category: "pc-assembly",
  version: "v1.0.0",
  supplyCluster: "C3_TECH_B2B",
  pricingModel: { kind: "FIXED", amountYuan: 80 },
  minFloorPrice: COMPILER_PRICE_FLOOR_CENTS,
  maxCeilingPrice: COMPILER_PRICE_CEILING_CENTS,
  maxSurchargeRatio: 0.5,
  fuzePolicy: { ...IMPACT_FUZE_TEMPLATE, fuzeId: "fuze-pc-assembly" },
  requiredSensors: ["WATERMARK_CAMERA"],
  forwardHooks: ["ArrivalCheckHook", "OnsiteQuoteHook"],
  fundingMode: "full_prepay",
  autoAcceptanceTimeoutHours: 24,
  theme: "default",
  cockpitSlot: "dyn",
  aliases: ["电脑装机", "上门修电脑"],
};

function countHits(text: string, keywords: readonly string[]): number {
  let hits = 0;
  for (const kw of keywords) {
    if (kw && text.includes(kw)) hits += 1;
  }
  return hits;
}

/** 关键词推导目标类目（确定性计分，平局回落 general）。 */
function inferCategory(sanitized: string, hint?: string): string {
  if (hint && (KNOWN_CATEGORIES as readonly string[]).includes(hint)) {
    return hint;
  }
  const pc = countHits(sanitized, PC_ASSEMBLY_KEYWORDS);
  const ho = countHits(sanitized, HOME_ORGANIZING_KEYWORDS);
  if (pc === 0 && ho === 0) return "general";
  if (pc > ho) return "pc-assembly";
  if (ho > pc) return "home-organizing";
  return "general";
}

function defaultNoteFor(category: string): string {
  if (category === "pc-assembly") {
    return "类目缺省：FIXED 装机费 80 元（检测费 40 元），周末时段，自备工具。";
  }
  if (category === "home-organizing") {
    return "类目缺省：HOURLY 60 元/时，起步 2 小时（120 元），周末默认时段。";
  }
  return "类目缺省：按通用兜底，须显式声明计价模型与运力池。";
}

function buildSystemPrompt(): string {
  const hooks = COMPILER_ALLOWED_HOOKS.join("、");
  const clusters = COMPILER_ALLOWED_CLUSTERS.join("、");
  const kinds = COMPILER_ALLOWED_PRICING_KINDS.join("、");
  const fuzes = COMPILER_ALLOWED_FUZES.join("、");
  return [
    "你是 O2O 弹药配置生成器，只输出合法 IHolographicAmmoConfig JSON，不输出任何解释文字。",
    `forwardHooks 只能从白名单六算子中选择：${hooks}。严禁虚构钩子名。`,
    `supplyCluster 只能三选一：${clusters}。`,
    `pricingModel.kind 只能四选一：${kinds}。formulaId 必须已存在，严禁现编。`,
    `fuzePolicy 只能引用三模板之一：${fuzes}，允许改 fuzeId，不许改模板语义。`,
    `成交价护栏（分）：不得低于 ${COMPILER_PRICE_FLOOR_CENTS}，不得高于 ${COMPILER_PRICE_CEILING_CENTS}。缺字段宁可走缺省，不许脑补价格与门槛。`,
    "输入已脱敏，不含真实联系方式；输出同样严禁包含手机号、微信号、门牌明文。",
    `Few-Shot 合法骨架（照此形状输出）：${JSON.stringify(FEW_SHOT_SKELETON)}`,
  ].join("\n");
}

/**
 * 编译口语需求为标准提示词（纯函数：同输入同输出，无副作用）。
 */
export function compileAmmoPrompt(
  rawInput: string,
  opts?: ICompileAmmoPromptOpts,
): ICompiledPromptOutput {
  const original = typeof rawInput === "string" ? rawInput : "";
  const leak = detectContactLeaks(original);
  const sanitizedInput = leak.maskedText;
  const detectedLeak = leak.hasLeak;
  const targetCategory = inferCategory(sanitizedInput, opts?.categoryHint);
  const refTime = opts?.now ?? 0;
  const constraints: ICompiledPromptOutput["constraints"] = {
    allowedHooks: [...COMPILER_ALLOWED_HOOKS],
    allowedClusters: [...COMPILER_ALLOWED_CLUSTERS],
    allowedPricingKinds: [...COMPILER_ALLOWED_PRICING_KINDS],
    allowedFuzes: [...COMPILER_ALLOWED_FUZES],
    priceBounds: {
      floorCents: COMPILER_PRICE_FLOOR_CENTS,
      ceilingCents: COMPILER_PRICE_CEILING_CENTS,
    },
  };
  const userPrompt = [
    `需求（已脱敏）：${sanitizedInput}`,
    `推导类目：${targetCategory}`,
    defaultNoteFor(targetCategory),
    `价格护栏（分）：${constraints.priceBounds.floorCents}~${constraints.priceBounds.ceilingCents}；现场增项上限比例 0.5。`,
    `参考时间戳：${refTime}`,
    "请输出 IHolographicAmmoConfig JSON。",
  ].join("\n");
  return {
    systemPrompt: buildSystemPrompt(),
    userPrompt,
    targetCategory,
    sanitizedInput,
    detectedLeak,
    constraints,
  };
}
