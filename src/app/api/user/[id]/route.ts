import { NextResponse } from "next/server";
import { getRouteClient } from "@/lib/supabase-route-client";
import { getServiceClient } from "@/lib/supabase-client";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Route client respects RLS — public profiles are readable per policy
  const supabase = await getRouteClient();

  const { data: user, error } = await supabase
    .from('profiles')
    .select('id, role, credit_score, created_at, dispute_losses')
    .eq('id', id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  // Contract stats need service_role to read across users
  const svc = getServiceClient();
  const completedStatuses = ["COMPLETED", "SATISFACTION_HELD", "SETTLED"];

  const [{ count: providerCompleted }, { count: customerCompleted }, { data: providerContracts }, { data: customerContracts }] = await Promise.all([
    svc.from('contracts').select('*', { count: 'exact', head: true }).eq('provider_id', id).in('fund_status', completedStatuses),
    svc.from('contracts').select('*', { count: 'exact', head: true }).eq('customer_id', id).in('fund_status', completedStatuses),
    svc.from('contracts').select('id').eq('provider_id', id),
    svc.from('contracts').select('id').eq('customer_id', id),
  ]);

  const providerTotal = providerContracts?.length ?? 0;
  const customerTotal = customerContracts?.length ?? 0;
  const totalOrders = providerTotal + customerTotal;
  const completedTotal = (providerCompleted ?? 0) + (customerCompleted ?? 0);
  const completionRate = totalOrders > 0 ? Math.round((completedTotal / totalOrders) * 100) : 0;

  const contractIds = [...new Set([
    ...(providerContracts?.map(c => c.id) ?? []),
    ...(customerContracts?.map(c => c.id) ?? []),
  ])];

  let avgRating = 0;
  let reviewCount = 0;
  if (contractIds.length > 0) {
    const { data: reviews } = await svc
      .from('evidence_chain')
      .select('rating')
      .in('contract_id', contractIds);

    const ratings = reviews?.map(r => r.rating).filter(r => r != null) ?? [];
    reviewCount = ratings.length;
    avgRating = reviewCount > 0 ? ratings.reduce((a, b) => a + b, 0) / reviewCount : 0;
  }

  return NextResponse.json({
    user: {
      id: user.id,
      role: user.role,
      creditScore: user.credit_score,
      totalOrders,
      asProvider: providerTotal,
      asCustomer: customerTotal,
      completionRate,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount,
      disputeLosses: user.dispute_losses,
      memberSince: user.created_at,
    },
  });
}
