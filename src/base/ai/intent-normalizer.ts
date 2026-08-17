/**
 * 非标定制需求语义驯化与清洗引擎（阶段3 · 纯函数，红线 1/红线 3）。
 *
 * 职责：把口语化非标定制（涉敏着装/年龄区间/性别偏好）转化为中性化结构化
 * 契约（INormalizedCustomIntent），杜绝擦边词汇在公海/草稿卡直显；同时按
 * 「两道防线严格分流」原则与 moderation 词表联动：
 *   - 绝对违禁词（涉黄涉赌涉暴，autoFlag 命中）→ blockedReason 硬阻断标记
 *     （发布链路治理闸门 2 继续执行原有下架拦截，此处先行留痕）；
 *   - 非标个性化需求（二次元着装/JK/礼服/年龄/性别偏好）→ 100% 驯化为
 *     中性属性对象，绝不禁杀。
 *
 * 红线 3 单向依赖：仅依赖 base/risk/moderation（纯函数层），零 React / Store
 * 反向 import。全部判定为确定性正则 + 区间算术，无任何概率性逻辑。
 */

import type {
  ICustomRequirements,
  INormalizedCustomIntent,
  IDressCodeType,
} from "../../types/ammo-schema.ts";
import { autoFlag } from "../risk/moderation.ts";

/* =====================================================================
 * 着装词表（确定性归一；命中即 required=true）
 * ===================================================================== */

/** 女仆主题（重二次元角色化着装）。 */
const MAID_RE = /女仆装|女仆|maid/i;
/** Cosplay / JK 制服等角色扮演着装。 */
const COSPLAY_RE = /jk\s*制服|jk|cosplay|cospaly|角色扮演|制服|水手服|洛丽塔|lolita/i;
/** 正装 / 西装 / 礼服等正式着装。 */
const FORMAL_RE = /正装|西装|礼服|晚礼服|西服/i;

/** 着装归一：命中返回 { type, rawKeyword }；未命中 null。 */
function extractDressCode(
  text: string,
): ICustomRequirements["dressCode"] {
  if (MAID_RE.test(text)) {
    return { required: true, type: "THEMED_MAID", rawKeyword: extractKeyword(text, MAID_RE) };
  }
  if (COSPLAY_RE.test(text)) {
    return { required: true, type: "THEMED_COSPLAY", rawKeyword: extractKeyword(text, COSPLAY_RE) };
  }
  if (FORMAL_RE.test(text)) {
    return { required: true, type: "FORMAL_UNIFORM", rawKeyword: extractKeyword(text, FORMAL_RE) };
  }
  // 其余指定服装词（工装/围裙/旗袍等）→ CUSTOM 兜底，同样驯化不清洗
  const generic = text.match(/着装|穿.*装|穿.*服(?!装)|指定服装/i);
  if (generic) {
    const m = text.match(/([\u4e00-\u9fa5]{2,4})(?:装|服)/);
    if (m) return { required: true, type: "CUSTOM", rawKeyword: m[1] + (text[m.index! + m[1].length] === "装" ? "装" : "服") };
    return { required: true, type: "CUSTOM", rawKeyword: generic[0] };
  }
  return undefined;
}

/** 从文本中提取匹配词组的原始命中片段（限长 8 字，供审计追溯）。 */
function extractKeyword(text: string, re: RegExp): string {
  const m = text.match(re);
  const kw = m?.[0] ?? re.source;
  return kw.slice(0, 8);
}

/* =====================================================================
 * 年龄区间提取（确定性区间算术；[min, max]，乱序自动纠正）
 * ===================================================================== */

/**
 * 支持形态：
 *  - 「年龄在20-30岁之间」/「年龄在20到30岁之间」/「年龄20-30岁」
 *  - 「20-30岁之间」/「20到30岁」/「20~30岁」/「要求20至30岁」
 *  - 「年龄30岁以内」/「30岁以下」/「18岁及以上」/「18岁以上」
 */
function extractAgeRange(text: string): [number, number] | undefined {
  // 双边界：X-Y / X到Y / X至Y / X~Y（含「岁之间」「岁以内」后缀）
  const pair =
    text.match(
      /(?:年龄(?:限制|要求)?(?:在|为)?|要求)?\s*(\d{1,2})\s*(?:-|—|–|到|至|~|～)\s*(\d{1,2})\s*岁(?:之间|以内|之间即可|以内即可)?/i,
    ) ??
    text.match(/(?:年龄(?:限制|要求)?(?:在|为)?|要求)?\s*(\d{1,2})\s*(?:-|—|–|到|至|~|～)\s*(\d{1,2})\s*(?:之间|以内)/i) ??
    text.match(/(?:年龄|年龄要求)[:：]?\s*(\d{1,2})\s*(?:-|—|–|到|至|~|～)\s*(\d{1,2})\s*岁?/i);
  if (pair) {
    const a = Number(pair[1]);
    const b = Number(pair[2]);
    if (a >= 0 && b >= 0 && a > 0 && b > 0) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (lo >= 14 && hi <= 100) return [lo, hi];
    }
  }
  // 单边界：X岁以下 / X岁以上 / X岁以内 / X岁及以上 / X岁+（由需求方兜底为全区间）
  const cap = text.match(/(\d{1,2})\s*岁(?:\s*以内|以下|及以下|封顶)/i);
  if (cap) {
    const hi = Number(cap[1]);
    if (hi >= 14 && hi <= 100) return [14, hi];
  }
  const floor = text.match(/(\d{1,2})\s*岁(?:\s*以上|及以上|起)/i);
  if (floor) {
    const lo = Number(floor[1]);
    if (lo >= 14 && lo <= 100) return [lo, 100];
  }
  return undefined;
}

/* =====================================================================
 * 性别偏好提取（确定性词表；避开着装词已消费的「女」字）
 * ===================================================================== */

/**
 * 顺序执行：先剥离着装词段（如「女仆装」），再从剩余文本匹配性别词，
 * 避免「身穿女仆装」中的「女」被误判为 FEMALE 偏好。
 */
function extractGenderPreference(
  raw: string,
  dressCode: ICustomRequirements["dressCode"],
): "MALE" | "FEMALE" | "ANY" {
  let residual = raw;
  if (dressCode) {
    residual = raw.replace(MAID_RE, "").replace(COSPLAY_RE, "").replace(FORMAL_RE, "");
  }
  if (/(小姑娘|女孩|女生|女性|女士|姐妹|她)/i.test(residual)) return "FEMALE";
  if (/(小哥哥|男孩|男生|男性|先生|兄弟|他)/i.test(residual)) return "MALE";
  return "ANY";
}

/* =====================================================================
 * 中性化展示文案生成（杜绝擦边词公海直显）
 * ===================================================================== */

const DRESS_LABEL: Record<IDressCodeType, string> = {
  THEMED_MAID: "女仆主题",
  THEMED_COSPLAY: "角色扮演/制服主题",
  FORMAL_UNIFORM: "正装/礼服",
  CUSTOM: "指定着装",
};

function buildCleanText(
  c: Pick<INormalizedCustomIntent, "dressCode" | "ageRange" | "genderPreference">,
): string {
  const parts: string[] = [];
  if (c.dressCode?.required) {
    parts.push(`要求：指定工作着装(${DRESS_LABEL[c.dressCode.type]})`);
  }
  if (c.ageRange) {
    parts.push(`期望年龄: ${c.ageRange[0]}-${c.ageRange[1]}岁`);
  }
  if (c.genderPreference && c.genderPreference !== "ANY") {
    parts.push(`性别偏好: ${c.genderPreference === "FEMALE" ? "女性" : "男性"}`);
  }
  return parts.join(" · ");
}

/* =====================================================================
 * 主入口：语义驯化（纯函数，常量时间，≤1ms）
 * ===================================================================== */

/**
 * 将口语化非标定制需求清洗为中性化结构化契约。
 *
 * @param rawPrompt 原始口语文本（含或不含非标定制）
 * @returns INormalizedCustomIntent：
 *  - 无任何定制 → { cleanText: "", isSensitiveCustomization: false, blockedReason: null }
 *    （isSensitiveCustomization 恒为 true 当且仅当着装/年龄/性别任一命中）；
 *  - 命中违禁词（autoFlag）→ blockedReason = 违禁标签（硬阻断标记），
 *    同时清洗字段仍正常产出（供审计留痕，发布链路按治理闸门 2 拦截）；
 *  - 命中非标定制 → 中性属性 + cleanText + isSensitiveCustomization: true。
 */
export function normalizeCustomIntent(rawPrompt: string): INormalizedCustomIntent {
  const text = rawPrompt.trim();

  const dressCode = extractDressCode(text);
  const ageRange = extractAgeRange(text);
  const genderPreference = extractGenderPreference(text, dressCode);
  const isSensitiveCustomization =
    (dressCode?.required ?? false) ||
    ageRange !== undefined ||
    genderPreference !== "ANY";

  const blocked = autoFlag(text);
  const hasBlockedWord = blocked !== null;

  return {
    dressCode,
    ageRange,
    genderPreference,
    // 定制命中或违禁命中均属需升级风控的敏感输入（违禁 → 硬阻断分流）
    isSensitiveCustomization: isSensitiveCustomization || hasBlockedWord,
    // 违禁词命中时不生成中性展示文案（该诉求应被硬阻断，不进入公海）
    cleanText: hasBlockedWord ? "" : buildCleanText({ dressCode, ageRange, genderPreference }),
    blockedReason: blocked,
  };
}