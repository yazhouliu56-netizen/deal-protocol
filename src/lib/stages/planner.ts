import { callLLM } from "@/lib/llm";
import {
  validateStagePlan,
  defaultSingleStage,
  type StagePlanItem,
} from "@/base/stages/plan";

export interface StagePlanResult {
  plan: StagePlanItem[];
  /** llm 直出 / fallback 兜底（单阶段 100%）。 */
  source: "llm" | "fallback";
  attempts: number;
}

const SYSTEM_PROMPT = `你是一个家政维修类订单的分阶段专家。把用户的一单拆成施工阶段。
硬规则（违反就白干）：
1. 阶段数 1-5 个，简单单只给 1 个（标题固定"整单一次交付"）；
2. weightPct 为正整数，所有阶段加起来必须恰好等于 100；
3. 每个阶段有可验收的标准（一句话，能拍照验证的优先）；
4. 只输出 JSON 数组，不输出其它字。

示例
用户说"90 平米房子全屋装修，水电泥木油漆全包"
→ [{"title":"水电改造","weightPct":30,"acceptance":"通水通电测试通过"},{"title":"泥木工程","weightPct":40,"acceptance":"墙地砖空鼓率达标"},{"title":"油漆收尾","weightPct":30,"acceptance":"墙面无肉眼色差"}]

用户说"家里玻璃擦一下"
→ [{"title":"整单一次交付","weightPct":100,"acceptance":"全屋玻璃无水渍污点"}]`;

/**
 * P7 阶段模板即时生成（用户裁决 2026-09-18：AI 建议、规则兜底、人拍板）。
 * 护栏：validateStagePlan 不过 → 打回重生（×3）→ 单阶段兜底。
 * 失败（LLM 挂/超时/JSON 坏）→ 兜底，单子照发不误。
 */
export async function suggestStagePlan(
  category: string,
  description: string,
  amount?: number,
): Promise<StagePlanResult> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const raw = await callLLM(
        SYSTEM_PROMPT,
        `类目：${category}\n需求：${description}\n${amount ? `预算：${amount} 元\n` : ""}只输出 JSON 数组：`,
        { temperature: 0.1 },
      );
      const parsed = JSON.parse(raw) as StagePlanItem[];
      if (validateStagePlan(parsed).length === 0) {
        return { plan: parsed, source: "llm", attempts: attempt };
      }
    } catch {
      /* 重试 */
    }
  }
  return { plan: defaultSingleStage(), source: "fallback", attempts: 3 };
}
