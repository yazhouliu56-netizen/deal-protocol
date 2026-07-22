import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";

export const GET = withAuth(async (req, user) => {
  const supabase = await getRouteClient();
  const { searchParams } = new URL(req.url);
  const role = searchParams.get("role");

  const field = role === "provider" ? "provider_id" : "customer_id";

  const { data: contracts, error } = await supabase
    .from('contracts')
    .select('*')
    .eq(field, user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.warn("Failed to fetch contracts:", error.message);
    return NextResponse.json({ contracts: [] });
  }

  if (!contracts || contracts.length === 0) {
    return NextResponse.json({ contracts: [] });
  }

  const demandIds = [...new Set(contracts.map(c => c.demand_id).filter(Boolean))];
  const providerIds = [...new Set(contracts.map(c => c.provider_id).filter(Boolean))];
  const customerIds = [...new Set(contracts.map(c => c.customer_id).filter(Boolean))];
  const contractIds = contracts.map(c => c.id);

  const [demandsRes, providersRes, customersRes] = await Promise.all([
    demandIds.length > 0
      ? supabase.from('demands').select('id, title').in('id', demandIds)
      : { data: [] },
    providerIds.length > 0
      ? supabase.from('profiles').select('id, name').in('id', providerIds)
      : { data: [] },
    customerIds.length > 0
      ? supabase.from('profiles').select('id, name').in('id', customerIds)
      : { data: [] },
  ]);
  let paymentsRes: { data: any[] | null; error: any } = { data: [], error: null };
  try {
    paymentsRes = await supabase.from('payments').select('contract_id, status, amount').in('contract_id', contractIds);
  } catch (e) {
    console.warn("payments table may not exist:", e);
  }

  const demandMap = new Map((demandsRes.data ?? []).map(d => [d.id, d]));
  const providerMap = new Map((providersRes.data ?? []).map(p => [p.id, p]));
  const customerMap = new Map((customersRes.data ?? []).map(c => [c.id, c]));
  const paymentsByContract = new Map<string, unknown[]>();
  for (const p of (paymentsRes.data ?? [])) {
    const arr = paymentsByContract.get(p.contract_id) ?? [];
    arr.push(p);
    paymentsByContract.set(p.contract_id, arr);
  }

  const result = contracts.map(c => ({
    ...c,
    demand: demandMap.get(c.demand_id) ?? null,
    provider: providerMap.get(c.provider_id) ?? { id: '', name: '未知服务商' },
    customer: customerMap.get(c.customer_id) ?? { id: '', name: '未知客户' },
    payments: paymentsByContract.get(c.id) ?? [],
  }));

  return NextResponse.json({ contracts: result });
});
