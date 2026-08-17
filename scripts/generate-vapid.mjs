/**
 * 生成/复用 VAPID 密钥对，写入 .env.local（已存在则跳过，幂等）。
 * 用法：node scripts/generate-vapid.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env.local");

const readEnv = (p) => {
  if (!existsSync(p)) return "";
  return readFileSync(p, "utf-8");
};

const env = readEnv(envPath);
if (env.includes("VAPID_PUBLIC_KEY")) {
  const pub = env.match(/^VAPID_PUBLIC_KEY=(.+)$/m)?.[1]?.trim();
  console.log(`VAPID 已存在（幂等跳过）: ${pub?.slice(0, 20)}...`);
  process.exit(0);
}

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
const subject = process.env.VAPID_SUBJECT || "mailto:admin@oto.app";
const block = [
  "",
  "# PWA 真推（VAPID，LAUNCH-GAP E 组）：web-push 发送密钥（勿提交/勿公开）",
  `VAPID_PUBLIC_KEY=${publicKey}`,
  `VAPID_PRIVATE_KEY=${privateKey}`,
  `VAPID_SUBJECT=${subject}`,
  "",
].join("\n");

writeFileSync(envPath, env + block, "utf-8");
console.log(`VAPID 密钥已写入 .env.local`);
console.log(`  public : ${publicKey.slice(0, 24)}...`);
console.log(`  subject: ${subject}`);
