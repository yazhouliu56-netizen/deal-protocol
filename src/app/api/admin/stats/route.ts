import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const GET = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalContracts },
    { data: revenueData },
    { count: totalUsers },
    { count: pendingDisputes },
    { data: statusData },
    { data: dailyData },
  ] = await Promise.all([
    svc.from('contracts').select('*', { count: 'exact', head: true }),
    svc.from('contracts').select('amount').eq('fund_status', 'COMPLETED'),
    svc.from('profiles').select('*', { count: 'exact', head: true }),
    svc.from('disputes').select('*', { count: 'exact', head: true }).eq('dispute_status', 'OPEN'),
    svc.from('contracts').select('fund_status'),
    svc.from('contracts')
      .select('created_at')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true }),
  ])

  const totalRevenue = (revenueData ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0)

  const contractsByStatus = new Map<string, number>()
  for (const c of statusData ?? []) {
    const status = c.fund_status ?? 'UNKNOWN'
    contractsByStatus.set(status, (contractsByStatus.get(status) ?? 0) + 1)
  }

  const contractsByDay = new Map<string, number>()
  for (const c of dailyData ?? []) {
    const day = c.created_at?.slice(0, 10)
    if (day) contractsByDay.set(day, (contractsByDay.get(day) ?? 0) + 1)
  }

  return NextResponse.json({
    total_contracts: totalContracts ?? 0,
    total_revenue: totalRevenue,
    total_users: totalUsers ?? 0,
    pending_disputes: pendingDisputes ?? 0,
    contracts_by_status: Object.fromEntries(contractsByStatus),
    contracts_by_day: Object.fromEntries(contractsByDay),
  })
})
