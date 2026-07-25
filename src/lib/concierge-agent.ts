import { getSupabase } from '@/lib/supabase-client'
import { callLLM } from '@/lib/llm-adapter'

interface ConciergeMessage {
  role: 'system'
  content: string
}

const FRICTION_KEYWORDS = [
  /退钱/i, /退款/i, /投诉/i, /差评/i, /服务极差/i,
  /态度差/i, /骗/i, /欺诈/i, /不干了/i, /取消/i,
]

function detectFriction(text: string): boolean {
  return FRICTION_KEYWORDS.some((p) => p.test(text))
}

export async function buildConciergeContext(userId: string, lastUserMessage?: string): Promise<ConciergeMessage[]> {
  const messages: ConciergeMessage[] = []

  if (!userId) return messages

  try {
    const { data: activeContracts } = await getSupabase()
      .from('contracts')
      .select('id, service_stage, core_fields')
      .or(`demander_id.eq.${userId},provider_id.eq.${userId}`)
      .in('fund_status', ['HELD', 'PENDING_HELD'])

    const now = new Date()
    for (const c of activeContracts ?? []) {
      const fields = (c.core_fields as Record<string, unknown>) ?? {}
      const serviceTime = fields.service_time as string | undefined
      if (serviceTime && c.service_stage != null && c.service_stage < 5) {
        const scheduled = new Date(serviceTime)
        const diffMs = scheduled.getTime() - now.getTime()
        const diffMin = diffMs / (1000 * 60)
        if (diffMin > 0 && diffMin <= 30) {
          messages.push({
            role: 'system',
            content: `【平台 AI 管家提醒】您有一个订单（${c.id}）将在 ${Math.round(diffMin)} 分钟后开始服务。请按时打卡并确保服务顺利进行。如需帮助请联系平台客服。`,
          })
        }
      }
    }
  } catch {
    // concierge failure should not break chat
  }

  if (lastUserMessage && detectFriction(lastUserMessage)) {
    try {
      const mediation = await callLLM([
        {
          role: 'system',
          content: `You are a platform mediation assistant. The user is showing signs of dissatisfaction with a service order.
Generate a brief, neutral, helpful mediation suggestion in Chinese (1-2 sentences) to de-escalate and guide the user toward platform-based resolution.
Keep it calm and constructive.`,
        },
        { role: 'user', content: `User message: "${lastUserMessage}"` },
      ])

      if (mediation && mediation.length > 10) {
        messages.push({
          role: 'system',
          content: `【平台 AI 智能调解】系统检测到沟通过程中可能存在分歧。以下为 AI 调解建议：\n${mediation.trim()}\n\n如问题仍未解决，请使用平台争议仲裁功能。`,
        })
      }
    } catch {
      messages.push({
        role: 'system',
        content: `【平台 AI 智能调解】检测到可能存在沟通分歧。建议双方冷静沟通，如无法达成一致，请使用平台争议仲裁功能解决。`,
      })
    }
  }

  return messages
}
