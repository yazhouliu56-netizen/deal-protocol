import { getSupabase } from '@/lib/supabase-client'

interface AgentBidInput {
  agentKey: string
  protocolId: string
  bidAmount: number
  estimatedHours: number
}

interface AgentBidResult {
  success: true
  status: 'BID_REGISTERED'
  agentId: string
}

export async function processAgentBid(input: AgentBidInput): Promise<AgentBidResult> {
  const supabase = getSupabase()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, is_agent, agent_webhook_url')
    .eq('id', input.agentKey)
    .maybeSingle()

  if (!profile) throw new Error('Agent profile not found')
  if (!profile.is_agent) throw new Error('Profile is not registered as an AI agent')

  const { data: protocol } = await supabase
    .from('protocols')
    .select('id, status, category, response_mode')
    .eq('id', input.protocolId)
    .maybeSingle()

  if (!protocol) throw new Error('Protocol not found')
  if (protocol.status !== 'matching' && protocol.status !== 'draft') {
    throw new Error('Protocol is not accepting bids')
  }
  if (protocol.response_mode !== 'agency_dispatch') {
    throw new Error('Protocol response mode does not support agency dispatch')
  }

  const { error } = await supabase.from('notifications').insert({
    user_id: protocol.id,
    title: 'AI Agent 竞价通知',
    content: `Agent ${profile.id.slice(0, 8)} 对协议 #${input.protocolId.slice(0, 8)} 出价 ¥${input.bidAmount}（预计 ${input.estimatedHours}h）`,
    type: 'agent_bid',
  })

  if (error) throw new Error(`Failed to register bid: ${error.message}`)

  return {
    success: true,
    status: 'BID_REGISTERED',
    agentId: profile.id,
  }
}
