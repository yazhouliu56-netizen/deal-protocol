const ALGORITHM = 'aes-256-gcm'
const ENCODING = 'base64'

function getKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY
  if (!key) {
    throw new Error('PII_ENCRYPTION_KEY environment variable is not set')
  }
  return Buffer.from(key, 'hex')
}

export function encryptPII(plaintext: string): string {
  const crypto = require('crypto')
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', ENCODING)
  encrypted += cipher.final(ENCODING)
  const authTag = cipher.getAuthTag().toString(ENCODING)
  return iv.toString(ENCODING) + ':' + encrypted + ':' + authTag
}

export function decryptPII(ciphertext: string): string {
  const crypto = require('crypto')
  const key = getKey()
  const parts = ciphertext.split(':')
  const iv = Buffer.from(parts[0], ENCODING)
  const encrypted = parts[1]
  const authTag = Buffer.from(parts[2], ENCODING)
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  let decrypted = decipher.update(encrypted, ENCODING, 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

export function maskPII(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return value
  const visible = value.slice(-visibleChars)
  const masked = '*'.repeat(value.length - visibleChars)
  return masked + visible
}
