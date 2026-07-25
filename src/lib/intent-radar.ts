import { getSupabase } from '@/lib/supabase-client'

export interface PredictedIntent {
  hasPrediction: boolean
  predictedCategory: string
  suggestedDate: string
  draftProtocol: Record<string, unknown>
  earlyBirdDiscount: number
}

export async function predictUserNextIntent(userId: string): Promise<PredictedIntent> {
  const supabase = getSupabase()

  const { data: completedOrders } = await supabase
    .from('contracts')
    .select('id, demand_id, amount, created_at')
    .eq('customer_id', userId)
    .in('fund_status', ['RELEASED', 'SETTLED'])
    .order('created_at', { ascending: false })
    .limit(20)

  if (!completedOrders || completedOrders.length < 2) {
    const { data: singleOrder } = await supabase
      .from('contracts')
      .select('id, demand_id, created_at')
      .eq('customer_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!singleOrder) {
      return {
        hasPrediction: false,
        predictedCategory: '',
        suggestedDate: '',
        draftProtocol: {},
        earlyBirdDiscount: 0,
      }
    }

    const futureDate = new Date(singleOrder.created_at)
    futureDate.setDate(futureDate.getDate() + 14)
    return {
      hasPrediction: true,
      predictedCategory: '家政',
      suggestedDate: futureDate.toISOString().split('T')[0],
      draftProtocol: {
        title: '复购预约（AI 预测）',
        category: '家政',
        estimated_amount: 200,
        note: '基于您上次预约记录，AI 推测您可能需要再次预约服务。',
      },
      earlyBirdDiscount: 20,
    }
  }

  const timestamps = completedOrders.map((o) => new Date(o.created_at).getTime())
  const intervals: number[] = []
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i - 1] - timestamps[i])
  }
  const avgIntervalMs = intervals.reduce((a, b) => a + b, 0) / intervals.length
  const avgIntervalDays = Math.round(avgIntervalMs / (1000 * 60 * 60 * 24))
  const predictedDays = Math.max(1, avgIntervalDays)

  const lastOrderDate = new Date(timestamps[0])
  const suggestedDate = new Date(lastOrderDate.getTime() + avgIntervalMs)
  const suggestedDateStr = suggestedDate.toISOString().split('T')[0]

  const predictedCategory = '家政'

  return {
    hasPrediction: true,
    predictedCategory,
    suggestedDate: suggestedDateStr,
    draftProtocol: {
      title: 'AI 预测复购预约',
      category: predictedCategory,
      estimated_amount: 200,
      predicted_interval_days: predictedDays,
      note: `基于您过去 ${completedOrders.length} 次消费记录，您平均每 ${predictedDays} 天预约一次${predictedCategory}服务。系统已为您预填此卡片。`,
    },
    earlyBirdDiscount: 20,
  }
}
