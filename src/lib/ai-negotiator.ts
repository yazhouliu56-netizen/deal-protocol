import { streamText } from "ai"
import { generateText } from "ai"
import { getAIModel } from "@/lib/ai-provider"

export interface NegotiateInput {
  demandTitle: string
  category: string
  currentBudget: number
  proposedPrice: number
  userMessage?: string
  historyMessages?: Array<{ role: "user" | "assistant"; content: string }>
}

export interface NegotiationResult {
  success: boolean
  counterPrice: number
  scopeAdjustments: string[]
  estimatedProbability: number
  reasoning?: string
}

export function createNegotiationStream(input: NegotiateInput) {
  const {
    demandTitle,
    category,
    currentBudget,
    proposedPrice,
    userMessage,
    historyMessages = [],
  } = input

  const model = getAIModel()

  const systemPrompt =
    `你叫 Cyber-Negotiator姬，是 deal-protocol 赛博公会的智能价格协商官。\n` +
    `当前悬赏任务：「${demandTitle}」（分类：${category}）\n` +
    `发榜人预算：￥${currentBudget}，接榜服务者期望报价：￥${proposedPrice}。\n` +
    `请结合契约价值与市场行情进行赛博拉锯谈判，` +
    `语气专业且带有 Galgame 赛博二次元风格，输出合理的折中定价建议。`

  const messages = [
    ...historyMessages,
    ...(userMessage ? [{ role: "user" as const, content: userMessage }] : []),
  ]

  const result = streamText({
    model,
    system: systemPrompt,
    messages:
      messages.length > 0
        ? messages
        : [{ role: "user" as const, content: "请开始智能协商定价拉锯。" }],
    temperature: 0.7,
  })

  return result
}

export async function proposeCounterOffer(
  input: NegotiateInput,
): Promise<NegotiationResult> {
  const { demandTitle, category, currentBudget, proposedPrice } = input

  if (currentBudget <= 0 || proposedPrice <= 0) {
    return {
      success: false,
      counterPrice: 0,
      scopeAdjustments: [],
      estimatedProbability: 0,
    }
  }

  const mid = Math.round((currentBudget + proposedPrice) / 2)

  try {
    const model = getAIModel()
    const systemPrompt =
      `你叫 Cyber-Negotiator姬，是 deal-protocol 赛博公会的智能价格协商官。\n` +
      `当前悬赏任务：「${demandTitle}」（分类：${category}）\n` +
      `发榜人预算：￥${currentBudget}，接榜服务者期望报价：￥${proposedPrice}。\n` +
      `请结合契约价值与市场行情进行赛博拉锯谈判。` +
      `返回 JSON 格式：{ counterPrice (number), scopeAdjustments (string[]), estimatedProbability (0-100), reasoning (string) }`

    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: "请开始智能协商定价拉锯，输出 JSON 结果。",
    })

    const parsed = JSON.parse(text) as {
      counterPrice: number
      scopeAdjustments: string[]
      estimatedProbability: number
      reasoning: string
    }

    return {
      success: true,
      counterPrice: parsed.counterPrice,
      scopeAdjustments: parsed.scopeAdjustments ?? [],
      estimatedProbability: parsed.estimatedProbability ?? 90,
      reasoning: parsed.reasoning,
    }
  } catch {
    return {
      success: true,
      counterPrice: mid,
      scopeAdjustments: [
        `Negotiate from ¥${proposedPrice} down to ¥${mid}`,
        "Consider removing non-essential scope items",
        "Bundle multiple units for discount",
      ],
      estimatedProbability: 85,
      reasoning: `AI negotiation unavailable; fallback midpoint (¥${mid}) based on budget (¥${currentBudget}) and provider (¥${proposedPrice})`,
    }
  }
}
