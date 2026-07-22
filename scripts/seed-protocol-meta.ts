import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey)

const protocolMetaMap: Record<string, Record<string, unknown>> = {
  '家政': {
    roles: {
      client: { min: 1, max: 1 },
      responder: { min: 1, max: 1 },
      platform: { required: true },
    },
    promises: {
      client: '按时付款+提供现场环境',
      responder: '按时到达+按SOP完成',
    },
    funding_mode_default: 'full_prepay',
    states: ['draft', 'pending_held', 'held', 'in_progress', 'completed', 'disputed', 'settled'],
    completion: {
      criteria: 'client_confirms or auto_timeout',
      evidence: ['completion_photo', 'chat_transcript', 'gps_trail'],
    },
    default: {
      criteria: 'no_show/unfinished/quality_issue/misconduct',
      evidence: ['before_after_photo', 'chat', 'gps'],
    },
    review: {
      dimensions: {
        problem_solving: { weight: 0.4 },
        punctuality: { weight: 0.2 },
        price_transparency: { weight: 0.15 },
        communication: { weight: 0.15 },
        cleanliness: { weight: 0.1 },
      },
    },
  },
  '交友': {
    roles: {
      client: { min: 1, max: 1 },
      responder: { min: 1, max: 1 },
      platform: { required: true },
    },
    promises: {
      client: '准时赴约+尊重对方',
      responder: '准时赴约+真实信息',
    },
    funding_mode_default: 'none',
    states: ['draft', 'pending_held', 'held', 'in_progress', 'completed', 'disputed', 'settled'],
    completion: {
      criteria: 'both_confirm or auto_timeout',
      evidence: ['chat_transcript', 'gps_trail'],
    },
    default: {
      criteria: 'no_show/misconduct/fake_info',
      evidence: ['chat', 'gps'],
    },
    review: {
      dimensions: {
        punctuality: { weight: 0.3 },
        communication: { weight: 0.25 },
        authenticity: { weight: 0.3 },
        cleanliness: { weight: 0.15 },
      },
    },
  },
  '按摩': {
    roles: {
      client: { min: 1, max: 1 },
      responder: { min: 1, max: 1 },
      platform: { required: true },
    },
    promises: {
      client: '按时付款+遵守场所规定',
      responder: '按时到达+按SOP完成+着装规范',
    },
    funding_mode_default: 'full_prepay',
    states: ['draft', 'pending_held', 'held', 'in_progress', 'completed', 'disputed', 'settled'],
    completion: {
      criteria: 'client_confirms or auto_timeout',
      evidence: ['completion_photo', 'chat_transcript'],
    },
    default: {
      criteria: 'no_show/unfinished/quality_issue/misconduct/safety_violation',
      evidence: ['before_after_photo', 'chat', 'gps'],
    },
    review: {
      dimensions: {
        problem_solving: { weight: 0.3 },
        punctuality: { weight: 0.15 },
        price_transparency: { weight: 0.15 },
        communication: { weight: 0.15 },
        cleanliness: { weight: 0.1 },
        safety_compliance: { weight: 0.15 },
      },
    },
  },
  '医疗陪护': {
    roles: {
      client: { min: 1, max: 1 },
      responder: { min: 1, max: 1 },
      platform: { required: true },
    },
    promises: {
      client: '按时付款+提供患者信息+家属陪同',
      responder: '按时到达+按医嘱完成陪护+保护隐私',
    },
    funding_mode_default: 'full_prepay',
    states: ['draft', 'pending_held', 'held', 'in_progress', 'completed', 'disputed', 'settled'],
    completion: {
      criteria: 'client_confirms or auto_timeout',
      evidence: ['completion_photo', 'chat_transcript', 'gps_trail'],
    },
    default: {
      criteria: 'no_show/unfinished/quality_issue/misconduct/privacy_breach',
      evidence: ['before_after_photo', 'chat', 'gps'],
    },
    review: {
      dimensions: {
        problem_solving: { weight: 0.3 },
        punctuality: { weight: 0.15 },
        price_transparency: { weight: 0.1 },
        communication: { weight: 0.2 },
        cleanliness: { weight: 0.05 },
        safety_compliance: { weight: 0.2 },
      },
    },
  },
}

async function main() {
  for (const [category, meta] of Object.entries(protocolMetaMap)) {
    const { error } = await supabase
      .from('category_configs')
      .update({ protocol_meta: meta })
      .eq('category', category)

    if (error) {
      console.error(`Failed to update ${category}:`, error.message)
    } else {
      console.log(`Updated ${category} with protocol_meta`)
    }
  }
}

main().catch(console.error)
