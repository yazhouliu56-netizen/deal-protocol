import { getServiceClient } from '@/lib/supabase-client'
import { wechatPayService } from '@/lib/wechat-pay-service'
import { dispatchSmsWithFallback, type FallbackResult, type SmsDispatchOutput } from '@/base/platform/multi-channel-gateway'

export interface EscalationInput {
  userId: string
  notificationId: string
  title: string
  content: string
  type?: 'system' | 'order' | 'finance' | 'arbitration'
  priority: 'P0' | 'P1' | 'P2'
  phone?: string
  wechatOpenId?: string
}

export interface EscalationResult {
  ladder: 'realtime' | 'wechat' | 'sms'
  sentAt: string
  success: boolean
}

const LADDER_DELAYS: Record<string, number> = {
  realtime: 0,
  wechat: 3 * 60_000,
  sms: 10 * 60_000,
}

export async function dispatchEscalatedNotification(input: EscalationInput): Promise<EscalationResult[]> {
  const results: EscalationResult[] = []
  const svc = getServiceClient()

  const rung1 = await rungRealtime(input, svc)
  results.push(rung1)

  if (input.priority === 'P0') {
    setTimeout(async () => {
      const rung2 = await rungWechat(input, svc)
      results.push(rung2)
    }, LADDER_DELAYS.wechat)

    setTimeout(async () => {
      const rung3 = await rungSms(input, svc)
      results.push(rung3)
    }, LADDER_DELAYS.sms)
  }

  return results
}

async function rungRealtime(
  input: EscalationInput,
  svc: ReturnType<typeof getServiceClient>,
): Promise<EscalationResult> {
  try {
    await svc
      .from('notifications')
      .insert({
        user_id: input.userId,
        title: input.title,
        content: input.content,
        type: input.type ?? 'system',
        is_read: false,
      })

    await svc.rpc('pg_notify', {
      channel: 'notification',
      payload: JSON.stringify({ user_id: input.userId, title: input.title, content: input.content }),
    })

    return { ladder: 'realtime', sentAt: new Date().toISOString(), success: true }
  } catch (err) {
    console.warn('[NotificationLadder] Realtime rung failed:', err)
    return { ladder: 'realtime', sentAt: new Date().toISOString(), success: false }
  }
}

async function rungWechat(
  input: EscalationInput,
  _svc: ReturnType<typeof getServiceClient>,
): Promise<EscalationResult> {
  if (!input.wechatOpenId) {
    console.warn('[NotificationLadder] WeChat rung skipped: no wechatOpenId')
    return { ladder: 'wechat', sentAt: new Date().toISOString(), success: false }
  }

  try {
    const templateData = {
      touser: input.wechatOpenId,
      template_id: process.env.WECHAT_TEMPLATE_ID ?? 'priority_notification',
      data: {
        first: { value: input.title },
        keyword1: { value: input.content },
        keyword2: { value: new Date().toLocaleString('zh-CN') },
        remark: { value: `Priority: ${input.priority}` },
      },
    }

    const accessTokenResponse = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${wechatPayService['appId']}&secret=${wechatPayService['appSecret']}`,
    )
    const tokenData = await accessTokenResponse.json() as { access_token?: string; errcode?: number; errmsg?: string }
    if (!tokenData.access_token) {
      throw new Error(`WeChat token failed: ${JSON.stringify(tokenData)}`)
    }

    await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${tokenData.access_token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      },
    )

    return { ladder: 'wechat', sentAt: new Date().toISOString(), success: true }
  } catch (err) {
    console.warn('[NotificationLadder] WeChat rung failed:', err)
    return { ladder: 'wechat', sentAt: new Date().toISOString(), success: false }
  }
}

async function rungSms(
  input: EscalationInput,
  _svc: ReturnType<typeof getServiceClient>,
): Promise<EscalationResult> {
  if (!input.phone) {
    console.warn('[NotificationLadder] SMS rung skipped: no phone')
    return { ladder: 'sms', sentAt: new Date().toISOString(), success: false }
  }

  try {
    // L5-M1 多通道热备总线：阿里云 ➔ 腾讯云 ➔ 华为云 ➔ 本地 Mock 存根
    // （任一厂商宕机平滑下跳，全挂时确定性落地站内日志，红线 1 不抛错）
    const dispatched: FallbackResult<SmsDispatchOutput> = await dispatchSmsWithFallback({
      phone: input.phone,
      title: input.title,
      content: input.content,
    })

    const { usedVendor, fallbackHops } = dispatched
    if (usedVendor === 'LOCAL_MOCK') {
      console.log(`[SMS MOCK] To: ${input.phone} — ${input.title}: ${input.content}`)
    } else if (fallbackHops > 0) {
      console.warn(`[SMS Ladder] vendor=${usedVendor} after ${fallbackHops} fallback hops`)
    }

    return { ladder: 'sms', sentAt: new Date().toISOString(), success: dispatched.result.success }
  } catch (err) {
    console.warn('[NotificationLadder] SMS rung failed:', err)
    return { ladder: 'sms', sentAt: new Date().toISOString(), success: false }
  }
}
