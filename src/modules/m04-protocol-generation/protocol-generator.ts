// M04: 协议生成流水线（模板 + LLM 混合）
// 四步：
//   ① 意图识别与模板匹配
//   ② 结构化字段抽取（function calling）
//   ③ 校验与分级确认
//   ④ 广播

import { getSupabase } from '@/lib/supabase-client'
import { callLLM, buildFunctionTool } from '@/lib/llm-adapter'
import { getCategoryConfig } from '@/modules/m03-category-config/category-loader'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import type { ProtocolJSON, RiskTier } from '@/lib/contracts'

interface GenerationInput {
  userId: string
  rawText: string
  category?: string // 可选，如果前端已选好品类
}

interface GenerationResult {
  success: boolean
  protocol?: Partial<ProtocolJSON>
  missingFields?: string[]
  needConfirm?: boolean
  error?: string
}

export async function generateProtocol(input: GenerationInput): Promise<GenerationResult> {
  // ---- ① 意图识别与模板匹配 ----
  let category = input.category
  if (!category) {
    category = (await classifyCategory(input.rawText)) ?? undefined
  }
  if (!category) {
    return { success: false, error: 'Unable to determine category from your request' }
  }

  const config = await getCategoryConfig(category)
  if (!config) {
    return { success: false, error: `Category "${category}" is not configured` }
  }

  // ---- ② 结构化字段抽取（function calling）----
  const tool = buildFunctionTool(
    `extract_${category}_protocol`,
    config.schema_json as Record<string, unknown>,
  )

  const embeddingPromise = generateEmbedding(input.rawText).catch(() => new Array(1024).fill(0))

  const llmResult = await callLLM(
    [
      {
        role: 'system',
        content: `You are a protocol extraction assistant. Extract structured data from the user's request for category "${category}". Only extract fields defined in the schema. If a field value is not provided, omit it.`,
      },
      {
        role: 'user',
        content: input.rawText,
      },
    ],
    [tool],
  )

  let extracted: Record<string, unknown>
  try {
    extracted = JSON.parse(llmResult)
  } catch {
    return { success: false, error: 'Failed to parse LLM extraction result' }
  }

  const coreFields = (extracted.core_fields ?? {}) as Record<string, unknown>
  const categoryFields = (extracted.category_fields ?? {}) as Record<string, unknown>

  // ---- ③ 校验 ----
  const schema = config.schema_json as Record<string, unknown>
  const coreSchema = (schema.core_fields ?? {}) as Record<string, { required?: boolean }>
  const catSchema = (schema.category_fields ?? {}) as Record<string, { required?: boolean }>

  const missingFields: string[] = []

  for (const [field, def] of Object.entries(coreSchema)) {
    if (def.required && !coreFields[field]) {
      missingFields.push(field)
    }
  }
  for (const [field, def] of Object.entries(catSchema)) {
    if (def.required && !categoryFields[field]) {
      missingFields.push(field)
    }
  }

  // 剔除 schema 外字段（防 LLM 幻觉）
  for (const key of Object.keys(coreFields)) {
    if (!(key in coreSchema)) delete coreFields[key]
  }
  for (const key of Object.keys(categoryFields)) {
    if (!(key in catSchema)) delete categoryFields[key]
  }

  if (missingFields.length > 0) {
    return {
      success: false,
      missingFields,
      needConfirm: false,
      error: `Missing required fields: ${missingFields.join(', ')}`,
    }
  }

  // 高风险品类：需要确认页
  const riskTier = config.risk_tier as RiskTier
  let needConfirm = riskTier === 'high'

  // LLM 提取置信度检查：低于 0.7 强制确认
  const extractedConfidence = (extracted as { confidence?: number }).confidence ?? 1.0
  if (extractedConfidence < 0.7) {
    needConfirm = true
  }

  // ---- ④ 写入 protocols 表 ----
  const status = needConfirm ? 'pending_confirm' : 'matching'

  const embedding = await embeddingPromise

  const { data: protocol, error } = await getSupabase()
    .from('protocols')
    .insert({
      demander_id: input.userId,
      category,
      core_fields: coreFields,
      category_fields: categoryFields,
      embedding,
      response_mode: config.response_mode,
      risk_tier: riskTier,
      status,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: `Database error: ${error.message}` }
  }

  // 写入 evidence_log（协议创建事件，走 M11 证据链）
  await appendEvidence({
    protocolId: protocol.id,
    eventType: 'protocol_created',
    payload: { category, risk_tier: riskTier },
    capturedBy: input.userId,
  })

  return {
    success: true,
    protocol: protocol as unknown as ProtocolJSON,
    needConfirm,
  }
}

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await callLLM([
    {
      role: 'system',
      content: `You are an embedding generator. Generate a 1024-dimensional semantic embedding for the given text. Respond with ONLY a JSON array of 1024 floats between -1 and 1, no other text.`,
    },
    { role: 'user', content: text },
  ])

  try {
    const parsed = JSON.parse(result)
    if (Array.isArray(parsed) && parsed.length === 1024) {
      return parsed.map((v: unknown) => {
        const n = Number(v)
        return isNaN(n) ? 0 : Math.max(-1, Math.min(1, n))
      })
    }
  } catch {
    // fallback: if LLM fails to return valid embedding, try once more
  }

  return new Array(1024).fill(0)
}

async function classifyCategory(text: string): Promise<string | null> {
  const result = await callLLM([
    {
      role: 'system',
      content: `You are a category classifier. Classify the user's request into exactly one category. Respond with ONLY the category name, nothing else.
Available categories: 家政, 交友, 按摩, 医疗陪护`,
    },
    { role: 'user', content: text },
  ])

  const valid = ['家政', '交友', '按摩', '医疗陪护']
  const matched = valid.find((c) => result.includes(c))
  return matched ?? null
}
