export interface RiskCheckResult {
  hasRisk: boolean
  riskType?: 'OFF_PLATFORM_PAYMENT' | 'SENSITIVE_CONTACT' | 'WECHAT_TRANSFER'
  warningMessage?: string
  sanitizedText?: string
}

const OFF_PLATFORM_PATTERNS = [
  /私下/i, /走线下/i, /不走平台/i, /线下转/i, /私转/i,
  /微信转/i, /支付宝转/i, /加微/i, /加v\b/i, /加vx/i, /微信号/i,
  /转微信/i, /转支付宝/i, /线下交易/i, /平台外/i, /绕开平台/i,
]

const PHONE_PATTERN = /1[3-9]\d{9}/

export function interceptChatRisk(text: string): RiskCheckResult {
  const hasOffPlatformRisk = OFF_PLATFORM_PATTERNS.some(pattern => pattern.test(text))
  const hasPhoneRisk = PHONE_PATTERN.test(text)

  if (hasOffPlatformRisk || hasPhoneRisk) {
    let riskType: RiskCheckResult['riskType'] = 'OFF_PLATFORM_PAYMENT'
    if (hasPhoneRisk && !hasOffPlatformRisk) {
      riskType = 'SENSITIVE_CONTACT'
    }

    return {
      hasRisk: true,
      riskType,
      warningMessage: '⚠️ 平台安全警告：检测到包含私下交易或联系方式诱导！私下交易将失去 Deal Protocol 官方资金托管、1% 保险池赔付与仲裁保障。',
      sanitizedText: text.replace(PHONE_PATTERN, '[手机号已屏蔽]'),
    }
  }

  return { hasRisk: false }
}
