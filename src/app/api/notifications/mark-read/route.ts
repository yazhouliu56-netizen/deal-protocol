import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const supabase = getServiceClient()
  const { notificationId, all } = await req.json()

  if (all === true) {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: "All notifications marked as read." })
  }

  if (!notificationId) {
    return NextResponse.json({ error: "Missing parameter: notificationId" }, { status: 400 })
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, target: notificationId })
})
