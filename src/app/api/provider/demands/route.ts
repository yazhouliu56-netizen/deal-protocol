import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { hasAnyRole } from "@/lib/role"

export const GET = withAuth(async (req, user) => {
  if (!hasAnyRole(user, "PROVIDER")) {
    return NextResponse.json({ error: "仅服务商可查看" }, { status: 403 })
  }

  const supabase = await getRouteClient()

  const { data: demands, error } = await supabase
    .from('demands')
    .select('*')
    .in('status', ['OPEN', 'MATCHED'])
    .order('urgency', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.warn("Failed to fetch demands:", error.message)
    return NextResponse.json({ demands: [] })
  }

  const customerIds = [...new Set(demands?.map(d => d.customer_id).filter(Boolean) ?? [])]
  const { data: customers } = customerIds.length > 0
    ? await supabase.from('profiles').select('id, name, credit_score').in('id', customerIds)
    : { data: [] }

  const customerMap = new Map((customers ?? []).map(c => [c.id, c]))

  const result = (demands ?? []).map(d => ({
    ...d,
    customer: customerMap.get(d.customer_id)
      ? { id: customerMap.get(d.customer_id)!.id, name: customerMap.get(d.customer_id)!.name, creditScore: customerMap.get(d.customer_id)!.credit_score }
      : null,
  }))

  return NextResponse.json({ demands: result })
})
