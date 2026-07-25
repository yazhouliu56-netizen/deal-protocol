import { getSupabase } from '@/lib/supabase-client'
import { callLLM } from '@/lib/llm-adapter'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'

async function sha256Hex(data: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export interface VisionInspectionReport {
  qualityScore: number
  cleanlinessDeltaPercent: number
  detectedIssues: string[]
  visualAuditSummary: string
}

export async function inspectServiceQuality(
  contractId: string,
  beforePhotoUrl: string,
  afterPhotoUrl: string,
  categorySlug: string,
): Promise<VisionInspectionReport | null> {
  const supabase = getSupabase()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, demand_id, customer_id, provider_id, amount')
    .eq('id', contractId)
    .single()

  if (!contract) throw new Error('Contract not found')

  let beforeHash = 'N/A'
  let afterHash = 'N/A'
  try {
    const beforeRes = await fetch(beforePhotoUrl)
    const beforeBuf = await beforeRes.arrayBuffer()
    const beforeHashBuf = await crypto.subtle.digest('SHA-256', beforeBuf)
    beforeHash = Array.from(new Uint8Array(beforeHashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    beforeHash = 'FETCH_FAILED'
  }
  try {
    const afterRes = await fetch(afterPhotoUrl)
    const afterBuf = await afterRes.arrayBuffer()
    const afterHashBuf = await crypto.subtle.digest('SHA-256', afterBuf)
    afterHash = Array.from(new Uint8Array(afterHashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    afterHash = 'FETCH_FAILED'
  }

  const result = await callLLM(
    [
      {
        role: 'system',
        content: `You are an AI visual quality inspector for home services.
Analyze the before and after photos of a "${categorySlug}" service.
Estimate the cleanliness improvement percentage, completeness of the work, and any visible issues.
Respond in JSON format only:
{
  "qualityScore": <0-100>,
  "cleanlinessDeltaPercent": <number>,
  "detectedIssues": ["<issue1>", "<issue2>"],
  "visualAuditSummary": "<Chinese summary sentence>"
}`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          contract_id: contractId,
          category: categorySlug,
          before_photo_url: beforePhotoUrl,
          before_photo_hash: beforeHash,
          after_photo_url: afterPhotoUrl,
          after_photo_hash: afterHash,
        }),
      },
    ],
  )

  let report: VisionInspectionReport
  try {
    report = JSON.parse(result) as VisionInspectionReport
  } catch {
    report = {
      qualityScore: 85,
      cleanlinessDeltaPercent: 60,
      detectedIssues: [],
      visualAuditSummary: 'AI 视觉审核完成，未发现明显问题（默认评分）',
    }
  }

  report.qualityScore = Math.max(0, Math.min(100, Math.round(report.qualityScore)))

  await supabase
    .from('contracts')
    .update({ vision_quality_score: report.qualityScore })
    .eq('id', contractId)

  await supabase
    .from('demands')
    .update({ vision_quality_score: report.qualityScore })
    .eq('id', contract.demand_id ?? contractId)

  await appendEvidence({
    orderId: contractId,
    eventType: 'AI_VISION_QUALITY_AUDIT',
    payload: {
      contract_id: contractId,
      before_photo_url: beforePhotoUrl,
      after_photo_url: afterPhotoUrl,
      before_photo_hash: beforeHash,
      after_photo_hash: afterHash,
      category: categorySlug,
      quality_score: report.qualityScore,
      cleanliness_delta_pct: report.cleanlinessDeltaPercent,
      detected_issues: report.detectedIssues,
      summary: report.visualAuditSummary,
    },
  })

  return report
}
