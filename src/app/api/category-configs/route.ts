import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"

export const GET = withAuth(async () => {
  const supabase = await getRouteClient()
  const { data, error } = await supabase
    .from('category_configs')
    .select('*')
    .eq('enabled', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ categories: data })
})
