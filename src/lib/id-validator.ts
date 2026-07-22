const WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
const CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']

export interface ValidationDetail {
  valid: boolean
  reason?: string
  parsed?: {
    dob: string
    gender: 'male' | 'female'
  }
}

export function validateChineseId(id: string): ValidationDetail {
  const cleaned = id.trim().toUpperCase()

  if (!/^\d{17}[\dX]$/.test(cleaned)) {
    return { valid: false, reason: 'Invalid format: must be 18 digits (last may be X)' }
  }

  const dob = cleaned.slice(6, 14)
  const year = parseInt(dob.slice(0, 4), 10)
  const month = parseInt(dob.slice(4, 6), 10)
  const day = parseInt(dob.slice(6, 8), 10)

  if (year < 1900 || year > new Date().getFullYear()) {
    return { valid: false, reason: 'Invalid date of birth year' }
  }
  if (month < 1 || month > 12) {
    return { valid: false, reason: 'Invalid date of birth month' }
  }
  if (day < 1 || day > 31) {
    return { valid: false, reason: 'Invalid date of birth day' }
  }

  let sum = 0
  for (let i = 0; i < 17; i++) {
    sum += parseInt(cleaned[i], 10) * WEIGHTS[i]
  }

  const expectedCheck = CHECK_CODES[sum % 11]
  if (cleaned[17] !== expectedCheck) {
    return { valid: false, reason: `Check digit mismatch: expected ${expectedCheck}, got ${cleaned[17]}` }
  }

  const genderCode = parseInt(cleaned[16], 10)

  return {
    valid: true,
    parsed: {
      dob: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      gender: genderCode % 2 === 1 ? 'male' : 'female',
    },
  }
}
