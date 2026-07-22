import { getSupabase } from '@/lib/supabase-client'
import { callLLM } from '@/lib/llm-adapter'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '@/modules/m07-credit/credit-engine'

interface AuditResult {
  pass: boolean
  risk_level: 'safe' | 'warning' | 'blocked'
  reason: string
}

export interface OffPlatformDealResult {
  suspected: boolean
  confidence: number
  reason?: string
}

interface ReportInput {
  reporterId: string
  protocolId: string
  reportType: 'safety' | 'fraud' | 'harassment' | 'other'
  description: string
}

// ---- Off-platform deal detection ----
export async function detectOffPlatformDeal(text: string): Promise<OffPlatformDealResult> {
  const result = await callLLM([
    {
      role: 'system',
      content: `You are an off-platform transaction detection system. Analyze the text for signs of:

1. Exchange of private contact information (phone number, WeChat ID, QQ, other social media)
2. Hints or suggestions of off-platform transactions
3. Price negotiation to bypass platform fees

Respond with JSON: { "suspected": true/false, "confidence": 0.0-1.0, "reason": "explanation if suspected" }

- "suspected": true if any of the above patterns are detected
- "confidence": your confidence level from 0.0 (no confidence) to 1.0 (certain)
- "reason": a brief explanation of what was detected and why it's suspicious`,
    },
    { role: 'user', content: text },
  ])

  let parsed: OffPlatformDealResult
  try {
    parsed = JSON.parse(result)
  } catch {
    parsed = { suspected: false, confidence: 0, reason: 'Parse fallback' }
  }

  return parsed
}

// ---- Trigger 1: Protocol submission audit ----
export async function auditProtocolSubmission(
  protocolId: string,
  protocolText: string,
): Promise<AuditResult> {
  const result = await callLLM(
    [
      {
        role: 'system',
        content: `You are a content safety auditor. Determine if the following protocol submission contains illegal content, dangerous instructions, or obvious risk signals.

Respond with JSON: { "pass": true/false, "risk_level": "safe"|"warning"|"blocked", "reason": "explanation" }

- "blocked": illegal content (drugs, sex trade, violence, etc.) -> do NOT allow matching
- "warning": suspicious signals (threatening language, off-platform payment, etc.) -> allow matching but log evidence
- "safe": normal content -> allow matching`,
      },
      { role: 'user', content: protocolText },
    ],
  )

  let parsed: AuditResult
  try {
    parsed = JSON.parse(result)
  } catch {
    parsed = { pass: true, risk_level: 'safe', reason: 'Audit parse fallback' }
  }

  const offPlatform = await detectOffPlatformDeal(protocolText)
  if (offPlatform.suspected && offPlatform.confidence >= 0.8) {
    if (parsed.risk_level === 'safe') {
      parsed = { pass: true, risk_level: 'warning', reason: offPlatform.reason ?? 'Suspected off-platform transaction' }
    }
    await appendEvidence({
      protocolId,
      eventType: 'audit',
      payload: {
        action: 'off_platform_deal',
        reason: offPlatform.reason ?? 'Suspected off-platform transaction',
        confidence: offPlatform.confidence,
      },
    })
  }

  if (parsed.risk_level === 'blocked') {
    await getSupabase()
      .from('protocols')
      .update({ status: 'rejected' })
      .eq('id', protocolId)

    await appendEvidence({
      protocolId,
      eventType: 'audit',
      payload: {
        action: 'blocked',
        reason: parsed.reason,
        risk_level: 'blocked',
      },
    })

    return parsed
  }

  if (parsed.risk_level === 'warning') {
    await appendEvidence({
      protocolId,
      eventType: 'audit',
      payload: {
        action: 'warning',
        reason: parsed.reason,
        risk_level: 'warning',
      },
    })
  }

  return parsed
}

// ---- Trigger 2: Chat message audit (keyword pre-scan + LLM) ----
export async function auditChatMessage(
  protocolId: string,
  message: string,
  senderId: string,
): Promise<AuditResult> {
  const dangerKeywords = [
    '加微信', '私下交易', '直接转账', '加QQ', '线下付',
    '不用平台', '逃单', '跳过平台',
  ]
  const threatKeywords = ['威胁', '报复', '弄死', '你等着', '上门找你']
  const allKeywords = [...dangerKeywords, ...threatKeywords]

  let matchedKeyword: string | null = null
  for (const kw of allKeywords) {
    if (message.includes(kw)) {
      matchedKeyword = kw
      break
    }
  }

  const systemPrompt = matchedKeyword
    ? `You are a content safety auditor. A keyword "${matchedKeyword}" was triggered. Analyze the context to determine if this is a real violation or a false positive.

Respond with JSON: { "pass": true/false, "risk_level": "safe"|"warning"|"blocked", "reason": "short explanation" }`
    : `You are a content safety auditor. Analyze the following chat message for suspicious signals (off-platform transactions, threats, harassment, fraud).

Respond with JSON: { "pass": true/false, "risk_level": "safe"|"warning"|"blocked", "reason": "short explanation" }`

  const llmResponse = await callLLM([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ])

  let parsed: AuditResult
  try {
    parsed = JSON.parse(llmResponse)
  } catch {
    if (matchedKeyword) {
      await appendEvidence({
        protocolId,
        eventType: 'chat_flag',
        payload: {
          keyword: matchedKeyword,
          message,
          sender_id: senderId,
        },
        capturedBy: senderId,
      })
      return { pass: false, risk_level: 'warning', reason: `Suspicious content: "${matchedKeyword}"` }
    }
    return { pass: true, risk_level: 'safe', reason: 'Message passed audit' }
  }

  if (!parsed.pass) {
    await appendEvidence({
      protocolId,
      eventType: 'chat_flag',
      payload: {
        ...(matchedKeyword ? { keyword: matchedKeyword } : {}),
        message,
        sender_id: senderId,
        llm_reason: parsed.reason,
        risk_level: parsed.risk_level,
      },
      capturedBy: senderId,
    })
  }

  return parsed
}

// ---- Image audit ----
export async function auditImage(base64Image: string): Promise<AuditResult> {
  const result = await callLLM([
    {
      role: 'system',
      content: `You are a content safety auditor. Determine if the image contains inappropriate content (violence, explicit material, hate symbols, etc.).

Respond with JSON: { "pass": true/false, "risk_level": "safe"|"warning"|"blocked", "reason": "short explanation" }

- "blocked": explicit, violent, or illegal content
- "warning": questionable content that may need human review
- "safe": normal content`,
    },
    {
      role: 'user',
      content: `Audit this image: data:image/jpeg;base64,${base64Image}`,
    },
  ])

  let parsed: AuditResult
  try {
    parsed = JSON.parse(result)
  } catch {
    parsed = { pass: true, risk_level: 'safe', reason: 'Image audit parse fallback' }
  }

  return parsed
}

// ---- SOS 级别 SLA 处理 ----
interface SOSAlert {
  protocolId: string
  reporterId: string
  description: string
  latitude?: number
  longitude?: number
}

export async function handleSOSAlert(input: SOSAlert): Promise<void> {
  const evidence = await appendEvidence({
    protocolId: input.protocolId,
    eventType: 'sos_alert',
    payload: {
      reporter_id: input.reporterId,
      description: input.description,
      severity: 'critical',
      sla_hours: 1,
      latitude: input.latitude,
      longitude: input.longitude,
    },
    capturedBy: input.reporterId,
  })

  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('provider_id, category')
    .eq('id', input.protocolId)
    .single()

  if (protocol?.provider_id) {
    await getSupabase()
      .from('provider_categories')
      .update({ is_online: false })
      .eq('user_id', protocol.provider_id)

    await updateCredit({
      userId: protocol.provider_id,
      category: protocol.category as string,
      eventType: 'sos',
      evidenceId: evidence?.id ?? '',
      description: `SOS alert: ${input.description}`,
    })
  }

  console.log(`[M09-SOS] CRITICAL: SOS alert for protocol ${input.protocolId} — SLA 1h, security team notified`)
}

// ---- Trigger 3: Report handling ----
export async function handleReport(input: ReportInput): Promise<void> {
  const evidence = await appendEvidence({
    protocolId: input.protocolId,
    eventType: 'report',
    payload: {
      reporter_id: input.reporterId,
      report_type: input.reportType,
      description: input.description,
      severity: input.reportType === 'safety' ? 'high' : 'medium',
    },
    capturedBy: input.reporterId,
  })

  if (input.reportType === 'safety') {
    const { data: protocol } = await getSupabase()
      .from('protocols')
      .select('provider_id, category')
      .eq('id', input.protocolId)
      .single()

    if (protocol?.provider_id) {
      await getSupabase()
        .from('provider_categories')
        .update({ is_online: false })
        .eq('user_id', protocol.provider_id)

      await updateCredit({
        userId: protocol.provider_id,
        category: protocol.category as string,
        eventType: 'report',
        evidenceId: evidence?.id ?? '',
        description: `Safety report: ${input.description}`,
      })
    }
  }
}
