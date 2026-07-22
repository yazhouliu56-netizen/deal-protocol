import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { emitEvent } from "@/lib/event-bus"

export const GET = withAuth(async (req, user, ...args) => {
  const { id } = await (args[0] as { params: Promise<{ id: string }> }).params
  const supabase = await getRouteClient()

  const { data: demand, error } = await supabase
    .from('demands')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !demand) {
    return NextResponse.json({ error: "需求不存在" }, { status: 404 })
  }

  const [customerRes, contractsRes] = await Promise.all([
    supabase.from('profiles').select('id, name, credit_score').eq('id', demand.customer_id).single(),
    supabase.from('contracts').select('*').eq('demand_id', id),
  ]);

  let contracts: Array<Record<string, unknown>> = [];
  if (contractsRes.data && contractsRes.data.length > 0) {
    const pIds = [...new Set(contractsRes.data.map((c: Record<string, unknown>) => c.provider_id as string))];
    const { data: providers } = await supabase
      .from('profiles')
      .select('id, name, credit_score')
      .in('id', pIds);

    const pmap = new Map((providers ?? []).map(p => [p.id, p]));
    contracts = contractsRes.data.map((c: Record<string, unknown>) => ({
      ...c,
      provider: pmap.get(c.provider_id as string)
        ? { id: pmap.get(c.provider_id as string)!.id, name: pmap.get(c.provider_id as string)!.name, creditScore: pmap.get(c.provider_id as string)!.credit_score }
        : null,
    }));
  }

  return NextResponse.json({
    demand: {
      ...demand,
      customer: customerRes.data
        ? { id: customerRes.data.id, name: customerRes.data.name, creditScore: customerRes.data.credit_score }
        : null,
      contracts,
    },
  })
})

export const PATCH = withAuth(async (req, user, ...args) => {
  const { id } = await (args[0] as { params: Promise<{ id: string }> }).params
  const supabase = await getRouteClient()
  const body = await req.json()

  const { data: demand, error: findError } = await supabase
    .from('demands')
    .select('*')
    .eq('id', id)
    .single()

  if (findError || !demand) return NextResponse.json({ error: "需求不存在" }, { status: 404 })
  if (demand.customer_id !== user.id) return NextResponse.json({ error: "无权操作" }, { status: 403 })

  const { data: updated, error: updateError } = await supabase
    .from('demands')
    .update({ status: body.status })
    .eq('id', id)
    .select()
    .single()

  if (updateError) throw updateError

  await emitEvent({ type: 'demand', id, action: body.status, userId: user.id })

  return NextResponse.json({ demand: updated })
})
