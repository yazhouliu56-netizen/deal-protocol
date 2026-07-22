import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getRouteClient } from "@/lib/supabase-route-client"
import { encryptPII } from "@/lib/pii-encrypt"

export const POST = withAuth(async (req, user) => {
  const { realName, idNumber, certificates } = await req.json()

  if (!realName || !idNumber || !certificates || !Array.isArray(certificates) || certificates.length === 0) {
    return NextResponse.json(
      { error: "请填写完整信息并上传至少一张证书图片" },
      { status: 400 },
    )
  }

  const supabase = await getRouteClient()

  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("verification_status")
    .eq("id", user.id)
    .single()

  if (fetchError) {
    return NextResponse.json({ error: "查询用户失败" }, { status: 500 })
  }

  if (profile.verification_status === "pending") {
    return NextResponse.json(
      { error: "您的资料已在审核中，请耐心等待" },
      { status: 400 },
    )
  }

  if (profile.verification_status === "approved") {
    return NextResponse.json(
      { error: "您已通过实名认证，无需重复提交" },
      { status: 400 },
    )
  }

  const encryptedIdNumber = encryptPII(idNumber)

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      verification_status: "pending",
      verification_real_name: realName,
      verification_id_number: encryptedIdNumber,
      verification_certificates: certificates,
      verification_rejected_reason: null,
      verification_submitted_at: new Date().toISOString(),
    })
    .eq("id", user.id)

  if (updateError) {
    return NextResponse.json({ error: "提交失败，请稍后重试" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
})
