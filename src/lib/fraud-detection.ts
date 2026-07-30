export interface FraudCheckReport {
  circularPartners: Array<{ partnerId: string; depth: number }>
  riskLevel: 'none' | 'low' | 'medium' | 'high'
  flagged: boolean
}

export async function checkFraudRisk(userId: string): Promise<FraudCheckReport> {
  const { getServiceClient } = await import('@/lib/supabase-client')
  const supabase = getServiceClient()

  const { data: circular } = await supabase.rpc('detect_circular_transactions', {
    target_user_id: userId,
  })

  const partners: Array<{ partnerId: string; depth: number }> = (circular ?? []) as Array<{ partnerId: string; depth: number }>

  const maxDepth = partners.length > 0 ? Math.max(...partners.map((p: { depth: number }) => p.depth)) : 0

  let riskLevel: 'none' | 'low' | 'medium' | 'high' = 'none'
  if (maxDepth >= 4) riskLevel = 'high'
  else if (maxDepth >= 3) riskLevel = 'medium'
  else if (maxDepth >= 2) riskLevel = 'low'

  return {
    circularPartners: partners,
    riskLevel,
    flagged: riskLevel !== 'none',
  }
}
