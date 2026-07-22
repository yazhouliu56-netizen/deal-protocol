import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const supabase = getServiceClient()
  const { demandId } = await req.json()

  if (!demandId) {
    return NextResponse.json({ error: "Missing required parameter: demandId" }, { status: 400 })
  }

  const { data: demand, error: demandErr } = await supabase
    .from("demands")
    .select("title, embedding")
    .eq("id", demandId)
    .single()

  if (demandErr || !demand || !demand.embedding) {
    return NextResponse.json(
      { error: "Demand vector signature not initialized yet." },
      { status: 422 },
    )
  }

  const { data: candidates, error: matchErr } = await supabase
    .from("developer_profiles")
    .select("id")
    .limit(5)

  if (matchErr || !candidates) throw new Error("Failed to lookup matchable talent pool.")

  const notificationPayloads = candidates.map((dev) => ({
    user_id: dev.id,
    title: "智能商机雷达发现匹配项目",
    content: `新发布项目【${demand.title}】与您的技能画像高度匹配，建议立即开启报价竞标！`,
    type: "system",
  }))

  if (notificationPayloads.length > 0) {
    const { error: pushErr } = await supabase
      .from("notifications")
      .insert(notificationPayloads)

    if (pushErr) throw pushErr
  }

  return NextResponse.json({ success: true, processed_agents: notificationPayloads.length })
})
