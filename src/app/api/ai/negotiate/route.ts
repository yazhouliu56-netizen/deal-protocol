import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { createNegotiationStream } from "@/lib/ai-negotiator"

export const POST = withAuth(async (req) => {
  const body = await req.json()
  const { demandTitle, category, currentBudget, proposedPrice } = body

  if (!demandTitle || !category || !currentBudget || !proposedPrice) {
    return NextResponse.json(
      { error: "Missing required fields: demandTitle, category, currentBudget, proposedPrice" },
      { status: 400 },
    )
  }

  const result = createNegotiationStream({
    demandTitle: String(demandTitle),
    category: String(category),
    currentBudget: Number(currentBudget),
    proposedPrice: Number(proposedPrice),
  })

  const streamResponse = result.toTextStreamResponse()

  return new NextResponse(streamResponse.body, {
    status: streamResponse.status,
    statusText: streamResponse.statusText,
    headers: streamResponse.headers,
  })
})
