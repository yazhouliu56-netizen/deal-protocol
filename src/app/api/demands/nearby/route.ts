import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url)
  const lng = parseFloat(searchParams.get("lng") || "0")
  const lat = parseFloat(searchParams.get("lat") || "0")
  const radius = parseFloat(searchParams.get("radius") || "5000")

  if (!lng || !lat) {
    return NextResponse.json({ error: "lng and lat are required" }, { status: 400 })
  }

  const supabase = await getRouteClient()

  const { data: demands, error } = await supabase.rpc("get_nearby_demands", {
    client_lng: lng,
    client_lat: lat,
    radius_meters: radius,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: demands })
})
