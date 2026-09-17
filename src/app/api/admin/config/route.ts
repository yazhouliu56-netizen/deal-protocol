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
    return NextResponse.json({ error: "ȱ�� config �ֶ�" }, { status: 400 })
  }

  // P2：commissionTiers 退役为历史兼容字段，不再强制要求。
  if (!config.credit?.levels?.length) {
    return NextResponse.json({ error: "至少需要一个信用等级" }, { status: 400 })
  }
  if (config.fees.satisfactionHold < 0 || config.fees.satisfactionHold > 1) {
    return NextResponse.json({ error: "�����ݴ����������� 0-1 ֮��" }, { status: 400 })
  }
  // P0：新费率字段范围校验（缺失=老版本配置，跳过以兼容渐进升级）。
  const f = config.fees as Record<string, unknown>
  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
  if (f.commissionRate !== undefined && (!num(f.commissionRate) || (f.commissionRate as number) < 0 || (f.commissionRate as number) > 1)) {
    return NextResponse.json({ error: "commissionRate 须在 0-1 之间" }, { status: 400 })
  }
  const shares = f.settlementShares as { key: string; pct: number }[] | undefined
  if (shares !== undefined) {
    const sum = shares.reduce((s, x) => s + (Number(x.pct) || 0), 0)
    if (Math.abs(sum - 100) > 1e-9) {
      return NextResponse.json({ error: `settlementShares 和必须≡100，收到 ${sum}` }, { status: 400 })
    }
  }
  const ch = f.channelRates as Record<string, number> | undefined
  if (ch !== undefined) {
    for (const k of ['wechat', 'alipay', 'stripe']) {
      if (!num(ch[k]) || ch[k] < 0 || ch[k] > 1) {
        return NextResponse.json({ error: `channelRates.${k} 须在 0-1 之间` }, { status: 400 })
      }
    }
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
