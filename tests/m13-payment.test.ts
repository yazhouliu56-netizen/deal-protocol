// M13 测试：退款规则
import { describe, it, expect } from 'vitest'

describe('M13 Payment - Refund Rules', () => {
  // 退款三路径逻辑：直接测试纯函数
  function calculateRefund(amount: number, phase: number): { customerRefund: number; providerGets: number } {
    let providerGets = 0
    let customerRefund = 0

    switch (phase) {
      case 0:
      case 1:
        providerGets = 0
        customerRefund = amount
        break
      case 2:
        providerGets = Math.min(30, amount * 0.15)
        customerRefund = amount - providerGets
        break
      case 3:
        providerGets = Math.min(50, amount * 0.25)
        customerRefund = amount - providerGets
        break
      case 4:
        providerGets = Math.round(amount * 0.4)
        customerRefund = amount - providerGets
        break
      default:
        customerRefund = 0
        providerGets = amount
    }

    return { customerRefund, providerGets }
  }

  it('should refund full amount if cancelled before departure (phase 0-1)', () => {
    const result = calculateRefund(200, 0)
    expect(result.customerRefund).toBe(200)
    expect(result.providerGets).toBe(0)
  })

  it('should deduct travel fee if cancelled after departure (phase 2)', () => {
    const result = calculateRefund(200, 2)
    expect(result.providerGets).toBeLessThanOrEqual(30)
    expect(result.customerRefund + result.providerGets).toBe(200)
  })

  it('should deduct inspection fee if arrived on site (phase 3)', () => {
    const result = calculateRefund(200, 3)
    expect(result.providerGets).toBeLessThanOrEqual(50)
    expect(result.customerRefund + result.providerGets).toBe(200)
  })

  it('should give 40% to provider if cancelled mid-service (phase 4)', () => {
    const result = calculateRefund(200, 4)
    expect(result.providerGets).toBe(80)
    expect(result.customerRefund).toBe(120)
  })
})
