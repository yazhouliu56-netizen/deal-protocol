import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"

export const POST = withAuth(async (req, user) => {
  const svc = getServiceClient()

  const anonymousName = `\u5df2\u6ce8\u9500\u7528\u6237 #${user.id.slice(0, 8)}`

  const { error: profileError } = await svc
    .from('profiles')
    .update({
      name: anonymousName,
      phone: '00000000000',
      email: null,
      identity_verified: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id)
    .is('deleted_at', null)

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  const { error: userError } = await svc
    .from('users')
    .update({
      nickname: anonymousName,
      phone: '00000000000',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (userError) {
    console.warn('[Profile Delete] users table soft-delete failed:', userError.message)
  }

  try {
    await svc.auth.admin.updateUserById(user.id, { ban_duration: 'forever' })
  } catch (err) {
    console.warn('[Profile Delete] Auth ban failed:', err)
  }

  return NextResponse.json({
    success: true,
    message: 'Account deleted. Financial records retained per regulatory requirements.',
  })
})
