/**
 * 会话发单草稿（TalkPublish R2a）。
 *
 * 六圈定位：增长圈（发单转化）× 体验圈（会话形态）；不碰交易圈与治理语义。
 * 宪法对照：#10 失败降级（interpret 不可用时 nextQuestion 规则追问永不裸奔）；
 * 红线零品类硬编码（category 自由文本，归一化复用 resolveAmmoIdForPublish）。
 *
 * Pure + unit-testable; no runtime imports.
 */

/** 会话拼出的发单草稿（与 WaveBasics 对齐的子集 + 预算/备注）。 */
export interface TalkDraft {
  category: string;
  time: string;
  area: string;
  /** >0 有效；0/NaN = 缺失。 */
  budgetYuan: number;
  note: string;
}

export type DraftField = "category" | "time" | "area" | "budget";

/** LLM 解释一轮的结果（含规则兜底形态）。 */
export interface InterpretResult {
  draft: TalkDraft;
  missing: DraftField[];
  /** 缺项时的追问（一句）；无缺项回 null。 */
  question: string | null;
  /** 照片转写出的文本事实（并入 note 之前）。 */
  photoFacts: string[];
  source: "llm" | "rules";
}

const MAX_TEXT = 120;

function cleanText(v: unknown): string {
  return typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "";
}

function cleanBudget(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), 9999999);
}

export function emptyDraft(): TalkDraft {
  return { category: "", time: "", area: "", budgetYuan: 0, note: "" };
}

/** 毒丸围栏：LLM/客户端任何形状输入 → 合法草稿（非法字段丢弃取严）。 */
export function normalizeDraft(raw: unknown): TalkDraft {
  if (!raw || typeof raw !== "object") return emptyDraft();
  const r = raw as Record<string, unknown>;
  return {
    category: cleanText(r.category),
    time: cleanText(r.time),
    area: cleanText(r.area),
    budgetYuan: cleanBudget(r.budgetYuan ?? r.budget),
    note: cleanText(r.note),
  };
}

/** 合并两轮草稿：新值非空才覆盖（照片事实追加进 note）。 */
export function mergeDraft(prev: TalkDraft, patch: TalkDraft, photoFacts: string[] = []): TalkDraft {
  const facts = photoFacts.map((f) => f.trim()).filter(Boolean).map((f) => f.slice(0, 60));
  const note = [prev.note, patch.note, ...facts].map((s) => s.trim()).filter(Boolean).join("；").slice(0, 300);
  return {
    category: patch.category || prev.category,
    time: patch.time || prev.time,
    area: patch.area || prev.area,
    budgetYuan: patch.budgetYuan > 0 ? patch.budgetYuan : prev.budgetYuan,
    note,
  };
}

export function missingOf(d: TalkDraft): DraftField[] {
  const m: DraftField[] = [];
  if (!d.category) m.push("category");
  if (!d.time) m.push("time");
  if (!d.area) m.push("area");
  if (d.budgetYuan <= 0) m.push("budget");
  return m;
}

const FIELD_QUESTION: Record<DraftField, string> = {
  category: "这是哪类服务？比如：上门做饭、空调维修",
  time: "希望什么时候上门？比如：明天上午 10 点",
  area: "服务地址在哪里？比如：幸福家园小区",
  budget: "预算大概多少？比如：100",
};

/** 规则追问（#10 兜底）：按固定优先级问第一个缺项。 */
export function nextQuestion(missing: DraftField[]): string | null {
  if (missing.length === 0) return null;
  return FIELD_QUESTION[missing[0]];
}

/** 照片事实条数上限（防 note 膨胀）。 */
export const MAX_PHOTO_FACTS = 3;
