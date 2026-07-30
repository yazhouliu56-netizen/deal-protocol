import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { createNegotiationStream } from "@/lib/ai-negotiator"

export const POST = withAuth(async (req) => {
  try {
    const body = await req.json()
    const { demandTitle, category, currentBudget, proposedPrice, personality } = body

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
      personality: personality as 'tsundere' | 'genki' | 'maid' | 'hybrid' | undefined,
    })

    const streamResponse = result.toTextStreamResponse()

    return new NextResponse(streamResponse.body, {
      status: streamResponse.status,
      statusText: streamResponse.statusText,
      headers: streamResponse.headers,
    })
  } catch {
    return NextResponse.json(
      { error: "[赛博小精灵离线打卡] 协商服务暂时不可用，请稍后重试" },
      { status: 503 },
    )
  }
})
