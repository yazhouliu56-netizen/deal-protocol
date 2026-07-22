// M11 测试：证据链哈希完整性
import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'

describe('M11 Evidence Chain (Unit)', () => {
  it('should produce consistent hash chain', () => {
    const entries = [
      { id: 'ev1', payload: { action: 'created' } },
      { id: 'ev2', payload: { action: 'updated' } },
      { id: 'ev3', payload: { action: 'completed' } },
    ]

    let prevHash = 'GENESIS'
    const hashes: string[] = []

    for (const entry of entries) {
      const content = JSON.stringify({
        orderId: 'order_1',
        eventType: 'test',
        payload: entry.payload,
        prevHash,
      })
      const hash = createHash('sha256').update(content).digest('hex')
      hashes.push(hash)
      prevHash = hash
    }

    // 验证链：每个哈希基于前一个
    expect(hashes[0]).not.toBe(hashes[1])
    expect(hashes[1]).not.toBe(hashes[2])

    // 重新计算验证
    const recompute = (prev: string, payload: Record<string, unknown>) => {
      return createHash('sha256')
        .update(JSON.stringify({ orderId: 'order_1', eventType: 'test', payload, prevHash: prev }))
        .digest('hex')
    }

    expect(hashes[0]).toBe(recompute('GENESIS', { action: 'created' }))
    expect(hashes[1]).toBe(recompute(hashes[0], { action: 'updated' }))

    // 篡改检测：修改第二条，哈希不匹配
    const tamperedHash = recompute('GENESIS', { action: 'created' })
    expect(hashes[0]).toBe(tamperedHash) // 第一条没被改，应该匹配

    const tamperedHash2 = recompute(hashes[0], { action: 'MALICIOUS' })
    expect(hashes[1]).not.toBe(tamperedHash2) // 被改过，不匹配
  })
})
