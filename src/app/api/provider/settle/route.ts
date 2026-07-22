import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { getRouteClient } from '@/lib/supabase-route-client'
import { hasAnyRole } from '@/lib/role'
import { addContractEvent } from '@/lib/contract/events'
import { handleSatisfactionBatch } from '@/lib/contract/satisfaction'

export const POST = withAuth(async (req, user) => {
  if (!hasAnyRole(user, 'PROVIDER')) {
    return NextResponse.json({ error: '仅服务商可发起结算' }, { status: 403 })
  }

  const body = await req.json()
  const { contractId } = body

  if (!contractId) {
    return NextResponse.json({ error: '缺少合同 ID' }, { status: 400 })
  }

  const supabase = await getRouteClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, provider_id, customer_id, fund_status')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return NextResponse.json({ error: '合同不存在' }, { status: 404 })
  }
  if (contract.provider_id !== user.id) {
    return NextResponse.json({ error: '你无权操作此合同' }, { status: 403 })
  }
  if (contract.fund_status !== 'COMPLETED') {
    return NextResponse.json({ error: '仅已完成订单可发起结算' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('contracts')
    .update({ fund_status: 'SATISFACTION_HELD' })
    .eq('id', contractId)

  if (updateError) {
    console.warn('Failed to update contract for settlement:', updateError.message)
    return NextResponse.json({ error: '结算更新失败' }, { status: 500 })
  }

  await addContractEvent({
    contractId,
    actorId: user.id,
    fromStatus: contract.fund_status,
    toStatus: 'SATISFACTION_HELD',
    action: 'request_settle',
    reason: '服务商发起结算请求',
  })

  try {
    await handleSatisfactionBatch(contractId)
  } catch (e) {
    console.warn('Satisfaction batch after settle failed:', e)
  }

  return NextResponse.json({ success: true, fundStatus: 'SATISFACTION_HELD' })
})
