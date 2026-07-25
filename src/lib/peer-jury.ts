import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '@/modules/m07-credit/credit-engine'

/**
 * Invite jury members for a dispute.
 * Selects up to 5 Tier 5 (trust_tier >= 5, credit base_score >= 900) users
 * who are not involved in the dispute, and inserts blind-invite notifications.
 */
export async function inviteJuryMembers(disputeId: string): Promise<string[]> {
  const supabase = getSupabase()

  // Get dispute details
  const { data: dispute } = await supabase
    .from('order_disputes')
    .select('*')
    .eq('id', disputeId)
    .single()

  if (!dispute) throw new Error('Dispute not found')

  const { data: order } = await supabase
    .from('contracts')
    .select('customer_id, provider_id')
    .eq('id', dispute.order_id)
    .single()

  if (!order) throw new Error('Order not found')

  const involvedIds = [order.customer_id, order.initiator_id].filter(Boolean)

  // Find Tier 5 users (trust_tier >= 5 via trigger on credit_records base_score >= 900)
  const { data: jurors } = await supabase
    .from('profiles')
    .select('id, nickname')
    .gte('trust_tier', 5)
    .not('id', 'in', `(${involvedIds.map((id) => `'${id}'`).join(',')})`)
    .limit(5)

  const jurorIds = (jurors ?? []).map((j) => j.id)

  // Send notifications (optional — depends on notification system)
  for (const jurorId of jurorIds) {
    await supabase.from('notifications').insert({
      user_id: jurorId,
      title: '社区陪审团邀请',
      content: `您已被选为纠纷 #${disputeId.slice(0, 8)} 的陪审员。请前往"小法庭"查看双方证据并投票。`,
      type: 'jury_invite',
    })
  }

  return jurorIds
}

/**
 * Cast a jury vote for a dispute.
 * Records the vote, automatically credits +5 contribution score to the juror.
 */
export async function castJuryVote(
  disputeId: string,
  jurorId: string,
  vote: 'demander' | 'provider',
  reason?: string,
): Promise<{ success: boolean }> {
  const supabase = getSupabase()

  const { data: dispute } = await supabase
    .from('order_disputes')
    .select('order_id')
    .eq('id', disputeId)
    .single()

  if (!dispute) throw new Error('Dispute not found')

  // Insert jury vote
  const { error } = await supabase.from('jury_votes').insert({
    dispute_id: disputeId,
    juror_id: jurorId,
    vote,
    reason: reason ?? null,
    reward_points: 5,
  })

  if (error) throw new Error(error.message)

  // Log evidence
  await appendEvidence({
    orderId: dispute.order_id,
    eventType: 'jury_vote_cast',
    payload: {
      dispute_id: disputeId,
      juror_id: jurorId,
      vote,
      reason: reason ?? null,
    },
    capturedBy: jurorId,
  })

  // Award +5 contribution credit via the credit engine's 'verification' event type
  // (contribution delta = +2 for 'verification', so we call it multiple times)
  const evidencePayload = JSON.stringify({
    dispute_id: disputeId,
    juror_id: jurorId,
    vote,
    action: 'jury_reward',
    timestamp: new Date().toISOString(),
  })

  const { data: evRecord } = await supabase
    .from('evidence_log')
    .insert({
      event_type: 'JURY_REWARD',
      payload: { dispute_id: disputeId, juror_id: jurorId, vote, reward_points: 5 },
    })
    .select('id')
    .single()

  if (evRecord) {
    // Call updateCredit with a custom evidence to award contribution
    // The 'verification' event gives +2 contribution. For +5, use 3 calls
    // or directly update credit records.
    // Simpler approach: directly update contribution score
    const { data: current } = await supabase
      .from('credit_records')
      .select('contribution_score')
      .eq('user_id', jurorId)
      .is('category', null)
      .maybeSingle()

    const currentContrib = (current?.contribution_score as number) ?? 60
    const newContrib = Math.min(100, currentContrib + 5)

    await supabase
      .from('credit_records')
      .update({ contribution_score: newContrib })
      .eq('user_id', jurorId)
      .is('category', null)

    await supabase.from('credit_events').insert({
      user_id: jurorId,
      dimension: 'contribution',
      previous_score: currentContrib,
      new_score: newContrib,
      delta: 5,
      reason: `Jury vote reward for dispute ${disputeId.slice(0, 8)}`,
      evidence_id: evRecord.id,
      triggered_by: 'system',
    })
  }

  return { success: true }
}

/**
 * Get jury voting results for a dispute.
 */
export async function getJuryResults(disputeId: string): Promise<{
  demanderVotes: number
  providerVotes: number
  totalVotes: number
  votes: { juror_id: string; vote: string; reason: string | null; created_at: string }[]
}> {
  const supabase = getSupabase()

  const { data: votes } = await supabase
    .from('jury_votes')
    .select('*')
    .eq('dispute_id', disputeId)

  const allVotes = (votes ?? []) as {
    juror_id: string
    vote: string
    reason: string | null
    created_at: string
  }[]

  const demanderVotes = allVotes.filter((v) => v.vote === 'demander').length
  const providerVotes = allVotes.filter((v) => v.vote === 'provider').length

  return {
    demanderVotes,
    providerVotes,
    totalVotes: allVotes.length,
    votes: allVotes,
  }
}
