import type { DemandCategory } from "./mockEngine";

/** LLM→engine 指令：LLM 只做意图抽取/追问/文案，卡片与撮合走本地确定性代码。 */
export interface LlmDirective {
  /** 显示给用户的文案。 */
  text: string;
  /** ask=追问字段 / slots=展示时段卡 / done=收尾。 */
  action: "ask" | "slots" | "done";
  /** 识别到的服务分类。 */
  category: DemandCategory;
  /** 本轮消息里能确认的需求字段（与已收集状态合并）。 */
  need?: Partial<Record<"level" | "partySize" | "area" | "budget" | "style", string | number>>;
}

export const NEED_KEYS: Array<"level" | "partySize" | "area" | "budget" | "style"> = [
  "level",
  "partySize",
  "area",
  "budget",
  "style",
];

/** Extract the first strict JSON object from the model reply (strip fences). */
export function parseDirective(raw: string): LlmDirective | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1));
    if (
      typeof obj !== "object" ||
      obj === null ||
      typeof obj.text !== "string" ||
      !["ask", "slots", "done"].includes(obj.action)
    ) {
      return null;
    }
    const category: DemandCategory =
      obj.category === "badminton" ||
      obj.category === "photography" ||
      obj.category === "housekeeping"
        ? obj.category
        : null;
    const need: LlmDirective["need"] = {};
    for (const key of NEED_KEYS) {
      const v = obj.need?.[key];
      if (v !== undefined && v !== null) need[key] = v as never;
    }
    return { text: obj.text, action: obj.action, category, need };
  } catch {
    return null;
  }
}
