/**
 * PII 密态加解密（批次 3b 自 src/lib/pii-encrypt.ts 平移，条文 #8 隐私血液）：
 * AES-256-GCM 认证加密 + 掩码工具。
 *
 * SERVER-ONLY：依赖 node:crypto 与进程环境变量 PII_ENCRYPTION_KEY（hex 32 字节），
 * 严禁进入客户端 bundle 或 base 纯函数考卷之外的浏览器路径。
 */

import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-256-gcm";
const ENCODING = "base64";

function getKey(): Buffer {
  const key = process.env.PII_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("PII_ENCRYPTION_KEY environment variable is not set");
  }
  return Buffer.from(key, "hex");
}

export function encryptPII(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", ENCODING);
  encrypted += cipher.final(ENCODING);
  const authTag = cipher.getAuthTag().toString(ENCODING);
  return iv.toString(ENCODING) + ":" + encrypted + ":" + authTag;
}

export function decryptPII(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed ciphertext envelope");
  }
  const iv = Buffer.from(parts[0], ENCODING);
  const encrypted = parts[1];
  const authTag = Buffer.from(parts[2], ENCODING);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, ENCODING, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function maskPII(value: string, visibleChars: number = 4): string {
  if (value.length <= visibleChars) return value;
  const visible = value.slice(-visibleChars);
  const masked = "*".repeat(value.length - visibleChars);
  return masked + visible;
}
