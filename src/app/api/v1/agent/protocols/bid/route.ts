import { NextResponse } from "next/server"
import { processAgentBid } from "@/lib/agent-gateway"

export const POST = async (req: Request) => {
  try {
    const body = await req.json()
    const { agentKey, protocolId, bidAmount, estimatedHours } = body

    if (!agentKey || !protocolId) {
      return NextResponse.json(
        { error: "agentKey and protocolId are required" },
        { status: 400 },
      )
    }
    if (typeof bidAmount !== "number" || bidAmount <= 0) {
      return NextResponse.json(
        { error: "bidAmount must be a positive number" },
        { status: 400 },
      )
    }
    if (typeof estimatedHours !== "number" || estimatedHours <= 0) {
      return NextResponse.json(
        { error: "estimatedHours must be a positive number" },
        { status: 400 },
      )
    }

    const result = await processAgentBid({ agentKey, protocolId, bidAmount, estimatedHours })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
