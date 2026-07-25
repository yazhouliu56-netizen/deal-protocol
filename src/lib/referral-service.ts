import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'

export async function processReferralCommission(
  protocolId: string,
  totalCommission: number,
): Promise<{ rewarded: boolean; referrerId?: string; rewardAmount?: number }> {
  const commissionRate = 0.10
  const rewardAmount = Math.round(totalCommission * commissionRate * 100) / 100
  if (rewardAmount <= 0) return { rewarded: false }

  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('demander_id, provider_id')
    .eq('id', protocolId)
    .single()

  if (!protocol) return { rewarded: false }

  const { data: buyer } = await getSupabase()
    .from('profiles')
    .select('referrer_id')
    .eq('id', protocol.demander_id)
    .single()

  const referrerId = buyer?.referrer_id ?? null

  if (!referrerId) return { rewarded: false }

  const { data: wallet } = await getSupabase()
    .from('provider_wallets')
    .select('balance')
    .eq('provider_id', referrerId)
    .single()

  const newBalance = wallet
    ? Math.round((Number(wallet.balance) + rewardAmount) * 100) / 100
    : rewardAmount

  if (wallet) {
    await getSupabase()
      .from('provider_wallets')
      .update({ balance: newBalance })
      .eq('provider_id', referrerId)
  } else {
    await getSupabase()
      .from('provider_wallets')
      .insert({ provider_id: referrerId, balance: rewardAmount })
  }

  await getSupabase()
    .from('wallet_logs')
    .insert({
      provider_id: referrerId,
      amount: rewardAmount,
      type: 'REFERRAL_REWARD',
      description: `Referral commission: protocol ${protocolId}`,
    })

  await appendEvidence({
    protocolId,
    eventType: 'REFERRAL_REWARD',
    payload: { referrer_id: referrerId, reward_amount: rewardAmount, commission_rate: commissionRate },
  })

  return { rewarded: true, referrerId, rewardAmount }
}
