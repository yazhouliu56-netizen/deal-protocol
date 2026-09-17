import { getServiceClient } from "@/lib/supabase-client"
import { getConfig } from "@/lib/platform/config"

export async function checkCancelPenalty(userId: string): Promise<{
  needsPrepay: boolean
  penalized: boolean
  penaltyCredit: number
  penaltyDays: number
  cancelCount: number
}> {
  const config = await getConfig()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  // R10：匿名读 contracts 全被 parties 策略过滤 → cancelCount 恒 0 = 罚则静默失效；走 service。
  const supabase = getServiceClient()

  const { count } = await supabase
    .from('contracts')
    .select('*', { count: 'exact', head: true })
    .eq('provider_id', userId)
    .eq('fund_status', 'CANCELLED')
    .gte('updated_at', monthStart.toISOString())

  const cancelCount = count ?? 0

  return {
    needsPrepay: cancelCount >= config.rules.cancelThreshold,
    penalized: cancelCount >= config.rules.cancelPenaltyCount,
    penaltyCredit: config.rules.cancelPenaltyCredit,
    penaltyDays: config.rules.cancelPenaltyDays,
    cancelCount,
  }
}
