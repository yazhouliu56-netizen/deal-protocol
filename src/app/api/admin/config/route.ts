import { NextResponse } from "next/server"
import { withAuth } from "@/lib/api-auth"
import { getServiceClient } from "@/lib/supabase-client"
import { getConfig, updateConfig } from "@/lib/platform/config"
import type { PlatformConfig } from "@/lib/platform/config"

export const GET = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 })
  }

  const config = await getConfig()
  return NextResponse.json({ config })
})

export const PUT = withAuth(async (req, user) => {
  const svc = getServiceClient()
  const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'ADMIN') {
    return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 })
  }

  let body: { config: PlatformConfig }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "无效的 JSON" }, { status: 400 })
  }

  const { config } = body
  if (!config) {
    return NextResponse.json({ error: "缺少 config 字段" }, { status: 400 })
  }

  if (!config.fees?.commissionTiers?.length) {
    return NextResponse.json({ error: "至少需要一个佣金阶梯" }, { status: 400 })
  }
  if (!config.credit?.levels?.length) {
    return NextResponse.json({ error: "至少需要一个信用等级" }, { status: 400 })
  }
  if (config.fees.satisfactionHold < 0 || config.fees.satisfactionHold > 1) {
    return NextResponse.json({ error: "满意暂存款比例必须在 0-1 之间" }, { status: 400 })
  }
  if (config.insurance.ratePerOrder < 0 || config.insurance.ratePerOrder > 1) {
    return NextResponse.json({ error: "保险费率必须在 0-1 之间" }, { status: 400 })
  }

  const pool = config.insurance.poolAllocation
  const total = pool.warranty + pool.customer + pool.provider + pool.sos
  if (Math.abs(total - 1) > 0.01) {
    return NextResponse.json({ error: "保险池分配比例之和必须为 1" }, { status: 400 })
  }

  await updateConfig(config)
  return NextResponse.json({ success: true, config })
})
