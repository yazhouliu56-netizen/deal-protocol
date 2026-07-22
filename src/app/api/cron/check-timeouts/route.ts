import { NextResponse, NextRequest } from "next/server";
import { getSupabase } from "@/lib/supabase-client";
import { getEngine } from "@/lib/protocol/engine";
import { addContractEvent, handleSatisfactionBatch } from "@/lib/contract-machine";

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
          const engine = getEngine(contract.protocol_id);
          if (!engine) {
            results.push(`auto_complete SKIP ${contract.id}: unknown protocol ${contract.protocol_id}`);
            continue;
          }

          const guard = engine.validateTransition("auto_complete", {
            contract: {
              id: contract.id,
              fundStatus: contract.fund_status as any,
              disputeStatus: contract.dispute_status,
              serviceStage: contract.service_stage as any,
              providerId: contract.provider_id,
              customerId: contract.customer_id,
              amount: contract.amount,
              completedAt: contract.completed_at,
              autoCompleteAt: contract.auto_complete_at,
            },
            actor: { id: "system", role: "SYSTEM" },
          });

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
      let batchContractMap = new Map<string, { id: string }[]>();

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

    return NextResponse.json({ checked: now.toISOString(), results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    results.push(`FATAL: ${msg}`);
    return NextResponse.json({ checked: new Date().toISOString(), results, error: msg }, { status: 500 });
  }
}
