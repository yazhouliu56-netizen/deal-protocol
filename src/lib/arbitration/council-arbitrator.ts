import { callLLM } from "@/lib/llm"
import type { ArbitrationRequest, ArbitrationVerdict, CouncilVote } from "./types"

const PERSONAS = [
  {
    id: "strict_judge",
    label: "严格法官",
    systemPrompt: `你是一个严格依法裁决的法官。你严格依据合同条款和证据规则做出判断。
- 没有充分证据的诉求一概不支持
- 严格按合同金额分配责任
- 关注法律条文和先例逻辑
- 不接受情感诉求和假设性陈述`,
  },
  {
    id: "consumer_advocate",
    label: "消费者保护官",
    systemPrompt: `你是一个倾向于保护消费者的仲裁员。你的核心使命是保护交易中的弱势方。
- 倾向于做出对消费者有利的解释
- 关注服务是否达到合理预期标准
- 考虑用户的实际体验和感受
- 对服务商的义务要求较高`,
  },
  {
    id: "practical_arbitrator",
    label: "商业仲裁员",
    systemPrompt: `你是一个务实的商业仲裁员。你的目标是达成一个双方都能接受的实际方案。
- 关注"什么方案能真正解决问题"
- 考虑执行成本和时间成本
- 倾向于折中方案而非全输全赢
- 重视长期关系和商业合理性`,
  },
]

const COUNCIL_SYSTEM = `你是一个争议仲裁协调员。你的职责是汇总多位仲裁员的意见，分析共识与分歧，做出最终裁决。
规则：
- 多数票优先
- 如果票数分散，以中间方案为准
- 最终裁决必须有清晰的依据`

function buildPrompt(req: ArbitrationRequest): string {
  return `请裁决以下争议：

服务: ${req.serviceTitle}
合同金额: ¥${req.contractAmount}
发起方: ${req.initiatorId} 发起争议
争议原因: ${req.reason}
证据: ${req.evidence}

请按以下JSON格式返回裁决（不要任何额外文字）：
{
  "resolution": "简要裁决说明（30字以内）",
  "providerAmount": 服务提供方获得的金额,
  "customerAmount": 客户获得的金额,
  "loser": "provider" 或 "customer" 或 "none",
  "confidence": 0-1之间的置信度,
  "reasoning": "裁决推理过程"
}

注意：
- providerAmount + customerAmount 必须等于 ${req.contractAmount}
- loser 填写败诉方，双方都有过错填 "none"`
}

async function personaArbitrate(persona: typeof PERSONAS[0], req: ArbitrationRequest): Promise<CouncilVote> {
  const raw = await callLLM(persona.systemPrompt, buildPrompt(req), { temperature: 0.4 })
  const result = JSON.parse(raw)

  return {
    model: "gpt-4o-mini",
    persona: persona.id,
    verdict: result.resolution ?? "AI 裁决",
    providerAmount: Math.max(0, Math.min(req.contractAmount, result.providerAmount ?? req.contractAmount * 0.5)),
    customerAmount: Math.max(0, Math.min(req.contractAmount, result.customerAmount ?? req.contractAmount * 0.5)),
    confidence: result.confidence ?? 0.7,
    reasoning: result.reasoning ?? "",
  }
}

export async function councilArbitrate(req: ArbitrationRequest): Promise<ArbitrationVerdict> {
  const votes = await Promise.all(PERSONAS.map((p) => personaArbitrate(p, req)))

  const providerAmounts = votes.map((v) => v.providerAmount)
  const customerAmounts = votes.map((v) => v.customerAmount)
  const avgProvider = providerAmounts.reduce((a, b) => a + b, 0) / providerAmounts.length

  const loserVotes = votes.map((v) => {
    const raw = JSON.parse(`{"loser": "none"}`)
    return raw.loser
  })
  const loserCount: Record<string, number> = {}
  for (const l of loserVotes) {
    loserCount[l] = (loserCount[l] ?? 0) + 1
  }
  const majorityLoser = Object.entries(loserCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "none"

  let loserId = ""
  if (majorityLoser === "provider") loserId = req.responderId
  else if (majorityLoser === "customer") loserId = req.initiatorId

  const consensus = (await callLLM(
    COUNCIL_SYSTEM,
    `请汇总以下 ${votes.length} 位仲裁员的裁决意见，做出最终裁决：

${votes.map((v, i) => `【${PERSONAS[i].label}】
- 裁决: ${v.verdict}
- 服务方分得: ¥${v.providerAmount}
- 客户方分得: ¥${v.customerAmount}
- 置信度: ${v.confidence}
- 推理: ${v.reasoning}`).join("\n\n")}

争议信息：
服务: ${req.serviceTitle}
合同金额: ¥${req.contractAmount}
争议原因: ${req.reason}

请按JSON格式返回最终裁决：
{
  "resolution": "最终裁决说明（30字以内）",
  "providerAmount": 最终服务方分得金额,
  "customerAmount": 最终客户方分得金额
}
注意：providerAmount + customerAmount 必须等于 ${req.contractAmount}`,
    { temperature: 0.2 },
  ))

  const decision = JSON.parse(consensus)
  const providerAmount = Math.max(0, Math.min(req.contractAmount, decision.providerAmount ?? avgProvider))
  const customerAmount = req.contractAmount - providerAmount

  return {
    resolution: decision.resolution ?? "议会多数裁决",
    providerAmount,
    customerAmount,
    confidence: votes.reduce((s, v) => s + v.confidence, 0) / votes.length,
    loserId,
    councilVotes: votes,
  }
}
