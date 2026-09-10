/**
 * 会话发单解释器纯层（TalkPublish R2c）。
 *
 * 六圈定位：增长圈 × 体验圈；不碰交易圈与治理语义。
 * 宪法对照：#10（LLM 不可用 → nextQuestion 规则追问，路由内降级永不 503）；
 * 红线零品类硬编码（category 自由文本）。
 *
 * Pure + unit-testable; no runtime imports.
 */
import {
  mergeDraft,
  missingOf,
  nextQuestion,
  normalizeDraft,
  type DraftField,
  type TalkDraft,
} from "../order/publish-draft.ts";

export const INTERPRET_MAX_TEXT = 800;
export const INTERPRET_MAX_PHOTOS = 3;

export function interpretSystemPrompt(): string {
  return [
    "你是 OTO 本地生活发单助手。把用户的口语需求抽成 JSON 草稿，只回 JSON：",
    '{"category":"服务品类（如上门做饭）","time":"时间（如明天上午10点）","area":"地点","budgetYuan":数字,"note":"补充要求"}',
    "缺项留空字符串、budget 缺失填 0；不要 markdown，不要多余字段。",
  ].join("\n");
}

/** 用户轮文本拼装（含历史，新轮在后）。 */
export function buildUserText(history: string[], latest: string): string {
  return [...history, latest]
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .join("\n")
    .slice(0, INTERPRET_MAX_TEXT);
}

/** 毒丸围栏：LLM JSON → 草稿（非法回 null，调用方走空补丁合并）。 */
export function parseInterpretJson(raw: string): TalkDraft | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const d = normalizeDraft(data);
    if (!d.category && !d.time && !d.area && d.budgetYuan <= 0 && !d.note) return null;
    return d;
  } catch {
    return null;
  }
}

export interface InterpretAssembly {
  draft: TalkDraft;
  missing: DraftField[];
  question: string | null;
  source: "llm" | "rules";
}

/** 纯装配：prev + 本轮补丁 + 照片事实 → 结果（含追问）。 */
export function assembleInterpret(
  prev: TalkDraft,
  patch: TalkDraft | null,
  photoFacts: string[],
): InterpretAssembly {
  const draft = mergeDraft(prev, patch ?? { category: "", time: "", area: "", budgetYuan: 0, note: "" }, photoFacts);
  const missing = missingOf(draft);
  return { draft, missing, question: nextQuestion(missing), source: patch ? "llm" : "rules" };
}
