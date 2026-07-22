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

  const [protocolsRes, qualsRes] = await Promise.all([
    svc.from('protocols')
      .select('id, demander_id, category, status, risk_tier, final_price, created_at')
      .eq('status', 'pending_confirm')
      .order('created_at', { ascending: false }),
    svc.from('provider_qualifications')
      .select('id, user_id, category, qualification_type, verified, created_at')
      .eq('verified', false)
      .order('created_at', { ascending: false }),
  ])

  const demanderIds = [...new Set([
    ...(protocolsRes.data ?? []).map(p => p.demander_id).filter(Boolean),
    ...(qualsRes.data ?? []).map(q => q.user_id).filter(Boolean),
  ])]

  const { data: demanders } = demanderIds.length > 0
    ? await svc.from('profiles').select('id, name, phone').in('id', demanderIds)
    : { data: [] }

  const userMap = new Map((demanders ?? []).map(u => [u.id, u]))

  const pendingProtocols = (protocolsRes.data ?? []).map(p => ({
    id: p.id,
    type: 'protocol',
    status: p.status,
    category: p.category,
    risk_tier: p.risk_tier,
    final_price: p.final_price,
    created_at: p.created_at,
    user: userMap.get(p.demander_id) ? { name: userMap.get(p.demander_id)!.name, phone: userMap.get(p.demander_id)!.phone } : null,
  }))

  const pendingQualifications = (qualsRes.data ?? []).map(q => ({
    id: q.id,
    type: 'provider_qualification',
    status: 'pending',
    category: q.category,
    qualification_type: q.qualification_type,
    created_at: q.created_at,
    user: userMap.get(q.user_id) ? { name: userMap.get(q.user_id)!.name, phone: userMap.get(q.user_id)!.phone } : null,
  }))

  const allItems = [...pendingQualifications, ...pendingProtocols].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return NextResponse.json({ items: allItems })
})

export const PATCH = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 })
  }

  const body = await req.json()
  const { itemId, itemType, action, reason } = body

  if (!itemId || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: '参数无效' }, { status: 400 })
  }

  if (itemType === 'protocol') {
    if (action === 'approve') {
      const { error } = await svc.from('protocols')
        .update({ status: 'matching' })
        .eq('id', itemId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await svc.from('protocols')
        .update({ status: 'cancelled' })
        .eq('id', itemId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await appendEvidence({
      protocolId: itemId,
      eventType: 'review_action',
      payload: { action, reason: reason ?? '', reviewed_by: user.id },
      capturedBy: user.id,
    })
  } else if (itemType === 'provider_qualification') {
    if (action === 'approve') {
      const { error } = await svc.from('provider_qualifications')
        .update({ verified: true })
        .eq('id', itemId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await svc.from('provider_qualifications')
        .delete()
        .eq('id', itemId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
})
