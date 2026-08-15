/**
 * L4-M3 Web NFC 碰碰 / 动态码核销适配层测试：
 * 环境检测 / 载荷生成与 HMAC 验签 / 时间戳防重放 / 越权 waveId 拒绝 /
 * 动态码降级通道（过期 + nonce）/ 验签幂等 / 全链路不抛未捕获异常（红线 5）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REPLAY_WINDOW_MS,
  createNfcVerificationPayload,
  generateDynamicVerificationQr,
  isWebNfcSupported,
  verifyBumpPayload,
  verifyBumpPayloadWithSecret,
} from "./nfc-adapter.ts";

const TOKEN = "token-1";
const WAVE = "wave-1001";

test("环境检测：Node/jsdom 无 NDEFReader → 不支持（走动态码降级）", () => {
  assert.equal(isWebNfcSupported(), false);
});

test("载荷生成：结构 5 段（v1:waveId:ts:exp:sig），同输入不同时刻载荷不同", () => {
  const p1 = createNfcVerificationPayload(WAVE, TOKEN);
  const p2 = createNfcVerificationPayload(WAVE, TOKEN);
  assert.equal(p1.split(":").length, 5);
  assert.equal(p1.split(":")[0], "v1");
  assert.equal(p1.split(":")[1], WAVE);
  assert.notEqual(p1, p2);
});

test("正式验签：真实密钥 + 新鲜时间戳 → isValid=true 且透传碰碰时刻", () => {
  const payload = createNfcVerificationPayload(WAVE, TOKEN);
  const now = Number(payload.split(":")[2]) + 1000;
  const r = verifyBumpPayloadWithSecret(payload, WAVE, TOKEN, now);
  assert.equal(r.isValid, true);
  assert.equal(r.timestamp, Number(payload.split(":")[2]));
});

test("验签幂等：同一载荷重复验签结果一致（防抖动判定）", () => {
  const payload = createNfcVerificationPayload(WAVE, TOKEN);
  const now = Number(payload.split(":")[2]) + 1000;
  const r1 = verifyBumpPayloadWithSecret(payload, WAVE, TOKEN, now);
  const r2 = verifyBumpPayloadWithSecret(payload, WAVE, TOKEN, now);
  assert.deepEqual(r1, r2);
  assert.equal(r1.isValid, true);
});

test("防重放：签名被篡改（改一个字符）→ 拒绝", () => {
  const payload = createNfcVerificationPayload(WAVE, TOKEN);
  const tampered = payload.slice(0, -1) + (payload.endsWith("a") ? "b" : "a");
  const r = verifyBumpPayloadWithSecret(tampered, WAVE, TOKEN);
  assert.equal(r.isValid, false);
});

test("防重放：过期载荷（exp 已过）→ 拒绝", () => {
  const payload = createNfcVerificationPayload(WAVE, TOKEN);
  const ts = Number(payload.split(":")[2]);
  const afterExpiry = ts + 10 * 60_000;
  const r = verifyBumpPayloadWithSecret(payload, WAVE, TOKEN, afterExpiry);
  assert.equal(r.isValid, false);
});

test("防重放：时间戳越窗（±5 分钟外）→ 拒绝（离线重放攻击）", () => {
  const payload = createNfcVerificationPayload(WAVE, TOKEN);
  const ts = Number(payload.split(":")[2]);
  const replayed = verifyBumpPayloadWithSecret(payload, WAVE, TOKEN, ts - REPLAY_WINDOW_MS - 1000);
  assert.equal(replayed.isValid, false);
  assert.equal(REPLAY_WINDOW_MS, 5 * 60_000);
});

test("越权拒绝：waveId 不匹配 → 验签与弱校验均拒绝", () => {
  const payload = createNfcVerificationPayload(WAVE, TOKEN);
  assert.equal(verifyBumpPayloadWithSecret(payload, "wave-other", TOKEN).isValid, false);
  assert.equal(verifyBumpPayload(payload, "wave-other").isValid, false);
});

test("弱校验（无密钥）：结构合法 + 未过期 + 时间窗内 → 通过（供展示层）", () => {
  const payload = createNfcVerificationPayload(WAVE, TOKEN);
  const ts = Number(payload.split(":")[2]);
  assert.equal(verifyBumpPayload(payload, WAVE, ts + 1000).isValid, true);
});

test("弱校验：垃圾输入 / 结构错 → 拒绝且不抛异常", () => {
  assert.equal(verifyBumpPayload("", WAVE).isValid, false);
  assert.equal(verifyBumpPayload("garbage", WAVE).isValid, false);
  assert.equal(verifyBumpPayload("v1:wave-1001:abc:def:sig", WAVE).isValid, false);
  assert.equal(verifyBumpPayloadWithSecret(null as unknown as string, WAVE, TOKEN).isValid, false);
});

test("动态码降级通道：返回 qrData + 过期时刻 + nonce，qrData 可被正式验签", () => {
  const qr = generateDynamicVerificationQr(WAVE, TOKEN);
  assert.equal(qr.waveId, WAVE);
  assert.ok(qr.expiresAt > Date.now());
  assert.ok(qr.nonce.length > 0);
  const now = Number(qr.qrData.split(":")[2]) + 1000;
  const r = verifyBumpPayloadWithSecret(qr.qrData, WAVE, TOKEN, now);
  assert.equal(r.isValid, true);
});

test("动态码降级通道：自定义有效期（短码 30s）", () => {
  const qr = generateDynamicVerificationQr(WAVE, TOKEN, 30_000);
  assert.equal(qr.expiresAt - Date.now() <= 30_000, true);
});

test("全链路健壮性：任意垃圾载荷验签永不抛异常（红线 5）", () => {
  const junk = [null, undefined, 42, {}, ":::", "a:b:c:d", "v1:x:NaN:5:zzz"];
  for (const j of junk) {
    assert.doesNotThrow(() => verifyBumpPayload(String(j), WAVE));
    assert.doesNotThrow(() => verifyBumpPayloadWithSecret(String(j), WAVE, TOKEN));
  }
});
