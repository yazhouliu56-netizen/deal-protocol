import { NextResponse, NextRequest } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";
import { addContractEvent } from "@/lib/contract/events";
import { handleSatisfactionBatch, releaseSatisfactionBase, settleSatisfactionBatch } from "@/lib/contract/satisfaction";
// D-5 Phase E：协议定义资产归位 Base + 超时放款校验收编 Base 纯函数核
import { validateContractAction } from "@/base/order/contract-engine";
import { getProtocol } from "@/base/order/protocol-definitions";
// D-5 Phase D：SLA 违约扫描自进程内轮询迁入 cron 权威触发（业务不丢）
import { checkAndEnforceSLA } from "@/lib/sla-enforcer";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // R10：cron 系 CRON_SECRET 自证的系统节拍，无用户会话——必须走 service；
  // 匿名读 contracts/orders 全被 parties 策略过滤，写全被拒（RLS 全断血训）。
  const supabase = getServiceClient();
  const results: string[] = [];

  try {
    // 1. Auto-complete: contracts where autoCompleteAt has passed (engine validates per protocol)
    const now = new Date();

    const { data: autoCompletable, error: fetchError } = await supabase
      .from('contracts')
      .select('*')
      .eq('fund_status', 'HELD')
      .lte('auto_complete_at', now.toISOString());

    if (fetchError) {
      results.push(`auto_complete FETCH ERROR: ${fetchError.message}`);
    } else {
      for (const contract of (autoCompletable ?? [])) {
        try {
          const protocolDef = getProtocol(contract.protocol_id);
          if (!protocolDef) {
            results.push(`auto_complete SKIP ${contract.id}: unknown protocol ${contract.protocol_id}`);
            continue;
          }

          const guard = validateContractAction(
            protocolDef,
            "auto_complete",
            {
              fundStatus: contract.fund_status ?? "",
              serviceStage: contract.service_stage ?? 0,
              role: "SYSTEM",
            },
            {
              contract: {
                id: contract.id,
                fundStatus: contract.fund_status ?? "",
                disputeStatus: contract.dispute_status,
                serviceStage: contract.service_stage ?? 0,
                providerId: contract.provider_id,
                customerId: contract.customer_id,
                amount: contract.amount,
                completedAt: contract.completed_at,
                autoCompleteAt: contract.auto_complete_at,
              },
              actor: { id: "system", role: "SYSTEM" },
            },
          );

          if (guard) {
            results.push(`auto_complete BLOCKED ${contract.id}: ${guard}`);
            continue;
          }

          await supabase
            .from('contracts')
            .update({
              fund_status: "COMPLETED",
              completed_at: now.toISOString(),
              auto_complete_at: null,
            })
            .eq('id', contract.id);

          await addContractEvent({
            contractId: contract.id,
            actorId: contract.provider_id,
            fromStatus: "HELD",
            toStatus: "COMPLETED",
            action: "auto_complete",
            reason: "超时未响应，自动确认完成",
          });

          await handleSatisfactionBatch(contract.id);
          results.push(`auto_complete: ${contract.id}`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push(`auto_complete FAILED ${contract.id}: ${msg}`);
        }
      }
    }

    // 2. P4 双钟表（用户裁决 2026-09-18）：R5 整单释放已退役。
    // (a) base 扫：HELD 但未记 base 账的行补记（HELD 入口崩溃 recovery）；
    // (b) 批量：窗过 hold 按师傅 N=10/T=7 天结算＋评价同步解密。
    try {
      const held = await supabase
        .from('contracts')
        .select('id')
        .eq('fund_status', 'SATISFACTION_HELD')
        .limit(200);
      if (held.error) throw held.error;
      let based = 0;
      for (const c of ((held.data ?? []) as { id: string }[])) {
        try {
          const r = await releaseSatisfactionBase(c.id);
          if (r.released) {
            based += 1;
            results.push(`satisfaction_base: ${c.id} (base ¥${(r.providerNetCents ?? 0) / 100})`);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push(`satisfaction_base FAILED ${c.id}: ${msg}`);
        }
      }
      if (based === 0) results.push("satisfaction_base: 0 条需补记");
      const batches = await settleSatisfactionBatch(now.getTime());
      if (batches.length === 0) {
        results.push("satisfaction_batch: 0 组触发");
      }
      for (const b of batches) {
        results.push(
          `satisfaction_batch: 师傅 ${b.providerId.slice(0, 8)} ${b.contracts} 单 ¥${b.amountCents / 100}（${b.hooksPassed}/${b.hooksTotal} 勾）`,
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`satisfaction_batch SKIP: ${msg}`);
    }

    // 3. 双盲揭晓（P4 收归批量 · 用户裁决 2026-09-18：评价随资金同步解密）。
    // 时间到期/双方互评不再自动揭晓（会泄露评价↔资金对应）；揭晓只发生在
    // settleSatisfactionBatch 内（按批次合同解密）。旧逻辑整段删除。
    results.push("blind_reveal: 已收归批量（本步零操作）");

    // 4. SLA 违约扫描（D-5 Phase D：自 sla-enforcer 进程内 setInterval 轮询迁入，60s→cron 权威节拍）
    try {
      const enforced = await checkAndEnforceSLA();
      results.push(`sla_enforced: ${enforced.length} 条`);
      for (const line of enforced) results.push(`  ${line}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`sla_enforce FAILED: ${msg}`);
    }

    // 5. P5b 匹配失败作废（用户裁决 2026-09-18）：OPEN 超 24h 无人接 →
    // CANCELLED＋定制作废（发布费不退／未收作废；已收场景不可达，见 unmatched.ts）。
    try {
      const { voidUnmatchedDemand } = await import("@/lib/demand/unmatched");
      const cutoff = new Date(now.getTime() - 24 * 3600_000).toISOString();
      const stale = await supabase
        .from("demands")
        .select("id, fee_status")
        .eq("status", "OPEN")
        .is("matched_provider_id", null)
        .lte("created_at", cutoff)
        .limit(100);
      if (stale.error) throw stale.error;
      let voided = 0;
      for (const d of ((stale.data ?? []) as { id: string; fee_status?: string }[])) {
        try {
          const up = await supabase
            .from("demands")
            .update({ status: "CANCELLED" })
            .eq("id", d.id)
            .eq("status", "OPEN")
            .is("matched_provider_id", null);
          if (up.error) throw up.error;
          const r = await voidUnmatchedDemand(supabase, d);
          voided += 1;
          results.push(`unmatched_void: ${d.id}（定制退 ${r.customRefunded} 项）`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push(`unmatched_void FAILED ${d.id}: ${msg}`);
        }
      }
      if (voided === 0) results.push("unmatched_void: 0 条到期");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`unmatched_void SKIP: ${msg}`);
    }

    return NextResponse.json({ checked: now.toISOString(), results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push(`FATAL: ${msg}`);
    return NextResponse.json({ checked: new Date().toISOString(), results, error: msg }, { status: 500 });
  }
}
