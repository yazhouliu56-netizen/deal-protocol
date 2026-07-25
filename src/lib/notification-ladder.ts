import { getServiceClient } from '@/lib/supabase-client'
import { wechatPayService } from '@/lib/wechat-pay-service'

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
    const tokenData: any = await accessTokenResponse.json()
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
    const smsService = process.env.SMS_PROVIDER ?? 'mock'

    if (smsService === 'mock' || !process.env.ALIYUN_SMS_ACCESS_KEY_ID) {
      console.log(`[SMS MOCK] To: ${input.phone} — ${input.title}: ${input.content}`)
    } else {
      const aliyunParams = new URLSearchParams({
        AccessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
        Action: 'SendSms',
        Format: 'JSON',
        PhoneNumbers: input.phone,
        SignName: process.env.ALIYUN_SMS_SIGN_NAME ?? 'DealProtocol',
        TemplateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE ?? 'SMS_EMERGENCY',
        TemplateParam: JSON.stringify({ title: input.title, content: input.content }),
        Version: '2017-05-25',
        Timestamp: new Date().toISOString(),
      })

      await fetch(
        `https://dysmsapi.aliyuncs.com/?${aliyunParams.toString()}`,
        { method: 'GET' },
      )
    }

    return { ladder: 'sms', sentAt: new Date().toISOString(), success: true }
  } catch (err) {
    console.warn('[NotificationLadder] SMS rung failed:', err)
    return { ladder: 'sms', sentAt: new Date().toISOString(), success: false }
  }
}
