import { getSupabase } from '@/lib/supabase-client'

interface NearbyProvider {
  provider_id: string
  distance_m: number
  skills: string[]
  is_online: boolean
}

interface MatchNearbyInput {
  lat: number
  lng: number
  radiusKm: number
  category: string
  requiredSkills?: string[]
  limit?: number
}

export async function matchNearby(input: MatchNearbyInput): Promise<NearbyProvider[]> {
  const { lat, lng, radiusKm, category, requiredSkills, limit = 200 } = input
  const radiusM = radiusKm * 1000

  const { data, error } = await getSupabase().rpc('match_providers_nearby', {
    ref_lng: lng,
    ref_lat: lat,
    radius_m: radiusM,
    target_category: category,
    max_results: limit,
  })

  if (error) {
    console.error('[M05] Query error:', error)
    return []
  }

  const raw = (data ?? []) as Array<{
    user_id: string
    skills: string[]
    is_online: boolean
    distance_m: number
  }>

  if (requiredSkills && requiredSkills.length > 0) {
    return raw
      .filter((row) => requiredSkills.every((s) => row.skills?.includes(s)))
      .map((row) => ({
        provider_id: row.user_id,
        distance_m: Math.round(row.distance_m),
        skills: row.skills ?? [],
        is_online: row.is_online,
      }))
  }

  return raw.map((row) => ({
    provider_id: row.user_id,
    distance_m: Math.round(row.distance_m),
    skills: row.skills ?? [],
    is_online: row.is_online,
  }))
}
