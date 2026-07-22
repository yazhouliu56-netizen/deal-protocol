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
  } catch (err: any) {
    return NextResponse.json(
      { status: "unhealthy", reason: err.message || "Internal Check Crash" },
      { status: 500 },
    )
  }
}
