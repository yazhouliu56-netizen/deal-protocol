import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const GET = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 })
  }

  const { data: disputes, error } = await svc
    .from('disputes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error

  const initiatorIds = [...new Set(disputes?.map(d => d.initiator_id).filter(Boolean) ?? [])]
  const contractIds = [...new Set(disputes?.map(d => d.contract_id).filter(Boolean) ?? [])]

  const [initiatorsRes, contractsRes] = await Promise.all([
    initiatorIds.length > 0
      ? svc.from('profiles').select('id, name').in('id', initiatorIds)
      : { data: [] },
    contractIds.length > 0
      ? svc.from('contracts').select('id, amount, fund_status, customer_id, provider_id, demand_id').in('id', contractIds)
      : { data: [] },
  ])

  const initiatorMap = new Map((initiatorsRes.data ?? []).map(i => [i.id, i]))

  const allUserIds = [...new Set([
    ...(contractsRes.data ?? []).map(c => c.customer_id).filter(Boolean),
    ...(contractsRes.data ?? []).map(c => c.provider_id).filter(Boolean),
  ])]

  const { data: allUsers } = allUserIds.length > 0
    ? await svc.from('profiles').select('id, name').in('id', allUserIds)
    : { data: [] }

  const userMap = new Map((allUsers ?? []).map(u => [u.id, u]))

  const demandIds = [...new Set((contractsRes.data ?? []).map(c => c.demand_id).filter(Boolean) as string[])]
  const { data: demands } = demandIds.length > 0
    ? await svc.from('demands').select('id, title').in('id', demandIds)
    : { data: [] }
  const demandMap = new Map((demands ?? []).map(d => [d.id, d.title]))

  const result = (disputes ?? []).map(d => {
    const contract = contractsRes.data?.find((c: Record<string, unknown>) => c.id === d.contract_id)
    return {
      ...d,
      initiator: initiatorMap.get(d.initiator_id) ? { name: initiatorMap.get(d.initiator_id)!.name } : null,
      contract: contract
        ? {
            id: contract.id,
            amount: contract.amount,
            fundStatus: contract.fund_status,
            service: contract.demand_id ? { title: demandMap.get(contract.demand_id as string) ?? null } : null,
            customer: contract.customer_id ? { id: contract.customer_id, name: userMap.get(contract.customer_id as string)?.name ?? null } : null,
            provider: contract.provider_id ? { id: contract.provider_id, name: userMap.get(contract.provider_id as string)?.name ?? null } : null,
          }
        : null,
    }
  })

  return NextResponse.json({ disputes: result })
})
