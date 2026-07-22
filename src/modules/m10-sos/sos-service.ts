// M10: SOS 与安全应急
// 五步触发链：①冻结订单→②推送安全值班→③共享位置→④报警指引→⑤暂停接单

import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '@/modules/m07-credit/credit-engine'

interface SOSInput {
  userId: string
  protocolId: string
  latitude: number
  longitude: number
}

interface SOSResult {
  success: boolean
  frozenAt: string
}

const SMS_API_URL = process.env.SMS_API_URL ?? 'https://api.sms-service.com/send'
const PUSH_API_URL = process.env.PUSH_API_URL ?? 'https://api.push-service.com/push'

export async function triggerSOS(input: SOSInput): Promise<SOSResult> {
  const now = new Date().toISOString()

  // ======== ① 冻结当前订单 ========
  await getSupabase()
    .from('protocols')
    .update({ status: 'disputed' })
    .eq('id', input.protocolId)

  // ======== ① 同时记录证据 ========
  const evidence = await appendEvidence({
    protocolId: input.protocolId,
    eventType: 'sos',
    payload: {
      triggered_by: input.userId,
      latitude: input.latitude,
      longitude: input.longitude,
      timestamp: now,
    },
    capturedBy: input.userId,
  })

  // ======== ② 推送平台安全值班 ========
  await notifySecurityTeam(input, 'ALERT_LEVEL_HIGH')

  // ======== ③ 向紧急联系人共享实时位置 ========
  await notifyEmergencyContact(input)

  // ======== ④ 获取服务者信息，暂停接单 ========
  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('provider_id, category')
    .eq('id', input.protocolId)
    .single()

  if (protocol?.provider_id) {
    await getSupabase()
      .from('provider_categories')
      .update({ is_online: false })
      .eq('user_id', protocol.provider_id)

    if (evidence) {
      await updateCredit({
        userId: protocol.provider_id,
        category: protocol.category as string,
        eventType: 'sos',
        evidenceId: evidence.id,
        description: `SOS triggered on protocol ${input.protocolId}`,
      })
    }
  }

  return {
    success: true,
    frozenAt: now,
  }
}

async function notifySecurityTeam(input: SOSInput, level: string): Promise<void> {
  const message = `[M10] SOS: user ${input.userId} triggered alert on protocol ${input.protocolId} at (${input.latitude}, ${input.longitude})`

  const { data: admins } = await getSupabase()
    .from('profiles')
    .select('id, phone')
    .eq('role', 'ADMIN')

  if (admins && admins.length > 0) {
    for (const admin of admins) {
      await getSupabase().from('notifications').insert({
        user_id: admin.id,
        title: 'SOS Alert',
        body: message,
        type: 'sos_alert',
      })
    }
  }

  const smsApiKey = process.env.SMS_API_KEY
  const pushApiKey = process.env.PUSH_API_KEY

  if (smsApiKey && admins && admins.length > 0) {
    const phones = admins.map((a: { phone: string | null }) => a.phone).filter(Boolean) as string[]
    for (const phone of phones) {
      try {
        await fetch(SMS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${smsApiKey}` },
          body: JSON.stringify({ to: phone, text: message }),
        })
      } catch {
        // non-fatal
      }
    }
  }

  if (pushApiKey) {
    try {
      await fetch(PUSH_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pushApiKey}` },
        body: JSON.stringify({
          title: 'SOS Alert',
          body: message,
          priority: level === 'ALERT_LEVEL_HIGH' ? 'high' : 'normal',
        }),
      })
    } catch {
      // non-fatal
    }
  }

  if (!smsApiKey && !pushApiKey) {
    console.log(`
[M10] SECURITY TEAM NOTIFICATION
  User: ${input.userId}
  Protocol: ${input.protocolId}
  Location: ${input.latitude}, ${input.longitude}
  Time: ${new Date().toISOString()}
  Level: ${level}
  Admins: ${admins?.length ?? 0}
  Channels: NONE (configure SMS_API_KEY or PUSH_API_KEY)
    `)
  }
}

async function notifyEmergencyContact(input: SOSInput): Promise<void> {
  const locationLink = `https://maps.google.com/?q=${input.latitude},${input.longitude}`
  const message = `EMERGENCY: ${input.userId} triggered SOS. Location: ${input.latitude}, ${input.longitude} — ${locationLink}`

  let contacts: { name: string; phone: string }[] = []

  const { data: emergencyContacts } = await getSupabase()
    .from('emergency_contacts')
    .select('name, phone')
    .eq('user_id', input.userId)

  if (emergencyContacts && emergencyContacts.length > 0) {
    contacts = emergencyContacts
  } else {
    const { data: profile } = await getSupabase()
      .from('profiles')
      .select('name, phone')
      .eq('id', input.userId)
      .maybeSingle()

    if (profile?.phone) {
      contacts = [{ name: profile.name ?? 'User', phone: profile.phone }]
    }
  }

  await appendEvidence({
    protocolId: input.protocolId,
    eventType: 'location_ping',
    payload: {
      action: 'emergency_location_share',
      latitude: input.latitude,
      longitude: input.longitude,
      contacts_notified: contacts.length,
    },
    capturedBy: input.userId,
  })

  if (contacts.length === 0) return

  const smsApiKey = process.env.SMS_API_KEY

  if (smsApiKey) {
    for (const contact of contacts) {
      try {
        await fetch(SMS_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${smsApiKey}` },
          body: JSON.stringify({ to: contact.phone, text: message }),
        })
      } catch {
        // non-fatal
      }
    }
  } else {
    console.log(`
[M10] EMERGENCY CONTACT NOTIFICATION
  User: ${input.userId}
  Location: ${input.latitude}, ${input.longitude}
  Map: ${locationLink}
  Contacts: ${contacts.map(c => `${c.name} (${c.phone})`).join(', ')}
  Channel: FALLBACK (configure SMS_API_KEY for real SMS)
    `)
  }
}

// 查询协议的安全状态
export async function getSOSStatus(protocolId: string): Promise<{
  sosTriggered: boolean
  protocolStatus: string
  providerSuspended: boolean
} | null> {
  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('status, provider_id')
    .eq('id', protocolId)
    .single()

  if (!protocol) return null

  let providerSuspended = false
  if (protocol.provider_id) {
    const { data: pc } = await getSupabase()
      .from('provider_categories')
      .select('is_online')
      .eq('user_id', protocol.provider_id)
      .maybeSingle()
    providerSuspended = pc?.is_online === false
  }

  const { data: sosEv } = await getSupabase()
    .from('evidence_log')
    .select('id')
    .eq('protocol_id', protocolId)
    .eq('event_type', 'sos')
    .maybeSingle()

  return {
    sosTriggered: !!sosEv,
    protocolStatus: protocol.status,
    providerSuspended,
  }
}
