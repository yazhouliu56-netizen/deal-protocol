const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["MATCHED", "CANCELLED"],
  MATCHED: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: [],
  CANCELLED: [],
}

export function validateDemandTransition(from: string, to: string): string | null {
  const allowed = VALID_TRANSITIONS[from]
  if (!allowed) return `未知状态: ${from}`
  if (!allowed.includes(to)) return `不允许从 ${from} 转换到 ${to}`
  return null
}
