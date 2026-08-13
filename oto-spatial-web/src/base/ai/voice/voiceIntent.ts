/**
 * L2 语音意图层：LLM 结构化输出 → 本地动作表校验 → 执行指引。
 * - intentPrompt()：给 LLM 的系统提示（要求只输出 JSON 动作）。
 * - parseVoiceIntent()：校验 LLM 输出（非法/缺字段 → 降级 chat，绝不越权执行）。
 * - mockVoiceIntent()：无 LLM 时的本地关键词降级（与 /api/chat 的 MockEngine 同哲学）。
 * - describeIntent()：意图 → 播报/展示文案（VoiceBar/ChatPage 消费）。
 */

import type { VoiceIntent } from "./types";

/** LLM 结构化输出 schema（JSON 对象）。 */
export interface IntentLlmOut {
  action: "publish-wave" | "query-waves" | "chat";
  wave?: {
    category?: string;
    time?: string;
    area?: string;
    budget?: number;
    capacity?: number;
  };
}

const BUDGET_MAX = 100000;
const CAPACITY_MAX = 50;

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

function str(v: unknown, maxLen = 40): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= maxLen ? s : null;
}

/** 校验 LLM 结构化输出 → VoiceIntent；非法输入一律降级 chat（可单测）。 */
export function parseVoiceIntent(raw: unknown): VoiceIntent {
  if (typeof raw !== "object" || raw === null) return { kind: "chat" };
  const o = raw as IntentLlmOut;
  if (o.action === "publish-wave") {
    const category = str(o.wave?.category, 40) ?? "本地服务";
    const budget = clampNum(o.wave?.budget, 1, BUDGET_MAX, 0);
    if (budget <= 0) return { kind: "chat" };
    return {
      kind: "publish-wave",
      wave: {
        category,
        time: str(o.wave?.time, 40) ?? "尽快",
        area: str(o.wave?.area, 40) ?? "附近",
        budget,
        capacity: clampNum(o.wave?.capacity ?? 1, 1, CAPACITY_MAX, 1),
      },
    };
  }
  if (o.action === "query-waves") return { kind: "query-waves" };
  return { kind: "chat" };
}

/** 本地关键词降级：发布局触发词 → 结构化意图（无 LLM 可用时）。 */
export function mockVoiceIntent(text: string): VoiceIntent {
  const t = text.trim();
  const publishHit =
    /(发布|帮我发|我想发|组个|发起).*?(局|约|球局|拼位)/i.test(t) ||
    /(羽毛球|篮球|乒乓球|跑步|爬山|钓鱼|写真|保洁|做饭|家教|遛狗)/i.test(t);
  if (publishHit) {
    const category = matchCategory(t) ?? "本地服务";
    const time = matchTime(t);
    const budget = matchBudget(t);
    if (budget <= 0) return { kind: "chat" };
    return {
      kind: "publish-wave",
      wave: {
        category,
        time,
        area: "附近",
        budget,
        capacity: /(拼位|开放局|\d+\s*人)/i.test(t) ? 2 : 1,
      },
    };
  }
  if (/(我的局|查一下|看看.*局|有哪些局)/i.test(t)) return { kind: "query-waves" };
  return { kind: "chat" };
}

const CATEGORY_MAP: Array<[RegExp, string]> = [
  [/羽毛球/i, "羽毛球"],
  [/篮球/i, "篮球"],
  [/乒乓球/i, "乒乓球"],
  [/跑步|夜跑/i, "跑步"],
  [/爬山|登山/i, "登山"],
  [/钓鱼/i, "钓鱼"],
  [/写真|拍照|摄影/i, "约拍写真"],
  [/保洁|打扫/i, "保洁"],
  [/做饭|厨师/i, "上门做饭"],
  [/家教|辅导/i, "家教"],
  [/遛狗|宠物/i, "遛狗"],
];

function matchCategory(t: string): string | null {
  for (const [re, label] of CATEGORY_MAP) {
    if (re.test(t)) return label;
  }
  return null;
}

const CN_DIGIT: Record<string, string> = {
  一: "1", 二: "2", 两: "2", 三: "3", 四: "4", 五: "5",
  六: "6", 七: "7", 八: "8", 九: "9", 十: "10", 零: "0",
};

function matchTime(t: string): string {
  const day = t.match(/(今天|明天|后天|周[一二三四五六日天]|周末)/i)?.[1] ?? "";
  const arabic = t.match(/(\d{1,2})[:点时](\d{0,2})/);
  let hm = "";
  if (arabic) {
    hm = arabic[2] ? `${arabic[1]}:${arabic[2].padStart(2, "0")}` : `${arabic[1]}点`;
  } else {
    // 中文数字时间：下午三点 / 三点半
    const cn = t.match(/([一二两三四五六七八九十])\s*点(半)?/);
    if (cn) {
      const h = CN_DIGIT[cn[1]] ?? "";
      hm = h ? (cn[2] ? `${h}点半` : `${h}点`) : "";
    }
  }
  if (day && hm) return `${day} ${hm}`;
  if (day) return day;
  if (hm) return hm;
  return "尽快";
}

function matchBudget(t: string): number {
  // 优先「预算 300」「300 元」「300块」
  const raw =
    t.match(/预算\s*(\d{2,6})/i) ??
    t.match(/(\d{2,6})\s*元/i) ??
    t.match(/(\d{2,6})\s*块/i);
  if (!raw) return 0;
  return clampNum(Number(raw[1]), 1, BUDGET_MAX, 0);
}

/** 意图 → 播报文案（VoiceBar 转 TTS / ChatPage 消息）。 */
export function describeIntent(intent: VoiceIntent): string {
  if (intent.kind === "publish-wave") {
    const w = intent.wave;
    return `好的，我来帮你发布：${w.category}局，${w.time}，${
      w.capacity >= 2 ? `${w.capacity}人拼位` : "一对一"
    }，预算 ${w.budget} 元。确认后我会生成支付确认卡。`;
  }
  if (intent.kind === "query-waves") {
    return "好的，帮你看看当前局势。";
  }
  return "";
}

/** 留证提示：意图是否涉及业务动作（发布局 → 需要留证与确认）。 */
export function isActionable(intent: VoiceIntent): boolean {
  return intent.kind !== "chat";
}

/** LLM 系统提示：只输出结构化意图 JSON（/api/voice-intent 消费）。 */
export function intentPrompt(): string {
  return [
    "你是语音助手，把用户语音转录文本解析为一个动作 JSON。",
    "只输出 JSON，不要任何解释文字。形如：",
    '{"action":"chat"}',
    '{"action":"query-waves"}',
    '{"action":"publish-wave","wave":{"category":"羽毛球","time":"明天 10:00","area":"幸福家园","budget":100,"capacity":2}}',
    "规则：用户想发起/发布/组建一个线下服务或约局 → publish-wave（category 给具体服务名，time 给自然语言时间，area 给地点，budget 给预算元数，capacity≥2 表示开放拼位、默认 1；若无法提取有效预算 → 归为 chat）。",
    "用户想查看当前有什么局/我的局 → query-waves。",
    "其余全部归为 chat（包括缺 budget 的发布）。",
  ].join("\n");
}