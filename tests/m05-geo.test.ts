import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { __setSupabaseClient, __resetSupabaseClient } from '../src/lib/supabase-client'

describe('M05 Geo Index', () => {
  let mockRpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockRpc = vi.fn()
    __setSupabaseClient({ rpc: mockRpc } as any)
  })

  afterEach(() => {
    __resetSupabaseClient()
  })

  it('should return empty array when no results', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null })

    const { matchNearby } = await import('../src/modules/m05-geo-index/geo-service')

    const result = await matchNearby({
      lat: 0,
      lng: 0,
      radiusKm: 10,
      category: '家政',
    })

    expect(result).toEqual([])
  })

  it('should filter by required skills', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { user_id: 'p1', skills: ['cleaning', 'repair'], is_online: true, distance_m: 100 },
        { user_id: 'p2', skills: ['cleaning'], is_online: true, distance_m: 200 },
        { user_id: 'p3', skills: ['repair'], is_online: true, distance_m: 300 },
      ],
      error: null,
    })

    const { matchNearby } = await import('../src/modules/m05-geo-index/geo-service')

    const result = await matchNearby({
      lat: 34,
      lng: -118,
      radiusKm: 5,
      category: '家政',
      requiredSkills: ['cleaning'],
    })

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.provider_id).sort()).toEqual(['p1', 'p2'])
  })

  it('should return results sorted by distance', async () => {
    mockRpc.mockResolvedValue({
      data: [
        { user_id: 'p2', skills: [], is_online: true, distance_m: 100 },
        { user_id: 'p1', skills: [], is_online: true, distance_m: 200 },
        { user_id: 'p3', skills: [], is_online: true, distance_m: 300 },
      ],
      error: null,
    })

    const { matchNearby } = await import('../src/modules/m05-geo-index/geo-service')

    const result = await matchNearby({
      lat: 34,
      lng: -118,
      radiusKm: 10,
      category: '家政',
    })

    expect(result).toHaveLength(3)
    expect(result[0].provider_id).toBe('p2')
    expect(result[1].provider_id).toBe('p1')
    expect(result[2].provider_id).toBe('p3')
    expect(result[0].distance_m).toBeLessThan(result[1].distance_m)
    expect(result[1].distance_m).toBeLessThan(result[2].distance_m)
  })
})
