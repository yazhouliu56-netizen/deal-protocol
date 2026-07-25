import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"
import { allocateVirtualNumber, maskPhone } from "@/lib/privacy-guard"

export const POST = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const body = await req.json()
  const { contractId } = body

  if (!contractId) {
    return NextResponse.json({ error: "contractId required" }, { status: 400 })
  }

  const { data: contract } = await svc
    .from("contracts")
    .select("id, customer_id, provider_id")
    .eq("id", contractId)
    .single()

  if (!contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 })
  }

  const isCustomer = contract.customer_id === user.id
  const isProvider = contract.provider_id === user.id
  if (!isCustomer && !isProvider) {
    return NextResponse.json({ error: "Not a party to this contract" }, { status: 403 })
  }

  const { data: partnerProfile } = await svc
    .from("profiles")
    .select("phone")
    .eq("id", isCustomer ? contract.provider_id : contract.customer_id)
    .single()

  if (!partnerProfile?.phone) {
    return NextResponse.json({ error: "Partner has no phone" }, { status: 404 })
  }

  const role = isCustomer ? "customer" : "provider"
  const { proxyNumber, expiresAt } = await allocateVirtualNumber(contractId, partnerProfile.phone, role)

  return NextResponse.json({
    proxyNumber,
    maskedPartnerPhone: maskPhone(partnerProfile.phone),
    expiresAt: expiresAt.toISOString(),
  })
})
