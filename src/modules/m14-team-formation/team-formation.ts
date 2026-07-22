import { getSupabase } from '@/lib/supabase-client'
import { appendEvidence } from '@/modules/m11-evidence-log/evidence-chain'
import { updateCredit } from '@/modules/m07-credit/credit-engine'

export interface TeamProtocolInput {
  leaderId: string
  category: string
  coreFields: Record<string, unknown>
  categoryFields: Record<string, unknown>
  totalBudget: number
  teamRequests: {
    roleDesc: string
    requiredSkills: string[]
    reward: number
  }[]
}

export interface CreateTeamResult {
  success: boolean
  protocolId?: string
  requestIds?: string[]
}

export interface TeamRequestInput {
  parentProtocolId: string
  leaderId: string
  roleDesc: string
  requiredSkills: string[]
  reward: number
}

export interface TeamRequestResult {
  success: boolean
  requestId?: string
}

export interface TeamInfo {
  leader: {
    id: string
    nickname: string | null
  }
  members: {
    requestId: string
    providerId: string
    roleDesc: string
    reward: number
    skills: string[]
  }[]
  openRequests: {
    id: string
    roleDesc: string
    requiredSkills: string[]
    reward: number
  }[]
}

export async function createTeamProtocol(input: TeamProtocolInput): Promise<CreateTeamResult> {
  const { data: protocol } = await getSupabase()
    .from('protocols')
    .insert({
      demander_id: input.leaderId,
      provider_id: input.leaderId,
      category: input.category,
      core_fields: input.coreFields,
      category_fields: input.categoryFields,
      origin_type: 'contractor_self_funded',
      status: 'draft',
    })
    .select()
    .single()

  if (!protocol) return { success: false }

  const requestIds: string[] = []
  for (const tr of input.teamRequests) {
    const { data: req } = await getSupabase()
      .from('team_requests')
      .insert({
        parent_protocol_id: protocol.id,
        leader_id: input.leaderId,
        role_desc: tr.roleDesc,
        required_skills: tr.requiredSkills,
        reward: tr.reward,
      })
      .select()
      .single()

    if (req) requestIds.push(req.id)
  }

  await appendEvidence({
    protocolId: protocol.id,
    eventType: 'team_protocol_created',
    payload: {
      leader_id: input.leaderId,
      total_budget: input.totalBudget,
      team_size: input.teamRequests.length,
    },
  })

  await updateCredit({
    userId: input.leaderId,
    eventType: 'completion',
    evidenceId: protocol.id,
    description: `Team protocol created: ${input.teamRequests.length} slots`,
  })

  return { success: true, protocolId: protocol.id, requestIds }
}

export async function addTeamRequest(input: TeamRequestInput): Promise<TeamRequestResult> {
  const { data: req } = await getSupabase()
    .from('team_requests')
    .insert({
      parent_protocol_id: input.parentProtocolId,
      leader_id: input.leaderId,
      role_desc: input.roleDesc,
      required_skills: input.requiredSkills,
      reward: input.reward,
    })
    .select()
    .single()

  if (!req) return { success: false }

  return { success: true, requestId: req.id }
}

export async function expressTeamInterest(
  requestId: string,
  providerId: string,
): Promise<{ success: boolean }> {
  const { data: req } = await getSupabase()
    .from('team_requests')
    .select('id, status')
    .eq('id', requestId)
    .single()

  if (!req || req.status !== 'open') return { success: false }

  await appendEvidence({
    protocolId: requestId,
    eventType: 'team_interest',
    payload: { request_id: requestId, provider_id: providerId },
    teamMemberId: providerId,
  })

  return { success: true }
}

export async function fillTeamSlot(
  requestId: string,
  providerId: string,
): Promise<{ success: boolean }> {
  const { data: req } = await getSupabase()
    .from('team_requests')
    .select('id, status, parent_protocol_id, leader_id, reward')
    .eq('id', requestId)
    .single()

  if (!req || req.status !== 'open') return { success: false }

  const { error } = await getSupabase()
    .from('team_requests')
    .update({ status: 'filled', member_id: providerId })
    .eq('id', requestId)

  if (error) return { success: false }

  await appendEvidence({
    protocolId: req.parent_protocol_id,
    eventType: 'team_slot_filled',
    payload: {
      request_id: requestId,
      provider_id: providerId,
      reward: req.reward,
    },
    teamMemberId: providerId,
  })

  await updateCredit({
    userId: providerId,
    category: 'teamwork',
    eventType: 'completion',
    evidenceId: requestId,
    description: `Team slot filled for protocol ${req.parent_protocol_id}`,
  })

  return { success: true }
}

export async function getTeamInfo(protocolId: string): Promise<TeamInfo> {
  const { data: protocol } = await getSupabase()
    .from('protocols')
    .select('provider_id')
    .eq('id', protocolId)
    .single()

  if (!protocol) {
    return { leader: { id: '', nickname: null }, members: [], openRequests: [] }
  }

  const leaderId = protocol.provider_id

  const { data: leaderUser } = await getSupabase()
    .from('users')
    .select('id, nickname')
    .eq('id', leaderId)
    .single()

  const { data: allRequests } = await getSupabase()
    .from('team_requests')
    .select('*')
    .eq('parent_protocol_id', protocolId)

  const members = (allRequests ?? [])
    .filter((r: Record<string, unknown>) => r.status === 'filled')
    .map((r: Record<string, unknown>) => ({
      requestId: r.id as string,
      providerId: r.member_id as string,
      roleDesc: r.role_desc as string,
      reward: r.reward as number,
      skills: r.required_skills as string[],
    }))

  const openRequests = (allRequests ?? [])
    .filter((r: Record<string, unknown>) => r.status === 'open')
    .map((r: Record<string, unknown>) => ({
      id: r.id as string,
      roleDesc: r.role_desc as string,
      requiredSkills: r.required_skills as string[],
      reward: r.reward as number,
    }))

  return {
    leader: {
      id: leaderId,
      nickname: (leaderUser?.nickname as string) ?? null,
    },
    members,
    openRequests,
  }
}
