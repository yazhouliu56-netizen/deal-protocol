import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const supabase = getServiceClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { targetUserId } = await req.json()
  if (!targetUserId) {
    return NextResponse.json({ error: "Missing parameter: targetUserId" }, { status: 400 })
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      compliance_status: "NORMAL",
      reputation_score: 5.00,
    })
    .eq("id", targetUserId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from("notifications").insert({
    user_id: targetUserId,
    title: "官方特赦令：声誉限制已解除",
    content:
      "经平台系统运维委员会人工审查，您的声誉画像已全面恢复，抢单准入优先级已重置为正常级别。",
    type: "system",
  })

  return NextResponse.json({ success: true, message: "Amnesty applied successfully." })
})
