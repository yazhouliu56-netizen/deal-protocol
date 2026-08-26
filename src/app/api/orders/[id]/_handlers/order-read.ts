/**
 * 订单详情读取子处理器（P2-7 巨石控制器瘦身 · 自 route.ts GET 原位平移）。
 * HTTP 响应契约与状态码 100% 守恒；本模块不承载任何跃迁写操作
 * （auto-complete 自动确认是 GET 幂等副作用的历史语义，原样保留）。
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addContractEvent } from "@/lib/contract/events";
import { handleSatisfactionBatch } from "@/lib/contract/satisfaction";
import {
  deriveNextActions,
  validateContractAction,
} from "@/base/order/contract-engine";
import { getProtocol } from "@/base/order/protocol-definitions";
import { maskPhone } from "@/lib/privacy-guard";
import { getAvailablePaymentChannels } from "@/adapters/payment/registry";

export async function handleOrderRead(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { supabase } = session;

  const { data: contract, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }

  if (contract.customer_id !== session.user.id && contract.provider_id !== session.user.id) {
    return NextResponse.json({ error: "无权访问" }, { status: 403 });
  }

  // Fetch related data — safe queries
  const [demandRes, providerRes, customerRes, paymentsRes, eventsRes] = await Promise.all([
    supabase.from('demands').select('*').eq('id', contract.demand_id).single(),
    supabase.from('profiles').select('id, name, phone, credit_score').eq('id', contract.provider_id).single(),
    supabase.from('profiles').select('id, name, phone').eq('id', contract.customer_id).single(),
    supabase.from('payments').select('*').eq('contract_id', id),
    supabase.from('contract_events').select('*').eq('contract_id', id).order('created_at', { ascending: false }),
  ]);

  // Risky queries — tables that may not exist yet
  let reviewsRes: { data: Array<{ id: string; evidence_hash?: string; reviewer?: { name?: string } | null }> | null } = { data: [] };
  try {
    reviewsRes = await supabase.from('evidence_chain').select('*, reviewer:reviewer_id(name)').eq('contract_id', id);
  } catch (e) {
    console.warn("evidence_chain table not found, skipping reviews:", e);
  }
  let disputesRes: { data: Array<{ id: string; channel?: string; reason?: string; created_at?: string }> | null } = { data: [] };
  try {
    disputesRes = await supabase.from('disputes').select('id, channel, reason, created_at').eq('contract_id', id).eq('status', 'OPEN').limit(1);
  } catch (e) {
    console.warn("disputes query failed:", e);
  }
  let protocolVersionRes: { data: Record<string, unknown> | null } = { data: null };
  if (contract.protocol_version_id) {
    try {
      protocolVersionRes = await supabase.from('protocol_versions').select('*').eq('id', contract.protocol_version_id).single();
    } catch (e) {
      console.warn("protocol_versions query failed:", e);
    }
  }

  const roleParam = new URL(request.url).searchParams.get('role')?.toUpperCase();
  const actorRole = roleParam === "CUSTOMER" || roleParam === "PROVIDER"
    ? roleParam
    : contract.customer_id === session.user.id
      ? "CUSTOMER"
      : "PROVIDER";

  // Auto-complete check
  if (
    contract.fund_status === "HELD" &&
    contract.auto_complete_at &&
    new Date() >= new Date(contract.auto_complete_at) &&
    (!contract.dispute_status || contract.dispute_status === "RESOLVED")
  ) {
    const protocolDef = getProtocol(contract.protocol_id);
    if (protocolDef) {
      const guard = validateContractAction(
        protocolDef,
        "auto_complete",
        { fundStatus: contract.fund_status, serviceStage: contract.service_stage, role: "SYSTEM" },
        {
          contract: {
            id: contract.id,
            fundStatus: contract.fund_status,
            disputeStatus: contract.dispute_status,
            serviceStage: contract.service_stage,
            providerId: contract.provider_id,
            customerId: contract.customer_id,
            amount: contract.amount,
            completedAt: contract.completed_at,
            autoCompleteAt: contract.auto_complete_at,
          },
          actor: { id: "system", role: "SYSTEM" },
        },
      );
      if (!guard) {
        const { error: updateError } = await supabase
          .from('contracts')
          .update({
            fund_status: "COMPLETED",
            completed_at: new Date().toISOString(),
            auto_complete_at: null,
          })
          .eq('id', id);

        if (!updateError) {
          await addContractEvent({
            contractId: id,
            actorId: "system",
            fromStatus: "HELD",
            toStatus: "COMPLETED",
            action: "auto_complete",
            reason: "72h 无争议，系统自动确认完成",
          });
          try {
            await handleSatisfactionBatch(id);
          } catch (e) {
            console.warn("Satisfaction batch after auto-complete failed:", e);
          }
        }
      }
    }
  }

  const protocolVersion = protocolVersionRes.data;
  const protocolInfo = protocolVersion
    ? (() => {
        const cfg = typeof protocolVersion.config === 'string'
          ? JSON.parse(protocolVersion.config)
          : protocolVersion.config;
        return {
          protocolId: contract.protocol_id,
          protocolName: cfg.name,
          protocolVersion: protocolVersion.version,
          fundingMode: cfg.funding?.mode,
          serviceStages: cfg.serviceStages ?? [],
          disputeChannels: cfg.dispute?.channels ?? null,
          reviewDimensions: cfg.review?.dimensions ?? [],
        };
      })()
    : null;

  const activeDispute = disputesRes.data && disputesRes.data.length > 0 ? disputesRes.data[0] : null;

  const protocolDef = getProtocol(contract.protocol_id);
  const availableActions = protocolDef
    ? deriveNextActions(
        protocolDef,
        contract.fund_status,
        contract.service_stage,
        actorRole,
      )
    : [];

  return NextResponse.json({
    contract: {
      ...contract,
      demand: demandRes.data ?? null,
      provider: providerRes.data
        ? { id: providerRes.data.id, name: providerRes.data.name, phone: maskPhone(providerRes.data.phone), creditScore: providerRes.data.credit_score }
        : null,
      customer: customerRes.data
        ? { id: customerRes.data.id, name: customerRes.data.name, phone: maskPhone(customerRes.data.phone) }
        : null,
      payments: paymentsRes.data ?? [],
      events: eventsRes.data ?? [],
      reviews: reviewsRes.data ?? [],
      protocolVersion,
      disputes: disputesRes.data ?? [],
      protocolInfo,
      activeDispute,
      availableActions,
      paymentChannels: getAvailablePaymentChannels(),
    },
  });
}
