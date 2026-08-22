/**
 * 全仓统一自然语言时间解析引擎（SSOT · P0 战役第 2 步 · 2026-08-22）。
 *
 * 职责：全仓所有自然语言时间解析唯一真理源 —— voiceIntent（语音意图）与
 * mockEngine（对话澄清引擎）的私有时间正则全部收敛至此，词表 100% 物理对齐。
 *
 * 三形态全覆盖（裁决版契约）：
 * ① 钟点型「明天下午2点半」→ normalizedTime "14:30" + displayLabel "明天 14:30"；
 * ② 星期型「周六下午」「周三晚8点」→ relativeDay SPECIFIC_WEEKDAY + weekday(1-7)；
 * ③ 粗时间型「明天上午」「周末」（无钟点）→ normalizedTime null，displayLabel
 *    「明天上午 / 周末」，杜绝收敛后的行为回退。
 *
 * 红线合规：纯函数零副作用、baseDate 注入式（红线 1 确定性可测）、
 * 零 React/UI 依赖（红线 3 单向依赖）。
 */

export type RelativeDayKind =
  | "TODAY"
  | "TOMORROW"
  | "DAY_AFTER_TOMORROW"
  | "SPECIFIC_WEEKDAY"
  | "WEEKEND";

export type PeriodOfDay = "MORNING" | "NOON" | "AFTERNOON" | "EVENING" | "NIGHT";

/** 统一解析结果契约（裁决扩充版）。 */
export interface IParsedNaturalTime {
  /** 原文命中的时间段文本。 */
  rawMatch: string;
  /** 归一化钟点（24h 制 HH:mm）；粗时间（无钟点）为 null。 */
  normalizedTime: string | null;
  periodOfDay?: PeriodOfDay;
  relativeDay?: RelativeDayKind;
  /** SPECIFIC_WEEKDAY 时的星期几（1=周一 … 7=周日）。 */
  weekday?: number;
  /** 展示文案：「今天 10:00」「明天 14:30」「周六下午」「周末」。 */
  displayLabel: string;
}

const CN_DIGIT: Record<string, number> = {
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 零: 0,
};

/** 中文数字序列 → 数值（支持 一~十二；非法返回 null）。 */
function cnNumberToValue(seq: string): number | null {
  if (!seq) return null;
  if (seq.length === 1) {
    const v = CN_DIGIT[seq];
    return v === undefined ? null : v;
  }
  // 十X / X十 / X十Y
  if (seq.includes("十")) {
    const [a, b] = seq.split("十");
    const tens = a ? CN_DIGIT[a] : 1;
    const ones = b ? CN_DIGIT[b] : 0;
    if (tens === undefined || ones === undefined) return null;
    return tens * 10 + ones;
  }
  let acc = 0;
  for (const ch of seq) {
    const v = CN_DIGIT[ch];
    if (v === undefined) return null;
    acc = acc * 10 + v;
  }
  return acc;
}

const WEEKDAY_CHAR: Record<string, number> = {
  一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7,
};

const DAY_PATTERNS: Array<{ re: RegExp; kind: RelativeDayKind; label: string; weekday?: (m: RegExpMatchArray) => number }> = [
  { re: /今天|今日/, kind: "TODAY", label: "今天" },
  { re: /明天|明日|明晚/, kind: "TOMORROW", label: "明天" },
  { re: /后天/, kind: "DAY_AFTER_TOMORROW", label: "后天" },
  {
    re: /(?:周|礼拜|星期)([一二三四五六日天])/,
    kind: "SPECIFIC_WEEKDAY",
    label: "",
    weekday: (m) => WEEKDAY_CHAR[m[1]] ?? 1,
  },
  { re: /周末|双休/, kind: "WEEKEND", label: "周末" },
];

const PART_PATTERNS: Array<{ re: RegExp; period: PeriodOfDay; label: string }> = [
  { re: /凌晨|深夜|半夜/, period: "NIGHT", label: "" },
  { re: /清晨|早上|早晨|上午/, period: "MORNING", label: "上午" },
  { re: /中午|午间/, period: "NOON", label: "中午" },
  { re: /下午|午后/, period: "AFTERNOON", label: "下午" },
  { re: /傍晚|晚上|晚间|夜里/, period: "EVENING", label: "晚上" },
];

interface ClockHit {
  hour: number;
  minute: number;
  raw: string;
  hasClock: boolean;
}

/** 阿拉伯数字钟点：10点 / 10点半 / 14:30 / 14点30分 / 9时。 */
function matchArabicClock(t: string): ClockHit | null {
  const m = t.match(/(\d{1,2})\s*[点时:：]\s*(半|\d{1,2})?\s*分?/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 24 || h === 0) return null;
  let minute = 0;
  if (m[2] === "半") minute = 30;
  else if (m[2]) minute = Number(m[2]);
  if (minute > 59) return null;
  return { hour: h, minute, raw: m[0], hasClock: true };
}

/** 中文数字钟点：三点半 / 十点 / 十二点。 */
function matchCnClock(t: string): ClockHit | null {
  const m = t.match(/([一二两三四五六七八九十]{1,2})\s*点\s*(半)?/);
  if (!m) return null;
  const h = cnNumberToValue(m[1]);
  if (h === null || h === 0 || h > 24) return null;
  return { hour: h, minute: m[2] ? 30 : 0, raw: m[0], hasClock: true };
}

/** 时段偏移：下午4点→16:00；晚上8点→20:00；晚上12点→00:00；中午12点→12:00。 */
function applyPeriodOffset(hour: number, period?: PeriodOfDay): number {
  if (period === "AFTERNOON" && hour < 12) return hour + 12;
  if ((period === "EVENING" || period === "NIGHT") && hour < 12) return hour + 12;
  if ((period === "EVENING" || period === "NIGHT") && hour === 12) return 0;
  return hour;
}

/**
 * 唯一真理源入口：自然语言 → 结构化时间。
 * 无法识别任何时间要素 → null（调用方自行回落既有兜底值）。
 */
export function parseNaturalTime(
  input: string,
  baseDate: Date = new Date()
): IParsedNaturalTime | null {
  const t = input.trim();
  if (!t) return null;

  // ── 星期型：优先取具体星期（相对日语义最强）；baseDate 仅用于校准标签口径 ──
  let dayHit: (typeof DAY_PATTERNS)[number] | null = null;
  let dayLabel = "";
  let dayRaw = "";
  let weekday: number | undefined;
  for (const p of DAY_PATTERNS) {
    const m = t.match(p.re);
    if (m) {
      dayHit = p;
      dayRaw = m[0];
      weekday = p.weekday?.(m);
      if (p.kind === "SPECIFIC_WEEKDAY") {
        dayLabel = `周${Object.entries(WEEKDAY_CHAR).find(([, v]) => v === weekday)?.[0] ?? "一"}`;
      } else {
        dayLabel = p.label;
      }
      break;
    }
  }

  // ── 时段词（上午/下午/晚上…）──
  let partHit: (typeof PART_PATTERNS)[number] | null = null;
  for (const p of PART_PATTERNS) {
    if (p.re.test(t)) {
      partHit = p;
      break;
    }
  }

  // ── 钟点（阿拉伯优先，中文数字回落）──
  const clock = matchArabicClock(t) ?? matchCnClock(t);

  void baseDate; // 保留注入位：未来相对日精确日期化（红线 1 口径不变）

  if (clock) {
    const period = partHit?.period;
    const hour = applyPeriodOffset(clock.hour, period);
    const hh = String(hour).padStart(2, "0");
    const mm = String(clock.minute).padStart(2, "0");
    const normalizedTime = `${hh}:${mm}`;
    const rawParts = [dayRaw, clock.raw].filter(Boolean);
    const displayLabel = `${dayLabel ? dayLabel + " " : ""}${normalizedTime}`;
    return {
      rawMatch: rawParts.join(" ") || clock.raw,
      normalizedTime,
      ...(period ? { periodOfDay: period } : {}),
      ...(dayHit ? { relativeDay: dayHit.kind } : {}),
      ...(weekday !== undefined ? { weekday } : {}),
      displayLabel,
    };
  }

  // 无钟点：day / part 至少其一存在才算命中
  if (dayHit) {
    const displayLabel = dayLabel + (partHit?.label ?? "");
    return {
      rawMatch: dayRaw,
      normalizedTime: null,
      ...(partHit ? { periodOfDay: partHit.period } : {}),
      relativeDay: dayHit.kind,
      ...(weekday !== undefined ? { weekday } : {}),
      displayLabel,
    };
  }
  if (partHit) {
    return {
      rawMatch: partHit.label || "时段",
      normalizedTime: null,
      periodOfDay: partHit.period,
      displayLabel: partHit.label,
    };
  }
  return null;
}
