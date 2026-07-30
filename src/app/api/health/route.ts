import { NextResponse } from "next/server"
import { getServiceClient } from "@/lib/supabase-client"

export async function GET() {
  try {
    const supabase = getServiceClient()

    const { error } = await supabase.from("profiles").select("id").limit(1)

    if (error) {
      return NextResponse.json(
        { status: "unhealthy", db: error.message, timestamp: new Date().toISOString() },
        { status: 503 },
      )
    }

    return NextResponse.json(
      { status: "healthy", engine: "Next.js Standalone", timestamp: new Date().toISOString() },
      { status: 200 },
    )
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : "Internal Check Crash"
    return NextResponse.json(
      { status: "unhealthy", reason },
      { status: 500 },
    )
  }
}
