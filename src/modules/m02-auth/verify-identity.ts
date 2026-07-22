import { getSupabase } from '@/lib/supabase-client'
import type { RiskTier } from '@/lib/contracts'
import { validateChineseId } from '@/lib/id-validator'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '@/modules/m07-credit/credit-engine'
import { encryptPII, maskPII } from '@/lib/pii-encrypt'

interface VerifyInput {
  userId: string
  phone: string
  realName: string
  idNumber: string
  category: string
}

interface VerifyResult {
  success: boolean
  status: 'verified' | 'pending_manual_review' | 'failed'
  reason?: string
}

export async function verifyIdentity(input: VerifyInput): Promise<VerifyResult> {
  const { data: config } = await getSupabase()
    .from('category_configs')
    .select('risk_tier, entry_requirements')
    .eq('category', input.category)
    .single()

  if (!config) {
    return { success: false, status: 'failed', reason: 'Unknown category' }
  }

  const riskTier = config.risk_tier as RiskTier
  const reqs = config.entry_requirements as Record<string, unknown> | null

  const identityOk = await realNameVerify(input.realName, input.idNumber)
  if (!identityOk) {
    return { success: false, status: 'failed', reason: 'Real name verification failed' }
  }

  const needsManualReview = reqs?.manual_review === true || riskTier === 'high'

  if (needsManualReview) {
    await getSupabase().from('users').update({ identity_verified: false }).eq('id', input.userId)

    await appendEvidence({
      eventType: 'audit',
      payload: {
        action: 'identity_verify',
        user_id: input.userId,
        category: input.category,
        risk_tier: riskTier,
        status: 'pending_manual_review',
        id_number_encrypted: encryptPII(input.idNumber),
      },
      capturedBy: input.userId,
    })

    return {
      success: true,
      status: 'pending_manual_review',
      reason: 'High-risk category, pending manual review',
    }
  }

  await getSupabase()
    .from('users')
    .update({ identity_verified: true })
    .eq('id', input.userId)

  console.log(`Identity verified for user ${input.userId}, idNumber: ${maskPII(input.idNumber)}`)

  const ev = await appendEvidence({
    eventType: 'identity_verified',
    payload: {
      user_id: input.userId,
      category: input.category,
      id_number_encrypted: encryptPII(input.idNumber),
    },
    capturedBy: input.userId,
  })
  if (!ev) throw new Error('Failed to append evidence for identity verification')
  await updateCredit({
    userId: input.userId,
    eventType: 'verification',
    evidenceId: ev.id,
    description: 'Identity verified - base credit initialized',
  })

  return { success: true, status: 'verified' }
}

async function realNameVerify(name: string, idNumber: string): Promise<boolean> {
  const apiKey = process.env.REAL_NAME_API_KEY

  if (apiKey && apiKey.length > 0) {
    try {
      const response = await fetch('https://api.weixin.qq.com/cgi-bin/realname/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ real_name: name, id_number: idNumber }),
      })
      if (response.ok) {
        const result = await response.json()
        return result?.verified === true
      }
    } catch {
      return false
    }
    return false
  }

  const validation = validateChineseId(idNumber)
  if (!validation.valid) {
    return false
  }
  return name.length >= 2
}
