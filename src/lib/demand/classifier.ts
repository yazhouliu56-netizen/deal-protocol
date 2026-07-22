import { callLLM } from "@/lib/llm"
import { mapClassifierToDbCategory } from "@/lib/category-map"

export interface DemandInfo {
  title: string
  description: string
  category: string
  dbCategory: string
  budgetMin: number | null
  budgetMax: number | null
  urgency: "high" | "medium" | "low"
  address: string | null
}

const RAW_CATEGORIES = ['维修', '按摩', '保洁', '社交', '其他']

const SYSTEM_PROMPT = `你是一个服务需求分析专家。分析用户的描述，提取结构化信息。

分类只能是以下之一：${RAW_CATEGORIES.join('、')}
紧急度：high（今天就要）、medium（这周内）、low（不着急）
如果用户没有提到预算，返回 null
如果用户没有提到地址，返回 null

示例：
用户说："空调不制冷了，需要加氟，在三里屯SOHO，今天下午能来吗？"
→ {"title":"空调加氟","category":"维修","description":"空调不制冷了，需要加氟，在三里屯SOHO","budgetMin":null,"budgetMax":null,"urgency":"high","address":"三里屯SOHO"}

用户说："周末想找个女生一起吃饭看电影，我在朝阳区"
→ {"title":"约饭看电影","category":"社交","description":"周末想找个女生一起吃饭看电影","budgetMin":null,"budgetMax":null,"urgency":"medium","address":"朝阳区"}

用户说":"厨房深度保洁，大概200-300块，越快越好"
→ {"title":"厨房深度保洁","category":"保洁","description":"厨房深度保洁","budgetMin":200,"budgetMax":300,"urgency":"high","address":null}`

export async function classifyDemand(input: string): Promise<DemandInfo> {
  const raw = await callLLM(SYSTEM_PROMPT, `分析以下服务需求：\n${input}\n\n请按JSON格式返回：
{
  "title": "简短标题（10字以内）",
  "category": "${RAW_CATEGORIES.join('|')}",
  "description": "完整描述",
  "budgetMin": 最低预算或null,
  "budgetMax": 最高预算或null,
  "urgency": "high|medium|low",
  "address": "地址或null"
}`, { temperature: 0.1 })

  try {
    const result = JSON.parse(raw)
    const rawCategory = RAW_CATEGORIES.includes(result.category) ? result.category : "其他"
    return {
      title: result.title ?? "服务需求",
      description: result.description ?? input,
      category: rawCategory,
      dbCategory: mapClassifierToDbCategory(rawCategory),
      budgetMin: typeof result.budgetMin === "number" ? result.budgetMin : null,
      budgetMax: typeof result.budgetMax === "number" ? result.budgetMax : null,
      urgency: ["high", "medium", "low"].includes(result.urgency) ? result.urgency : "medium",
      address: result.address ?? null,
    }
  } catch {
    return {
      title: input.length > 20 ? input.slice(0, 20) + "..." : input,
      description: input,
      category: "其他",
      dbCategory: "家政",
      budgetMin: null,
      budgetMax: null,
      urgency: "medium",
      address: null,
    }
  }
}
