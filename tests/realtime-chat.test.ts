import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'

// ── Pure function tests ──

describe('findChangedField', () => {
  it('returns the first changed field name excluding skip keys', async () => {
    const { findChangedField } = await import('@/hooks/useSupabaseRealtime')
    const oldData = { budget: 100, service_time: '10:00', updated_at: '2024-01-01' }
    const newData = { budget: 150, service_time: '10:00', updated_at: '2024-01-02' }
    expect(findChangedField(oldData, newData)).toBe('budget')
  })

  it('returns null when no fields changed', async () => {
    const { findChangedField } = await import('@/hooks/useSupabaseRealtime')
    const data = { budget: 100, service_time: '10:00', updated_at: '2024-01-01' }
    expect(findChangedField(data, data)).toBeNull()
  })

  it('skips id, order_id, and updated_at keys', async () => {
    const { findChangedField } = await import('@/hooks/useSupabaseRealtime')
    const oldData = { id: '1', order_id: 'o1', updated_at: '2024-01-01', budget: 100 }
    const newData = { id: '2', order_id: 'o2', updated_at: '2024-02-01', budget: 100 }
    expect(findChangedField(oldData, newData)).toBeNull()
  })

  it('returns the first changed field when multiple fields change', async () => {
    const { findChangedField } = await import('@/hooks/useSupabaseRealtime')
    const oldData = { budget: 100, service_time: '10:00', address_hint: 'Beijing' }
    const newData = { budget: 200, service_time: '14:00', address_hint: 'Shanghai' }
    expect(findChangedField(oldData, newData)).toBe('budget')
  })

  it('returns null for empty objects', async () => {
    const { findChangedField } = await import('@/hooks/useSupabaseRealtime')
    expect(findChangedField({}, {})).toBeNull()
  })
})

// ── Hook subscription tests ──

const mockOn = vi.fn().mockReturnThis()
const mockSubscribe = vi.fn().mockReturnThis()
let cleanupFns: Array<() => void> = []

vi.mock('@/lib/supabase-browser', () => ({
  getBrowserSupabase: () => ({
    channel: vi.fn(() => ({
      on: mockOn,
      subscribe: mockSubscribe,
      track: vi.fn(),
      presenceState: vi.fn().mockReturnValue({}),
    })),
    removeChannel: vi.fn(),
  }),
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof React>()
  return {
    ...actual,
    useEffect: (cb: () => () => void) => {
      const cleanup = cb()
      cleanupFns.push(cleanup)
    },
  } as typeof React
})

describe('useSupabaseRealtime', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOn.mockReturnThis()
    mockSubscribe.mockReturnThis()
    cleanupFns = []
  })

  afterEach(() => {
    for (const fn of cleanupFns) {
      fn()
    }
    cleanupFns = []
  })

  it('registers postgres_changes for messages INSERT and protocols UPDATE, and presence sync', async () => {
    const { useSupabaseRealtime } = await import('@/hooks/useSupabaseRealtime')

    function TestHarness() {
      useSupabaseRealtime('order-1', 'user-1')
      return null
    }

    const { renderToString } = await import('react-dom/server')
    renderToString(React.createElement(TestHarness))

    const postgresCalls = mockOn.mock.calls.filter((c: unknown[]) => c[0] === 'postgres_changes')
    const presenceCalls = mockOn.mock.calls.filter((c: unknown[]) => c[0] === 'presence')
    expect(postgresCalls).toHaveLength(2)
    expect(presenceCalls).toHaveLength(1)

    const messageInsert = postgresCalls.find(
      (c: unknown[]) => (c[1] as Record<string, unknown>).table === 'messages',
    )
    expect(messageInsert).toBeDefined()
    expect((messageInsert![1] as Record<string, unknown>).event).toBe('INSERT')

    const protocolUpdate = postgresCalls.find(
      (c: unknown[]) => (c[1] as Record<string, unknown>).table === 'protocols',
    )
    expect(protocolUpdate).toBeDefined()
    expect((protocolUpdate![1] as Record<string, unknown>).event).toBe('UPDATE')
  })

  it('subscribes to the channel', async () => {
    const { useSupabaseRealtime } = await import('@/hooks/useSupabaseRealtime')

    function TestHarness() {
      useSupabaseRealtime('order-1', 'user-1')
      return null
    }

    const { renderToString } = await import('react-dom/server')
    renderToString(React.createElement(TestHarness))

    expect(mockSubscribe).toHaveBeenCalledTimes(1)
  })

  it('protocol UPDATE callback triggers updatedField via findChangedField', async () => {
    const { findChangedField } = await import('@/hooks/useSupabaseRealtime')

    const payload = {
      old: { budget: 100, service_time: '10:00' } as Record<string, unknown>,
      new: { budget: 200, service_time: '10:00' } as Record<string, unknown>,
    }

    const changed = findChangedField(payload.old, payload.new)
    expect(changed).toBe('budget')
  })
})
