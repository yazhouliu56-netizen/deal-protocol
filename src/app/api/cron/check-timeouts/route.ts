import { NextResponse, NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase-client";
import { addContractEvent } from "@/lib/contract/events";
import { handleSatisfactionBatch } from "@/lib/contract/satisfaction";
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

  const supabase = getSupabase();
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

    // 2. Satisfaction batch: full 30 days without reaching 15 orders
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { data: expiredBatches, error: batchError } = await supabase
      .from('satisfaction_batches')
      .select('*')
      .eq('status', 'PENDING')
      .lte('created_at', thirtyDaysAgo.toISOString());

    if (batchError) {
      results.push(`batch_release FETCH ERROR: ${batchError.message}`);
    } else {
      // Get contract relations for all expired batches
      const batchIds = (expiredBatches ?? []).map(b => b.id);
      const batchContractMap = new Map<string, { id: string }[]>();

      if (batchIds.length > 0) {
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select('id, satisfaction_batch_id')
          .in('satisfaction_batch_id', batchIds);

        if (contractsError) {
          results.push(`batch_contracts FETCH ERROR: ${contractsError.message}`);
        } else {
          for (const c of (contracts ?? [])) {
            const arr = batchContractMap.get(c.satisfaction_batch_id) ?? [];
            arr.push({ id: c.id });
            batchContractMap.set(c.satisfaction_batch_id, arr);
          }
        }
      }

      for (const batch of (expiredBatches ?? [])) {
        try {
          await supabase
            .from('satisfaction_batches')
            .update({ status: "RELEASED", released_at: now.toISOString() })
            .eq('id', batch.id);

          const contracts = batchContractMap.get(batch.id) ?? [];
          for (const c of contracts) {
            try {
              await supabase
                .from('contracts')
                .update({ fund_status: "SETTLED" })
                .eq('id', c.id);

              await addContractEvent({
                contractId: c.id,
                actorId: batch.provider_id,
                fromStatus: "SATISFACTION_HELD",
                toStatus: "SETTLED",
                action: "batch_release_timeout",
                reason: `满30天批释放: 共${batch.count}单 / 总额¥${batch.total_amount}`,
              });
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              results.push(`batch_contract FAILED ${c.id}: ${msg}`);
            }
          }

          results.push(`batch_release_timeout: ${batch.id} (${contracts.length} contracts)`);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          results.push(`batch_release FAILED ${batch.id}: ${msg}`);
        }
      }
    }

    // 3. 双盲揭晓（R4-3 · 用户裁决 2026-09-16）：双方都交或提交超 72h →
    // blind 翻 revealed。表未迁移（无 blind_state 列）时整步跳过，老环境零影响。
    try {
      const blindDeadline = new Date(now.getTime() - 72 * 3600_000).toISOString();
      const toReveal = new Set<string>();
      const timedOut = await supabase
        .from('order_reviews')
        .select('id')
        .eq('blind_state', 'blind')
        .lte('created_at', blindDeadline)
        .limit(500);
      if (timedOut.error) throw timedOut.error;
      for (const r of ((timedOut.data ?? []) as { id: string }[])) toReveal.add(r.id);

      const blinds = await supabase
        .from('order_reviews')
        .select('id, contract_id, reviewer_id')
        .eq('blind_state', 'blind')
        .limit(1000);
      if (blinds.error) throw blinds.error;
      const byContract = new Map<string, { id: string; reviewer_id: string }[]>();
      for (const r of ((blinds.data ?? []) as { id: string; contract_id: string; reviewer_id: string }[])) {
        if (!r.contract_id) continue;
        const arr = byContract.get(r.contract_id) ?? [];
        arr.push({ id: r.id, reviewer_id: r.reviewer_id });
        byContract.set(r.contract_id, arr);
      }
      for (const arr of byContract.values()) {
        if (new Set(arr.map((x) => x.reviewer_id)).size >= 2) {
          for (const x of arr) toReveal.add(x.id);
        }
      }

      let revealed = 0;
      for (const id of toReveal) {
        const up = await supabase
          .from('order_reviews')
          .update({ blind_state: 'revealed' })
          .eq('id', id)
          .eq('blind_state', 'blind');
        if (!up.error) revealed += 1;
      }
      results.push(`blind_reveal: ${revealed} 条`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`blind_reveal SKIP: ${msg}`);
    }

    // 4. SLA 违约扫描（D-5 Phase D：自 sla-enforcer 进程内 setInterval 轮询迁入，60s→cron 权威节拍）
    try {
      const enforced = await checkAndEnforceSLA();
      results.push(`sla_enforced: ${enforced.length} 条`);
      for (const line of enforced) results.push(`  ${line}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push(`sla_enforce FAILED: ${msg}`);
    }

    return NextResponse.json({ checked: now.toISOString(), results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push(`FATAL: ${msg}`);
    return NextResponse.json({ checked: new Date().toISOString(), results, error: msg }, { status: 500 });
  }
}
