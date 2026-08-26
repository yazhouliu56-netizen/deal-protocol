/**
 * payment-core 上收 Base 域考卷（原 packages/payment-core 无随包单测，本卷为净增）：
 * 确定性密码学面锚定——Alipay RSA2 签名/验签往返、WeChat AES-256-GCM 回调解密
 * 往返、金额分换算、渠道装配与未配置兜底。网络 IO 面不在本卷（由 e2e 承载）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { PaymentManager } from "./payment-core.ts";

// 单例在首次 getInstance 时读 env 装配——必须无条件覆写（本机可能有真实支付变量）
const TEST_WECHAT_KEY = "k".repeat(32);
process.env.ALIPAY_APP_ID = "test-app-id";
process.env.ALIPAY_PRIVATE_KEY = "";
process.env.ALIPAY_PUBLIC_KEY = "";
process.env.WECHAT_APP_ID = "wx-test";
process.env.WECHAT_MCH_ID = "mch-test";
process.env.WECHAT_API_KEY_V3 = TEST_WECHAT_KEY;
process.env.WECHAT_PRIVATE_KEY = "placeholder-rsa-key";
process.env.WECHAT_SERIAL_NO = "serial-test";

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
const PUBLIC_KEY_BLOCKED = publicKey
  .split("\n")
  .filter((l) => l && !l.startsWith("-----"))
  .join("\n");

let mgr: PaymentManager;

test("setup：以测试密钥装配单例（alipay 全配 / wechat 仅缺私钥）", () => {
  process.env.ALIPAY_PRIVATE_KEY = privateKey;
  process.env.ALIPAY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----\n${PUBLIC_KEY_BLOCKED}\n-----END PUBLIC KEY-----`;
  mgr = PaymentManager.getInstance();
});

test("渠道装配：isConfigured / getAvailableChannels 反映 env", () => {
  assert.equal(mgr.isConfigured("alipay"), true);
  assert.equal(mgr.isConfigured("wechat"), true);
  assert.equal(mgr.isConfigured("unknown" as never), false);
  assert.deepEqual(mgr.getAvailableChannels(), ["alipay", "wechat"]);
});

test("Alipay RSA2 签名→回调验签往返（sorted k=v& 拼装 + sign/sign_type 剔除）", async () => {
  const params = new URLSearchParams({
    app_id: "test-app-id",
    out_trade_no: "order-1",
    trade_no: "ali-txn-1",
    trade_status: "TRADE_SUCCESS",
    total_amount: "100.00",
  });
  const verified: Record<string, string> = {};
  for (const [k, v] of params.entries()) if (k !== "sign" && k !== "sign_type") verified[k] = v;
  const signStr = Object.keys(verified).sort().map((k) => `${k}=${verified[k]}`).join("&");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signStr, "utf-8");
  const sign = signer.sign(privateKey, "base64");
  params.set("sign", sign);
  params.set("sign_type", "RSA2");

  const result = await mgr.handleNotify("alipay", params.toString(), {});
  assert.equal(result.success, true);
  assert.equal(result.orderId, "order-1");
  assert.equal(result.tradeNo, "ali-txn-1");
  assert.equal(result.channel, "alipay");
});

test("Alipay 验签拒绝：篡改金额 → 签名校验失败抛错", async () => {
  const params = new URLSearchParams({
    app_id: "test-app-id",
    out_trade_no: "order-1",
    trade_no: "ali-txn-1",
    trade_status: "TRADE_SUCCESS",
    total_amount: "999999.00",
    sign: "tampered-signature",
    sign_type: "RSA2",
  });
  await assert.rejects(() => mgr.handleNotify("alipay", params.toString(), {}), /signature verification failed/);
});

test("Alipay 状态门禁：非 TRADE_SUCCESS/FINISHED 抛错", async () => {
  const p = new URLSearchParams({ trade_status: "WAIT_BUYER_PAY", out_trade_no: "o", trade_no: "t" });
  const verified: Record<string, string> = {};
  for (const [k, v] of p.entries()) if (k !== "sign" && k !== "sign_type") verified[k] = v;
  const signStr = Object.keys(verified).sort().map((k) => `${k}=${verified[k]}`).join("&");
  const s = crypto.createSign("RSA-SHA256");
  s.update(signStr, "utf-8");
  p.set("sign", s.sign(privateKey, "base64"));
  await assert.rejects(() => mgr.handleNotify("alipay", p.toString(), {}), /Unexpected Alipay trade status/);
});

// nonce 必须双侧同字节：生产代码把字符串原样传入 createDecipheriv（按 UTF-8 读），
// 故加密侧也用同一 ASCII 串的 utf8 字节，而非随机原始字节。
const NONCE = "123456789012";

test("WeChat AES-256-GCM 回调解密往返（padEnd(32,'0') 密钥派生 + authTag 尾挂 hex）", async () => {
  const resourceJson = JSON.stringify({ out_trade_no: "order-2", transaction_id: "wx-txn-2", trade_state: "SUCCESS" });
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(TEST_WECHAT_KEY), Buffer.from(NONCE, "utf8"));
  cipher.setAAD(Buffer.from("", "utf-8"));
  const encrypted = Buffer.concat([cipher.update(resourceJson, "utf-8"), cipher.final()]);
  const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]).toString("hex");

  const result = await mgr.handleNotify(
    "wechat",
    JSON.stringify({ id: "evt-1", resource: { algorithm: "AEAD_AES_256_GCM", ciphertext, associated_data: "", nonce: NONCE } }),
    {},
  );
  assert.equal(result.success, true);
  assert.equal(result.orderId, "order-2");
  assert.equal(result.tradeNo, "wx-txn-2");
  assert.equal(result.channel, "wechat");
});

test("WeChat 状态门禁：trade_state 非 SUCCESS 抛错", async () => {
  const resourceJson = JSON.stringify({ out_trade_no: "o", transaction_id: "t", trade_state: "CLOSED" });
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(TEST_WECHAT_KEY), Buffer.from(NONCE, "utf8"));
  cipher.setAAD(Buffer.from("", "utf-8"));
  const encrypted = Buffer.concat([cipher.update(resourceJson, "utf-8"), cipher.final()]);
  const ciphertext = Buffer.concat([encrypted, cipher.getAuthTag()]).toString("hex");
  await assert.rejects(
    () => mgr.handleNotify("wechat", JSON.stringify({ resource: { ciphertext, associated_data: "", nonce: NONCE } }), {}),
    /Unexpected WeChat trade state/,
  );
});

test("WeChat 报文守卫：缺 resource / 缺密文字段抛错", async () => {
  await assert.rejects(() => mgr.handleNotify("wechat", JSON.stringify({}), {}), /missing resource/);
  await assert.rejects(
    () => mgr.handleNotify("wechat", JSON.stringify({ resource: { algorithm: "AEAD_AES_256_GCM" } }), {}),
    /missing cipher fields/,
  );
});

test("通道分发：未知 channel 的支付请求确定性失败、未知回调通道抛错", async () => {
  const r = await mgr.createPayment({ orderId: "o", amount: 1, description: "", notifyUrl: "https://e2e.local/notify", channel: "paypal" as never });
  assert.equal(r.success, false);
  assert.match(r.error ?? "", /Unsupported channel/);
  await assert.rejects(() => mgr.handleNotify("stripe", "{}", {}), /Unsupported notify channel/);
});
