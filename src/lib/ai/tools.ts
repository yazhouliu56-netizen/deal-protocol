import { tool } from "ai"
import { z } from "zod"
import { getSupabase } from "@/lib/supabase-client"

const classifyParams = z.object({
  text: z.string().optional().describe("The user's original request text"),
})

export const classifyDemandTool = (tool as any)({
  description: "Classify a user's service request into a structured demand with title, category, budget, urgency, and address",
  parameters: classifyParams,
  execute: async ({ text }: z.infer<typeof classifyParams>) => {
    const userText = text || "用户发起了服务需求"
    const categories = ["维修", "按摩", "保洁", "社交", "其他"]
    const categoryMap: Record<string, string> = {
      维修: "家政", 按摩: "家政", 保洁: "家政", 社交: "社交", 其他: "家政",
    }

    const body = {
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `你是一个服务需求分析专家。从用户的描述中提取结构化信息。
分类只能是以下之一：${categories.join("、")}
返回 JSON: { "title": "简短标题", "category": "${categories.join("|")}", "description": "完整描述", "budgetMin": 最低预算或null, "budgetMax": 最高预算或null, "urgency": "high|medium|low", "address": "地址或null" }`,
        },
        { role: "user", content: userText },
      ],
      temperature: 0.1,
      max_tokens: 512,
    }

    const res = await fetch(
      "https://models.inference.ai.azure.com/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENCODE_GITHUB_TOKEN}`,
        },
        body: JSON.stringify(body),
      },
    )
    if (!res.ok) throw new Error(`LLM classify failed: ${res.status}`)
    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content ?? "{}"
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim()
    const result = JSON.parse(cleaned)
    const rawCategory = categories.includes(result.category) ? result.category : "其他"

    return {
      title: result.title ?? "服务需求",
      description: result.description ?? userText,
      category: rawCategory,
      dbCategory: categoryMap[rawCategory] ?? "家政",
      budgetMin: typeof result.budgetMin === "number" ? result.budgetMin : null,
      budgetMax: typeof result.budgetMax === "number" ? result.budgetMax : null,
      urgency: ["high", "medium", "low"].includes(result.urgency) ? result.urgency : "medium",
      address: result.address ?? null,
    }
  },
}) as any

const generateParams = z.object({
  category: z.string().describe("The classified DB category"),
  title: z.string().describe("The demand title"),
  description: z.string().describe("The demand description"),
})

export const generateProtocolTool = (tool as any)({
  description: "Generate a smart protocol card based on a classified demand's category. Must be called AFTER classifyDemand.",
  parameters: generateParams,
  execute: async ({ category, title, description }: z.infer<typeof generateParams>) => {
    const supabase = getSupabase()
    const { data: config } = await supabase
      .from("category_configs")
      .select("*")
      .eq("category", category)
      .single()

    if (!config) {
      return {
        schema_json: {},
        protocol_json: {},
        risk_tier: "low",
        category,
        title,
        description,
        error: `Category "${category}" not configured`,
      }
    }

    return {
      schema_json: config.schema_json as Record<string, unknown>,
      protocol_json: {},
      risk_tier: config.risk_tier as string,
      category,
      title,
      description,
    }
  },
}) as any

const createParams = z.object({
  title: z.string().describe("Demand title from classification"),
  description: z.string().describe("Full description from classification"),
  dbCategory: z.string().describe("Database category key"),
  budgetMin: z.number().nullable().describe("Minimum budget"),
  budgetMax: z.number().nullable().describe("Maximum budget"),
  urgency: z.string().describe("high|medium|low"),
  address: z.string().nullable().describe("Service address"),
  category: z.string().describe("Raw category label"),
  risk_tier: z.string().describe("Risk tier from protocol"),
  schema_json: z.record(z.unknown()).describe("Protocol schema JSON"),
  protocol_json: z.record(z.unknown()).describe("Protocol values JSON"),
})

export const createDemandTool = (tool as any)({
  description: "Create a demand in the database after the user confirms. Must be called AFTER the user explicitly confirms.",
  parameters: createParams,
  execute: async (params: z.infer<typeof createParams>) => {
    const supabase = getSupabase()

    const { data: demand, error } = await supabase
      .from("demands")
      .insert({
        title: params.title,
        description: params.description,
        category: params.dbCategory,
        budget_min: params.budgetMin,
        budget_max: params.budgetMax,
        urgency: params.urgency,
        address: params.address,
        status: "OPEN",
        schema_json: params.schema_json,
        protocol_json: params.protocol_json,
        risk_tier: params.risk_tier,
        raw_category: params.category,
      })
      .select("id")
      .single()

    if (error) {
      throw new Error(`Failed to create demand: ${error.message}`)
    }

    return {
      demandId: demand.id,
      title: params.title,
      description: params.description,
      message: "需求发布成功！正在跳转到详情页...",
    }
  },
}) as any