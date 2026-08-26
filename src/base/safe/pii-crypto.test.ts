/**
 * 批次 3b · PII 密态加解密考卷（server-only 原语）：
 * AES-256-GCM 往返 / 随机 IV 语义 / 畸形信封拒绝 / 掩码工具 / 环境密钥缺失防御。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { configurePiiEncryptionKey, decryptPII, encryptPII, maskPII } from "./pii-crypto.ts";

const TEST_KEY_HEX = "a".repeat(64);
configurePiiEncryptionKey(TEST_KEY_HEX);

test("加解密往返：任意 UTF-8 明文经 encrypt→decrypt 恢复原值", () => {
  for (const plain of ["110101199001011234", "中文身份证号测试", ""]) {
    assert.equal(decryptPII(encryptPII(plain)), plain);
  }
});

test("随机 IV 语义：同一明文两次加密产生不同密文（且均可解回）", () => {
  const key = process.env.PII_ENCRYPTION_KEY;
  process.env.PII_ENCRYPTION_KEY = "b".repeat(64);
  try {
    const c1 = encryptPII("secret-id");
    const c2 = encryptPII("secret-id");
    assert.notEqual(c1, c2);
    assert.equal(decryptPII(c1), "secret-id");
    assert.equal(decryptPII(c2), "secret-id");
  } finally {
    if (key === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = key;
  }
});

test("畸形信封拒绝：缺少 IV/authTag 段的密文抛错而非静默返回", () => {
  const key = process.env.PII_ENCRYPTION_KEY;
  process.env.PII_ENCRYPTION_KEY = "c".repeat(64);
  try {
    assert.throws(() => decryptPII("not-a-valid-envelope"), /Malformed/);
  } finally {
    if (key === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = key;
  }
});

test("密钥缺失防御：组合根未注入时加密显式抛错", () => {
  const saved = process.env.PII_ENCRYPTION_KEY;
  delete process.env.PII_ENCRYPTION_KEY;
  try {
    assert.throws(() => {
  configurePiiEncryptionKey("");
  encryptPII("x");
}, /not configured: call configurePiiEncryptionKey/);
configurePiiEncryptionKey(TEST_KEY_HEX);
  } finally {
    if (saved === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = saved;
  }
});

test("GCM 认证防伪：密文任一字符被篡改后解密必须失败（认证标签校验）", () => {
  const key = process.env.PII_ENCRYPTION_KEY;
  process.env.PII_ENCRYPTION_KEY = "d".repeat(64);
  try {
    const cipher = encryptPII("tamper-detection");
    const parts = cipher.split(":");
    const flippedChar = parts[1][0] === "A" ? "B" : "A";
    const tampered = [parts[0], flippedChar + parts[1].slice(1), parts[2]].join(":");
    assert.notEqual(tampered, cipher);
    assert.throws(() => decryptPII(tampered));
  } finally {
    if (key === undefined) delete process.env.PII_ENCRYPTION_KEY;
    else process.env.PII_ENCRYPTION_KEY = key;
  }
});

test("掩码工具：默认保留尾4位；自定义可见位；短值原样返回", () => {
  assert.equal(maskPII("110101199001011234"), "*".repeat(14) + "1234");
  assert.equal(maskPII("13800138000", 5), "******38000");
  assert.equal(maskPII("1234"), "1234");
});
