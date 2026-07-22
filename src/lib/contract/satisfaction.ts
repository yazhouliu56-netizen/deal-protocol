import { getServiceClient } from "@/lib/supabase-client"
import { addContractEvent } from "./events"
import { getConfig } from "@/lib/platform/config"
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from "@/modules/m07-credit/credit-engine"
import { getEngine } from "@/lib/protocol/engine"

export async function handleSatisfactionBatch(contractId: string) {
  const supabase = getServiceClient()
  const config = await getConfig()

  const { data: contract } = await supabase
    .from('contracts')
    .select('provider_id, amount, fund_status, protocol_id')
    .eq('id', contractId)
    .single()

  if (!contract) return

  const engine = getEngine(contract.protocol_id)
  const satisfactionHold = engine?.getDefinition().funding.fees.satisfaction_hold ?? 0
  if (satisfactionHold <= 0) return

  const depositAmount = Math.round(contract.amount * satisfactionHold * 100) / 100

  let { data: batch } = await supabase
    .from('satisfaction_batches')
    .select('*')
    .eq('provider_id', contract.provider_id)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!batch) {
    const { data: newBatch, error } = await supabase
      .from('satisfaction_batches')
      .insert({ provider_id: contract.provider_id })
      .select()
      .single()
    if (error) throw error
    batch = newBatch
  }

  const { error: updateBatchError } = await supabase
    .from('satisfaction_batches')
    .update({
      count: batch.count + 1,
      total_amount: batch.total_amount + depositAmount,
    })
    .eq('id', batch.id)
  if (updateBatchError) throw updateBatchError

  const { error: updateContractError } = await supabase
    .from('contracts')
    .update({
      satisfaction_batch_id: batch.id,
      fund_status: 'SATISFACTION_HELD',
    })
    .eq('id', contractId)
  if (updateContractError) throw updateContractError

  await addContractEvent({
    contractId,
    actorId: contract.provider_id,
    fromStatus: contract.fund_status,
    toStatus: 'SATISFACTION_HELD',
    action: 'hold_satisfaction',
    reason: `满意度暂存款已冻结: ¥${depositAmount}`,
  })

  const { data: updatedBatch } = await supabase
    .from('satisfaction_batches')
    .select('*')
    .eq('id', batch.id)
    .single()

  if (updatedBatch && updatedBatch.count >= 15) {
    await releaseSatisfactionBatch(batch.id)
  }
}

export async function releaseSatisfactionBatch(batchId: string) {
  const supabase = getServiceClient()

  const { data: batch } = await supabase
    .from('satisfaction_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (!batch || batch.status !== 'PENDING') return

  const { data: provider } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', batch.provider_id)
    .single()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id')
    .eq('satisfaction_batch_id', batchId)

  const { error: updateBatchError } = await supabase
    .from('satisfaction_batches')
    .update({ status: 'RELEASED', released_at: new Date().toISOString() })
    .eq('id', batchId)
  if (updateBatchError) throw updateBatchError

  for (const c of Array.isArray(contracts) ? contracts : []) {
    const { error: updateContractError } = await supabase
      .from('contracts')
      .update({ fund_status: 'SETTLED' })
      .eq('id', c.id)
    if (updateContractError) throw updateContractError

    const { error: eventError } = await supabase
      .from('contract_events')
      .insert({
        contract_id: c.id,
        actor_id: batch.provider_id,
        from_status: 'SATISFACTION_HELD',
        to_status: 'SETTLED',
        action: 'batch_release',
        reason: `满意度暂存款批释放: 第${batch.count}单 / 总额¥${batch.total_amount}`,
      })
    if (eventError) throw eventError
  }

  const ev = await appendEvidence({
    eventType: 'satisfaction_released',
    payload: {
      batch_id: batchId,
      provider_id: batch.provider_id,
      total_amount: batch.total_amount,
      count: batch.count,
    },
  })
  if (!ev) throw new Error('Failed to append evidence for satisfaction release')
  await updateCredit({ userId: batch.provider_id, eventType: 'completion', evidenceId: ev.id, description: 'Satisfaction batch released' })
}
