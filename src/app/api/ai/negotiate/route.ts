import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { proposeCounterOffer } from "@/lib/ai-negotiator"

export const POST = withAuth(async (req) => {
  const body = await req.json()
  const { userBudget, providerExpectedPrice, categorySlug, description } = body

  if (!userBudget || !providerExpectedPrice || !categorySlug || !description) {
    return NextResponse.json({ error: "Missing required fields: userBudget, providerExpectedPrice, categorySlug, description" }, { status: 400 })
  }

  const result = await proposeCounterOffer({
    userBudget: Number(userBudget),
    providerExpectedPrice: Number(providerExpectedPrice),
    categorySlug: String(categorySlug),
    description: String(description),
  })

  if (!result.success) {
    return NextResponse.json({ error: "Negotiation failed" }, { status: 400 })
  }

  return NextResponse.json(result)
})
