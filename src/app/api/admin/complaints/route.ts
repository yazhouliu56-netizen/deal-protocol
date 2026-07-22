import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"
import { appendEvidence } from "@/modules/m11-evidence-log/evidence-chain"

export const GET = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 })
  }

  const { data: complaints, error } = await svc.from('evidence_log')
    .select('*')
    .eq('event_type', 'complaint')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const protocolIds = [...new Set((complaints ?? []).map(c => c.protocol_id).filter(Boolean) as string[])]
  const orderIds = [...new Set((complaints ?? []).map(c => c.order_id).filter(Boolean) as string[])]
  const userIds = [...new Set((complaints ?? []).map(c => c.captured_by).filter(Boolean) as string[])]

  const [protocolsRes, ordersRes, usersRes] = await Promise.all([
    protocolIds.length > 0
      ? svc.from('protocols').select('id, category, status').in('id', protocolIds)
      : { data: [] },
    orderIds.length > 0
      ? svc.from('orders').select('id, status, amount').in('id', orderIds)
      : { data: [] },
    userIds.length > 0
      ? svc.from('profiles').select('id, name').in('id', userIds)
      : { data: [] },
  ])

  const protocolMap = new Map((protocolsRes.data ?? []).map(p => [p.id, p]))
  const orderMap = new Map((ordersRes.data ?? []).map(o => [o.id, o]))
  const userMap = new Map((usersRes.data ?? []).map(u => [u.id, u]))

  const result = (complaints ?? []).map(c => {
    const evidenceChainQuery = c.protocol_id
      ? svc.from('evidence_log')
          .select('*')
          .eq('protocol_id', c.protocol_id)
          .order('created_at', { ascending: true })
      : c.order_id
        ? svc.from('evidence_log')
            .select('*')
            .eq('order_id', c.order_id)
            .order('created_at', { ascending: true })
        : null

    return {
      id: c.id,
      protocol_id: c.protocol_id,
      order_id: c.order_id,
      event_type: c.event_type,
      payload: c.payload,
      payload_ref: c.payload_ref,
      captured_by: c.captured_by,
      hash: c.hash,
      prev_hash: c.prev_hash,
      created_at: c.created_at,
      protocol: c.protocol_id ? protocolMap.get(c.protocol_id) ?? null : null,
      order: c.order_id ? orderMap.get(c.order_id) ?? null : null,
      complainant: c.captured_by ? userMap.get(c.captured_by) ?? null : null,
      evidenceChainPromise: evidenceChainQuery,
    }
  })

  const withChain = await Promise.all(result.map(async (item) => {
    if (item.evidenceChainPromise) {
      const { data } = await item.evidenceChainPromise
      return { ...item, evidence_chain: data ?? [] }
    }
    return { ...item, evidence_chain: [] }
  }))

  return NextResponse.json({ complaints: withChain })
})

export const POST = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 })
  }

  const body = await req.json()
  const { complaintId, action, reason } = body

  if (!complaintId || !action || !['dismiss', 'warn', 'suspend', 'ban'].includes(action)) {
    return NextResponse.json({ error: '参数无效' }, { status: 400 })
  }

  const { data: complaint } = await svc.from('evidence_log')
    .select('protocol_id, order_id, captured_by')
    .eq('id', complaintId)
    .single()

  if (!complaint) {
    return NextResponse.json({ error: '举报记录不存在' }, { status: 404 })
  }

  const protocolId = complaint.protocol_id ?? complaint.order_id

  await appendEvidence({
    protocolId: protocolId ?? undefined,
    orderId: complaint.order_id ?? undefined,
    eventType: 'admin_verdict',
    payload: { action, reason: reason ?? '', complaint_id: complaintId, target_user: complaint.captured_by },
    capturedBy: user.id,
  })

  if (action === 'suspend' || action === 'ban') {
    if (complaint.captured_by) {
      await svc.from('provider_categories')
        .update({ is_online: false })
        .eq('user_id', complaint.captured_by)
    }
    if (protocolId) {
      await svc.from('protocols')
        .update({ status: 'cancelled' })
        .eq('id', protocolId)
    }
  }

  return NextResponse.json({ success: true })
})
