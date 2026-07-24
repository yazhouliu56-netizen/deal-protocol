export interface TieredCommissionResult {
  rate: number
  commissionFee: number
  providerPayout: number
  tier: '<500' | '500-5000' | '5000-50000' | '>50000'
}

export function calculateTieredCommission(amount: number): TieredCommissionResult {
  let rate = 0.15
  let tier: TieredCommissionResult['tier'] = '<500'

  if (amount > 50000) {
    rate = 0.08
    tier = '>50000'
  } else if (amount > 5000) {
    rate = 0.10
    tier = '5000-50000'
  } else if (amount > 500) {
    rate = 0.12
    tier = '500-5000'
  }

  const commissionFee = Number((amount * rate).toFixed(2))
  const providerPayout = Number((amount - commissionFee).toFixed(2))

  return { rate, commissionFee, providerPayout, tier }
}
