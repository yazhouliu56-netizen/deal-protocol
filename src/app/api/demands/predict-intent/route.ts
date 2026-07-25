import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { predictUserNextIntent } from "@/lib/intent-radar"

export const GET = withAuth(async (req: Request, user) => {
  try {
    const prediction = await predictUserNextIntent(user.id)
    return NextResponse.json(prediction)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})
