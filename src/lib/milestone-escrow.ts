import { getSupabase, getServiceClient } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import type { Tables } from '@/types/database.types'

export interface MilestoneInput {
  title: string
  amount: number
  stepNumber: number
}

export interface ProcessExpiredResult {
  processedCount: number
  errors: string[]
}

export async function createMilestonesForContract(
  contractId: string,
  milestones: MilestoneInput[],
): Promise<{ success: boolean; records: Tables<'milestone_schedules'>[] }> {
  const records: Tables<'milestone_schedules'>[] = []

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

    records.push(data as unknown as Tables<'milestone_schedules'>)
  }

  if (records.length > 0) {
    await getSupabase()
      .from('milestone_schedules')
      .update({ status: 'HELD' })
      .eq('contract_id', contractId)
      .eq('status', 'PENDING')

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
): Promise<{ success: boolean; milestone?: Tables<'milestone_schedules'> }> {
  const supabase = getServiceClient()

  const { data: milestone, error: fetchErr } = await supabase
    .from('milestone_schedules')
    .select('*')
    .eq('id', milestoneId)
    .single()

  if (fetchErr || !milestone) {
    console.error(`[MilestoneEscrow] Milestone ${milestoneId} not found:`, fetchErr?.message)
    return { success: false }
  }

  const ms = milestone as unknown as Tables<'milestone_schedules'>
  if (ms.status !== 'HELD') {
    console.error(`[MilestoneEscrow] Milestone ${milestoneId} status is ${ms.status}, expected HELD`)
    return { success: false }
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('provider_id')
    .eq('id', ms.contract_id)
    .single()

  if (!contract) {
    console.error(`[MilestoneEscrow] Contract ${ms.contract_id} not found`)
    return { success: false }
  }

  const { data: existingLog } = await supabase
    .from('wallet_logs')
    .select('id')
    .eq('order_id', ms.contract_id)
    .eq('type', 'MILESTONE_PAYOUT')
    .maybeSingle()

  if (existingLog) {
    console.warn(`[MilestoneEscrow] wallet_logs already exists for contract ${ms.contract_id}, skipping wallet credit`)
  } else {
    const { data: wallet } = await supabase
      .from('provider_wallets')
      .select('balance')
      .eq('provider_id', contract.provider_id)
      .single()

    const newBalance = wallet
      ? Math.round((Number(wallet.balance) + ms.amount) * 100) / 100
      : ms.amount

    if (wallet) {
      await supabase
        .from('provider_wallets')
        .update({ balance: newBalance })
        .eq('provider_id', contract.provider_id)
    } else {
      await supabase
        .from('provider_wallets')
        .insert({ provider_id: contract.provider_id, balance: ms.amount })
    }

    await supabase
      .from('wallet_logs')
      .insert({
        provider_id: contract.provider_id,
        amount: ms.amount,
        type: 'MILESTONE_PAYOUT',
        order_id: ms.contract_id,
        description: `Milestone release: ${ms.title} (step ${ms.step_number}) for contract ${ms.contract_id}`,
      })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('milestone_schedules')
    .update({ status: 'SETTLED', updated_at: new Date().toISOString() })
    .eq('id', milestoneId)
    .eq('status', 'HELD')
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

  return { success: true, milestone: updated as unknown as Tables<'milestone_schedules'> }
}

export async function submitMilestoneCheckpoint(
  milestoneId: string,
  hoursToAutoConfirm: number = 24,
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

export async function confirmMilestoneCheckpoint(
  checkpointId: string,
  userId: string,
): Promise<{ success: boolean }> {
  const supabase = getServiceClient()

  const { data: updatedCheckpoint, error } = await supabase
    .from('milestone_schedules')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', checkpointId)
    .eq('status', 'submitted')
    .select()
    .single()

  if (error || !updatedCheckpoint) {
    throw new Error(`Checkpoint has been settled or is not in a completable state; duplicate release blocked.`)
  }

  const cp = updatedCheckpoint as unknown as Tables<'milestone_schedules'>

  const { data: existingLog } = await supabase
    .from('wallet_logs')
    .select('id')
    .eq('order_id', cp.contract_id)
    .eq('type', 'CHECKPOINT_RELEASE')
    .maybeSingle()

  if (existingLog) {
    console.warn(`[Escrow Security] Checkpoint ${checkpointId} wallet log exists, skipping wallet credit`)
    return { success: true }
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('provider_id, demand_id')
    .eq('id', cp.contract_id)
    .single()

  if (!contract) {
    throw new Error(`Contract ${cp.contract_id} not found for checkpoint release`)
  }

  const { data: wallet } = await supabase
    .from('provider_wallets')
    .select('balance')
    .eq('provider_id', contract.provider_id)
    .single()

  const newBalance = wallet
    ? Math.round((Number(wallet.balance) + cp.amount) * 100) / 100
    : cp.amount

  if (wallet) {
    await supabase
      .from('provider_wallets')
      .update({ balance: newBalance })
      .eq('provider_id', contract.provider_id)
  } else {
    await supabase
      .from('provider_wallets')
      .insert({ provider_id: contract.provider_id, balance: cp.amount })
  }

  await supabase
    .from('wallet_logs')
    .insert({
      provider_id: contract.provider_id,
      amount: cp.amount,
      type: 'CHECKPOINT_RELEASE',
      order_id: cp.contract_id,
      description: `Checkpoint release: ${cp.title} (step ${cp.step_number}) for checkpoint ${checkpointId}`,
    })

  await appendEvidence({
    protocolId: contract.demand_id ?? undefined,
    orderId: cp.contract_id,
    eventType: 'CHECKPOINT_UNFROZEN',
    payload: {
      checkpoint_id: checkpointId,
      title: cp.title,
      amount: cp.amount,
      step_number: cp.step_number,
      provider_id: contract.provider_id,
    },
  })

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
        continue
      }

      const { data: existingLog } = await supabase
        .from('wallet_logs')
        .select('id')
        .eq('order_id', checkpoint.contract_id)
        .eq('type', 'CHECKPOINT_RELEASE')
        .maybeSingle()

      if (existingLog) {
        console.warn(`[Escrow Cron] checkpoint ${checkpoint.id} already credited, skipping`)
        processedCount++
        continue
      }

      const { data: contract } = await supabase
        .from('contracts')
        .select('provider_id, demand_id')
        .eq('id', checkpoint.contract_id)
        .single()

      if (!contract) {
        errors.push(`Checkpoint ${checkpoint.id}: contract ${checkpoint.contract_id} not found`)
        continue
      }

      const { data: wallet } = await supabase
        .from('provider_wallets')
        .select('balance')
        .eq('provider_id', contract.provider_id)
        .single()

      const newBalance = wallet
        ? Math.round((Number(wallet.balance) + checkpoint.amount) * 100) / 100
        : checkpoint.amount

      if (wallet) {
        await supabase
          .from('provider_wallets')
          .update({ balance: newBalance })
          .eq('provider_id', contract.provider_id)
      } else {
        await supabase
          .from('provider_wallets')
          .insert({ provider_id: contract.provider_id, balance: checkpoint.amount })
      }

      await supabase
        .from('wallet_logs')
        .insert({
          provider_id: contract.provider_id,
          amount: checkpoint.amount,
          type: 'CHECKPOINT_RELEASE',
          order_id: checkpoint.contract_id,
          description: `Auto release expired checkpoint: ${checkpoint.title} for checkpoint ${checkpoint.id}`,
        })

      await appendEvidence({
        protocolId: contract.demand_id ?? undefined,
        orderId: checkpoint.contract_id,
        eventType: 'CHECKPOINT_UNFROZEN',
        payload: {
          checkpoint_id: checkpoint.id,
          title: checkpoint.title,
          amount: checkpoint.amount,
          contract_id: checkpoint.contract_id,
          provider_id: contract.provider_id,
          trigger: 'auto_expiry',
        },
      })

      processedCount++
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`System error: ${msg}`)
  }

  return { processedCount, errors }
}
