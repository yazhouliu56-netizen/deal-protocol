// CRON: 信用衰减批量处理
// 设计方案§5.6: 30天冻结/90天衰减2%
// 建议通过 Vercel CRON / GitHub Actions 定时调用

import { NextResponse } from 'next/server'
import { applyBulkCreditDecay } from '@/modules/m07-credit/credit-engine'
import { trackMetric } from '@/lib/track-metric'

export async function GET() {
  try {
    const result = await applyBulkCreditDecay()

    trackMetric('credit.decay_processed' as any, result.processed)
    trackMetric('credit.decay_applied' as any, result.decayed)

    return NextResponse.json({
      success: true,
      ...result,
      message: `Processed ${result.processed} users, applied decay to ${result.decayed}`,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
