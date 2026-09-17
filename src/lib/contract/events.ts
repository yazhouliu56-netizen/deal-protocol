import { getServiceClient } from "@/lib/supabase-client"

export async function addContractEvent(params: {
  contractId: string
  actorId: string
  fromStatus: string
  toStatus: string
  action: string
  reason?: string
  metadata?: string
}) {
  // R8 野表收编：写端统一 service（contract_events 无 INSERT 策略 = 仅 service 可写；
  // RLS 之前开而零策略，匿名写全灭——单点收敛，调用方零改动）。
  const supabase = getServiceClient()
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
