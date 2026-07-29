import { getSupabase, getServiceClient } from '@/lib/supabase-client'
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
  status: 'PENDING' | 'HELD' | 'SETTLED' | 'DISPUTED' | 'submitted' | 'completed' | 'skipped'
  auto_confirm_at: string | null
  created_at: string
  updated_at: string
}

export interface MilestoneCheckpoint {
  id: string
  contract_id: string
  title: string
  amount: number
  step_number: number
  status: 'pending' | 'submitted' | 'completed' | 'disputed' | 'skipped'
  auto_confirm_at: string | null
  created_at: string
}

export interface ProcessExpiredResult {
  processedCount: number
  errors: string[]
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

export async function submitMilestoneCheckpoint(
  milestoneId: string,
  hoursToAutoConfirm: number = 24
): Promise<{ success: boolean; autoConfirmAt: string }> {
  const supabase = getServiceClient()
  const autoConfirmAt = new Date(Date.now() + hoursToAutoConfirm * 3600 * 1000).toISOString()

  const { error } = await supabase
    .from('milestone_schedules')
    .update({
      status: 'submitted',
      auto_confirm_at: autoConfirmAt,
    })
    .eq('id', milestoneId)
    .eq('status', 'pending')

  if (error) {
    throw new Error(`Failed to submit milestone checkpoint: ${error.message}`)
  }

  return { success: true, autoConfirmAt }
}

export async function confirmMilestoneCheckpoint(milestoneId: string): Promise<{ success: boolean }> {
  const supabase = getServiceClient()

  const { error } = await supabase
    .from('milestone_schedules')
    .update({
      status: 'completed',
      auto_confirm_at: null,
    })
    .eq('id', milestoneId)

  if (error) {
    throw new Error(`Failed to confirm milestone checkpoint: ${error.message}`)
  }

  return { success: true }
}

export async function processExpiredCheckpoints(): Promise<ProcessExpiredResult> {
  const supabase = getServiceClient()
  const now = new Date().toISOString()
  const errors: string[] = []
  let processedCount = 0

  try {
    const { data: expiredCheckpoints, error: fetchError } = await supabase
      .from('milestone_schedules')
      .select('id, contract_id, title, amount')
      .eq('status', 'submitted')
      .lte('auto_confirm_at', now)

    if (fetchError) {
      return { processedCount: 0, errors: [fetchError.message] }
    }

    if (!expiredCheckpoints || expiredCheckpoints.length === 0) {
      return { processedCount: 0, errors: [] }
    }

    for (const checkpoint of expiredCheckpoints) {
      const { error: updateError } = await supabase
        .from('milestone_schedules')
        .update({
          status: 'completed',
          auto_confirm_at: null,
        })
        .eq('id', checkpoint.id)
        .eq('status', 'submitted')

      if (updateError) {
        errors.push(`Checkpoint ${checkpoint.id} error: ${updateError.message}`)
      } else {
        processedCount++
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`System error: ${msg}`)
  }

  return { processedCount, errors }
}
