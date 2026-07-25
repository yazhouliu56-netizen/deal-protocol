import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'

export interface MilestoneInput {
  title: string
  amount: number
  stepNumber: number
}

export interface MilestoneRecord {
  id: string
  contract_id: string
  title: string
  amount: number
  step_number: number
  status: 'PENDING' | 'HELD' | 'SETTLED' | 'DISPUTED'
  created_at: string
  updated_at: string
}

export async function createMilestonesForContract(
  contractId: string,
  milestones: MilestoneInput[],
): Promise<{ success: boolean; records: MilestoneRecord[] }> {
  const records: MilestoneRecord[] = []

  for (const m of milestones) {
    const { data, error } = await getSupabase()
      .from('milestone_schedules')
      .insert({
        contract_id: contractId,
        title: m.title,
        amount: m.amount,
        step_number: m.stepNumber,
        status: 'PENDING',
      })
      .select()
      .single()

    if (error) {
      console.error(`[MilestoneEscrow] Insert error for "${m.title}":`, error.message)
      continue
    }

    records.push(data as unknown as MilestoneRecord)
  }

  if (records.length > 0) {
    await getSupabase()
      .from('milestone_schedules')
      .update({ status: 'HELD' })
      .eq('contract_id', contractId)
      .eq('status', 'PENDING')

    for (const r of records) {
      r.status = 'HELD'
    }

    await appendEvidence({
      protocolId: contractId,
      eventType: 'MILESTONES_CREATED',
      payload: { milestones: milestones.map((m) => ({ title: m.title, amount: m.amount })) },
    })
  }

  return { success: records.length > 0, records }
}

export async function releaseMilestoneEscrow(
  milestoneId: string,
): Promise<{ success: boolean; milestone?: MilestoneRecord }> {
  const { data: milestone, error: fetchErr } = await getSupabase()
    .from('milestone_schedules')
    .select('*')
    .eq('id', milestoneId)
    .single()

  if (fetchErr || !milestone) {
    console.error(`[MilestoneEscrow] Milestone ${milestoneId} not found:`, fetchErr?.message)
    return { success: false }
  }

  const ms = milestone as unknown as MilestoneRecord
  if (ms.status !== 'HELD') {
    console.error(`[MilestoneEscrow] Milestone ${milestoneId} status is ${ms.status}, expected HELD`)
    return { success: false }
  }

  const { data: contract } = await getSupabase()
    .from('contracts')
    .select('provider_id')
    .eq('id', ms.contract_id)
    .single()

  if (!contract) {
    console.error(`[MilestoneEscrow] Contract ${ms.contract_id} not found`)
    return { success: false }
  }

  const { data: wallet } = await getSupabase()
    .from('provider_wallets')
    .select('balance')
    .eq('provider_id', contract.provider_id)
    .single()

  const newBalance = wallet
    ? Math.round((Number(wallet.balance) + ms.amount) * 100) / 100
    : ms.amount

  if (wallet) {
    await getSupabase()
      .from('provider_wallets')
      .update({ balance: newBalance })
      .eq('provider_id', contract.provider_id)
  } else {
    await getSupabase()
      .from('provider_wallets')
      .insert({ provider_id: contract.provider_id, balance: ms.amount })
  }

  await getSupabase()
    .from('wallet_logs')
    .insert({
      provider_id: contract.provider_id,
      amount: ms.amount,
      type: 'milestone_payout',
      description: `Milestone release: ${ms.title} (step ${ms.step_number}) for contract ${ms.contract_id}`,
    })

  const { data: updated, error: updateErr } = await getSupabase()
    .from('milestone_schedules')
    .update({ status: 'SETTLED', updated_at: new Date().toISOString() })
    .eq('id', milestoneId)
    .select()
    .single()

  if (updateErr) {
    console.error(`[MilestoneEscrow] Update error:`, updateErr.message)
    return { success: false }
  }

  await appendEvidence({
    protocolId: ms.contract_id,
    eventType: 'MILESTONE_SETTLED',
    payload: { milestone_id: milestoneId, title: ms.title, amount: ms.amount, step_number: ms.step_number },
  })

  return { success: true, milestone: updated as unknown as MilestoneRecord }
}
