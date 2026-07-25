import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { inspectServiceQuality } from "@/lib/vision-inspector"

export const POST = withAuth(async (req: Request, user) => {
  try {
    const body = await req.json()
    const { contractId, beforePhotoUrl, afterPhotoUrl, categorySlug } = body

    if (!contractId || !beforePhotoUrl || !afterPhotoUrl || !categorySlug) {
      return NextResponse.json(
        { error: "contractId, beforePhotoUrl, afterPhotoUrl, and categorySlug are required" },
        { status: 400 },
      )
    }

    const report = await inspectServiceQuality(contractId, beforePhotoUrl, afterPhotoUrl, categorySlug)
    return NextResponse.json({ success: true, report })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    return NextResponse.json({ error: message }, { status: 400 })
  }
})
