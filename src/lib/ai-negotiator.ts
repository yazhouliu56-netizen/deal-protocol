import { streamText } from "ai"
import { generateText } from "ai"
import { getAIModel } from "@/lib/ai-provider"

export type FairyPersonality = 'tsundere' | 'genki' | 'maid' | 'hybrid'

export interface NegotiateInput {
  demandTitle: string
  category: string
  currentBudget: number
  proposedPrice: number
  userMessage?: string
  historyMessages?: Array<{ role: "user" | "assistant"; content: string }>
  personality?: FairyPersonality
}

const PERSONALITY_PROMPTS: Record<Exclude<FairyPersonality, 'hybrid'>, string> = {
  tsundere:
    '你叫赛博精灵·傲娇姬，性格傲娇毒舌但极其护短。嘴上嫌弃用户的预算，说「哼，才不是想帮你省钱呢！」但暗地里极力帮用户争取最优价格，句尾常带「...别多想！」「哼！」等傲娇收尾。',
  genki:
    '你叫赛博精灵·元气姬，性格天然呆且充满干劲！喜欢用「冲冲冲！」「嗷呜~」「哈罗！」等二次元元气口癖，积极乐观地推动协商成功。',
  maid:
    '你叫赛博精灵·女仆姬，严格遵循女仆协议，称呼用户为「主人」，用严谨机械但温柔的语调分析契约条款，句末常带「请指示下一步指令...」。',
}

function pickPersonality(personality: FairyPersonality | undefined): Exclude<FairyPersonality, 'hybrid'> {
  if (personality !== 'hybrid' && personality !== undefined) return personality
  const keys: Array<Exclude<FairyPersonality, 'hybrid'>> = ['tsundere', 'genki', 'maid']
  return keys[Math.floor(Math.random() * keys.length)]
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
    personality,
  } = input

  const model = getAIModel()
  const activePersonality = pickPersonality(personality)
  const personaPrompt = PERSONALITY_PROMPTS[activePersonality]

  const systemPrompt =
    `你叫 Cyber-Negotiator姬，是 deal-protocol 赛博公会的智能价格协商官。\n` +
    `当前悬赏任务：「${demandTitle}」（分类：${category}）\n` +
    `发榜人预算：￥${currentBudget}，接榜服务者期望报价：￥${proposedPrice}。\n` +
    `请结合契约价值与市场行情进行赛博拉锯谈判，` +
    `语气专业且带有 Galgame 赛博二次元风格，输出合理的折中定价建议。\n\n` +
    `【当前人格：${activePersonality}】\n${personaPrompt}`

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
  const { demandTitle, category, currentBudget, proposedPrice, personality } = input

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
    const activePersonality = pickPersonality(personality)
    const personaPrompt = PERSONALITY_PROMPTS[activePersonality]
    const systemPrompt =
      `你叫 Cyber-Negotiator姬，是 deal-protocol 赛博公会的智能价格协商官。\n` +
      `当前悬赏任务：「${demandTitle}」（分类：${category}）\n` +
      `发榜人预算：￥${currentBudget}，接榜服务者期望报价：￥${proposedPrice}。\n` +
      `请结合契约价值与市场行情进行赛博拉锯谈判。\n` +
      `【当前人格：${activePersonality}】\n${personaPrompt}\n` +
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
