/** LLM→engine 指令：LLM 只做意图抽取/追问/文案，卡片与撮合走本地确定性代码。 */
export interface LlmDirective {
  /** 显示给用户的文案。 */
  text: string;
  /** ask=追问字段 / slots=展示时段卡 / done=收尾。 */
  action: "ask" | "slots" | "done";
  /** 识别到的服务分类（动态泛化，任意已注册弹药 category）。 */
  category: string | null;
  /** 本轮消息里能确认的需求字段（与已收集状态合并）。 */
  need?: Partial<Record<"level" | "partySize" | "area" | "budget" | "style", string | number>>;
}

import { safeParseDirective } from "../schema/directive-schema.ts";

export const NEED_KEYS: Array<"level" | "partySize" | "area" | "budget" | "style"> = [
  "level",
  "partySize",
  "area",
  "budget",
  "style",
];

/** Extract the first strict JSON object from the model reply (strip fences). DI 注入可用品类表，红线 3 不反向 import ammo。 */
export function parseDirective(
  raw: string,
  opts?: { availableCategories?: string[] },
): LlmDirective | null {
  const result = safeParseDirective(raw, opts);
  if (!result.success) return null;
  const { text, action, category, need } = result.data;
  // 保持原契约：need 缺省时返回空对象，避免下游 for…of 空指针差异（条文 #2 兼容）
  // 同时过滤非 NEED_KEYS 的动态槽位（零硬编码，但历史 need 白名单收敛）
  const filteredNeed: LlmDirective["need"] = {};
  if (need) {
    for (const key of NEED_KEYS) {
      const v = (need as Record<string, unknown>)[key];
      if (v !== undefined && v !== null) (filteredNeed as Record<string, unknown>)[key] = v as never;
    }
    // 若 need 为空对象，则保持 undefined 以兼容空输入语义（原实现返回 {} 但下游均判空）
    if (Object.keys(filteredNeed).length === 0) return { text, action, category, need: filteredNeed };
  }
  return { text, action, category, need: filteredNeed };
}
