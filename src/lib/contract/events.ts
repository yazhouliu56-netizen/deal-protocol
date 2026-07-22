import { getSupabase } from "@/lib/supabase-client"

export async function addContractEvent(params: {
  contractId: string
  actorId: string
  fromStatus: string
  toStatus: string
  action: string
  reason?: string
  metadata?: string
}) {
  const supabase = getSupabase()
  const { error } = await supabase.from('contract_events').insert({
    contract_id: params.contractId,
    actor_id: params.actorId,
    from_status: params.fromStatus,
    to_status: params.toStatus,
    action: params.action,
    reason: params.reason ?? null,
    metadata: params.metadata ?? null,
  })
  if (error) throw error
}
