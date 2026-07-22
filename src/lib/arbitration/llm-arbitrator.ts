import { callLLM } from "@/lib/llm"
import type { ArbitrationRequest, ArbitrationVerdict } from "./types"

const SYSTEM_PROMPT = `你是一个中立公正的在线争议仲裁员。你的职责是根据事实做出公平裁决。
核心原则：
- 依据双方提供的证据做出判断
- 保护诚信交易，惩罚欺诈和违约
- 裁决应清晰、可执行、有依据
- 裁决金额必须在合同金额范围内`

function buildPrompt(req: ArbitrationRequest): string {
  return `请裁决以下争议：

服务: ${req.serviceTitle}
合同金额: ¥${req.contractAmount}
发起方: ${req.initiatorId === req.initiatorId ? "发起方" : "对方"} 发起争议
争议原因: ${req.reason}
证据: ${req.evidence}

请按以下JSON格式返回裁决（不要任何额外文字）：
{
  "resolution": "简要裁决说明（30字以内）",
  "providerAmount": 服务提供方获得的金额,
  "customerAmount": 客户获得的金额,
  "loser": "provider" 或 "customer" 或 "none",
  "confidence": 0-1之间的置信度
}

注意：
- providerAmount + customerAmount 必须等于 ${req.contractAmount}
- loser 填写败诉方，双方都有过错填 "none"`
}

export async function singleArbitrate(req: ArbitrationRequest): Promise<ArbitrationVerdict> {
  const prompt = buildPrompt(req)

  const raw = await callLLM(SYSTEM_PROMPT, prompt, { temperature: 0.2 })
  const result = JSON.parse(raw)

  const providerAmount = Math.max(0, Math.min(req.contractAmount, result.providerAmount ?? req.contractAmount * 0.5))
  const customerAmount = Math.max(0, Math.min(req.contractAmount, result.customerAmount ?? req.contractAmount * 0.5))

  let loserId = ""
  if (result.loser === "provider") loserId = req.responderId
  else if (result.loser === "customer") loserId = req.initiatorId
  // else loserId stays "" — no penalty

  return {
    resolution: result.resolution ?? "AI 自动裁决",
    providerAmount,
    customerAmount,
    confidence: result.confidence ?? 0.7,
    loserId,
  }
}
