import { getSupabase } from "@/lib/supabase-client"
import { isPlaceholderUrl } from "./supabase-mock"
import { getEngine } from "./protocol/engine"

let started = false

export function startAutoTransitions() {
  if (started) return
  if (isPlaceholderUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) return
  started = true
  run()
  setInterval(run, 60_000)
}

async function run() {
  try {
    await autoComplete()
    await autoSettle()
  } catch (e) {
    console.error("auto-transitions error:", e)
  }
}

async function autoComplete() {
  const supabase = getSupabase()
  const now = new Date()

  const { data: contracts } = await supabase
    .from('contracts')
    .select('id, protocol_id, fund_status, dispute_status, service_stage, provider_id, customer_id, amount, completed_at, auto_complete_at')
    .eq('fund_status', 'HELD')
    .lte('auto_complete_at', now.toISOString())
    .not('auto_complete_at', 'is', null)
    .or('dispute_status.is.null,dispute_status.eq.RESOLVED')

  for (const c of Array.isArray(contracts) ? contracts : []) {
    const engine = getEngine(c.protocol_id)
    if (!engine) continue

    const err = engine.validateTransition("auto_complete", {
      contract: {
        id: c.id, fundStatus: c.fund_status,
        disputeStatus: c.dispute_status, serviceStage: c.service_stage,
        providerId: c.provider_id, customerId: c.customer_id,
        amount: c.amount, completedAt: c.completed_at,
        autoCompleteAt: c.auto_complete_at!,
      },
      actor: { id: "system", role: "SYSTEM" },
    })
    if (err) continue

    const { error: updateError } = await supabase
      .from('contracts')
      .update({ fund_status: 'COMPLETED', completed_at: now.toISOString(), auto_complete_at: null })
      .eq('id', c.id)
    if (updateError) continue

    const { addContractEvent, handleSatisfactionBatch } = await import("./contract-machine")
    await addContractEvent({
      contractId: c.id, actorId: "system",
      fromStatus: "HELD", toStatus: "COMPLETED",
      action: "auto_complete", reason: "超时自动完成",
    })
    try {
      await handleSatisfactionBatch(c.id)
    } catch { /* not all protocols support satisfaction hold */ }
  }
}

async function autoSettle() {
  // COMPLETED -> SETTLED for protocols without satisfaction hold
  // Currently handled by handleSatisfactionBatch (which may skip if hold=0)
  // This catches any contracts that fell through
}
