import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getRouteClient } from "@/lib/supabase-route-client";

export const GET = withAuth(async (req, user, ...args) => {
  const { id } = await (args[0] as { params: Promise<{ id: string }> }).params;
  const supabase = await getRouteClient();

  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id, fund_status, customer_id, provider_id")
    .eq("id", id)
    .single();

  if (contractError || !contract) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  if (contract.customer_id !== user.id && contract.provider_id !== user.id) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id, status, provider_payment_id")
    .eq("contract_id", id);

  return NextResponse.json({
    orderId: contract.id,
    fundStatus: contract.fund_status,
    payments: payments ?? [],
  });
});
