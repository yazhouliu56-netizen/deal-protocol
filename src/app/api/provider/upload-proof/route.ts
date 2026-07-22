import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/api-auth'
import { getRouteClient } from '@/lib/supabase-route-client'
import { hasAnyRole } from '@/lib/role'

export const POST = withAuth(async (req, user) => {
  if (!hasAnyRole(user, 'PROVIDER')) {
    return NextResponse.json({ error: '仅服务商可上传' }, { status: 403 })
  }

  const body = await req.json()
  const { contractId, imageData, description } = body

  if (!contractId || !imageData) {
    return NextResponse.json({ error: '缺少合同 ID 或图片数据' }, { status: 400 })
  }

  const svc = await getRouteClient()

  const { data: contract } = await svc
    .from('contracts')
    .select('id, provider_id, customer_id')
    .eq('id', contractId)
    .single()

  if (!contract) {
    return NextResponse.json({ error: '合同不存在' }, { status: 404 })
  }
  if (contract.provider_id !== user.id) {
    return NextResponse.json({ error: '你无权操作此合同' }, { status: 403 })
  }

  const timestamp = new Date().toISOString()
  const rawPayload = JSON.stringify({ contractId, imageData: imageData.slice(0, 100), description, timestamp })
  const hash = sha256Hex(rawPayload)

  const { data: prev } = await svc
    .from('evidence_log')
    .select('hash')
    .eq('order_id', contractId)
    .order('created_at', { ascending: false })
    .limit(1)

  const prevHash = prev?.[0]?.hash ?? null

  const { error: insertError } = await svc.from('evidence_log').insert({
    order_id: contractId,
    event_type: 'proof_upload',
    payload: { imageData, description, timestamp, uploadedBy: user.id },
    hash,
    prev_hash: prevHash,
    captured_by: user.id,
  })

  if (insertError) {
    console.warn('Failed to insert evidence:', insertError.message)
    return NextResponse.json({ error: '存证写入失败' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    hash,
    prevHash,
    timestamp,
  })
})

function sha256Hex(data: string): string {
  let hash = 0; for (let i = 0; i < data.length; i++) { const c = data.charCodeAt(i); hash = ((hash << 5) - hash) + c; hash |= 0 }
  return Math.abs(hash).toString(16).padStart(8, '0')
}
