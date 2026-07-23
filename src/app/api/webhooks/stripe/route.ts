import { NextResponse } from "next/server"
import Stripe from "stripe"
import { getServiceClient } from "@/lib/supabase-client"
import { addContractEvent } from "@/lib/contract-machine"
import { emitEvent } from "@/lib/event-bus"

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
  return new Stripe(key, { apiVersion: "2026-06-24.dahlia" })
}

async function handlePaymentSuccess(
  intent: Stripe.PaymentIntent,
  svc: ReturnType<typeof getServiceClient>,
) {
  const contractId = intent.metadata?.contractId
  if (!contractId) return

  const { data: existingPayment } = await svc
    .from("payments")
    .select("id, status")
    .eq("provider_payment_id", intent.id)
    .maybeSingle()

  if (existingPayment) return

  const { data: contract } = await svc
    .from("contracts")
    .select("id, fund_status, customer_id, provider_id")
    .eq("id", contractId)
    .single()

  if (!contract || contract.fund_status === "HELD") return

  await svc.from("contracts").update({ fund_status: "HELD" }).eq("id", contractId)

  await svc.from("payments").insert({
    contract_id: contractId,
    status: "SUCCEEDED",
    provider: "stripe",
    provider_payment_id: intent.id,
    amount: intent.amount / 100,
  })

  await svc.from("notifications").insert([
    {
      user_id: contract.customer_id,
      title: "支付成功",
      body: `订单 ${contractId.slice(0, 8)}... 支付已完成，资金已托管`,
      type: "pay",
    },
    {
      user_id: contract.provider_id,
      title: "支付成功",
      body: `订单 ${contractId.slice(0, 8)}... 客户已付款，请开始服务`,
      type: "pay",
    },
  ])

  await addContractEvent({
    contractId,
    actorId: contract.customer_id,
    fromStatus: contract.fund_status,
    toStatus: "HELD",
    action: "pay",
    reason: `Stripe payment succeeded: ${intent.id}`,
    metadata: JSON.stringify({ providerPaymentId: intent.id }),
  })

  await emitEvent({
    type: "order",
    id: contractId,
    action: "pay",
    userId: "system",
    metadata: { fundStatus: "HELD", provider: "stripe" },
  })
}

async function handlePaymentFailed(
  intent: Stripe.PaymentIntent,
  svc: ReturnType<typeof getServiceClient>,
) {
  const contractId = intent.metadata?.contractId
  if (!contractId) return

  const { data: existingPayment } = await svc
    .from("payments")
    .select("id, status")
    .eq("provider_payment_id", intent.id)
    .maybeSingle()

  if (existingPayment) return

  await svc.from("payments").insert({
    contract_id: contractId,
    status: "FAILED",
    provider: "stripe",
    provider_payment_id: intent.id,
    amount: intent.amount / 100,
  })

  await svc.from("notifications").insert({
    user_id: intent.metadata?.payerId ?? "system",
    title: "支付失败",
    body: `订单 ${contractId.slice(0, 8)}... 支付未成功，请重试`,
    type: "pay",
  })
}

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
  }

  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature verification failed"
    console.warn("Stripe webhook signature verification failed:", message)
    return NextResponse.json({ error: "Signature verification failed" }, { status: 400 })
  }

  const svc = getServiceClient()

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent
        await handlePaymentSuccess(intent, svc)
        break
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent
        await handlePaymentFailed(intent, svc)
        break
      }
    }
  } catch (err) {
    console.warn(`Stripe webhook handler error for ${event.type}:`, err)
    return NextResponse.json({ error: "Internal handler error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
