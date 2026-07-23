import Stripe from "stripe";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnv(file: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!existsSync(file)) return result;
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return result;
}

const env = loadEnv(resolve(__dirname, "../.env.local"));
const stripeKey = env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const siteUrl = env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://deal-protocol-phi.vercel.app";

if (!stripeKey) {
  console.error("❌ STRIPE_SECRET_KEY is not set in .env.local or environment");
  process.exit(1);
}

const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" as any });
const webhookUrl = `${siteUrl}/api/webhooks/stripe`;

async function main() {
  console.log(`\n🔧 配置 Stripe Webhook Endpoint`);
  console.log(`   URL: ${webhookUrl}\n`);

  const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
  const existing = endpoints.data.find((e) => e.url === webhookUrl);

  if (existing) {
    console.log(`✅ Webhook 已存在`);
    console.log(`   Endpoint ID: ${existing.id}`);
    console.log(`   Status: ${existing.status}`);
    console.log(`   Events: ${existing.enabled_events.join(", ")}`);
    if (existing.secret) {
      console.log(`   Secret: ${existing.secret.slice(0, 16)}...`);
    }
  } else {
    console.log(`📦 创建新的 Webhook Endpoint...`);
    const created = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: [
        "payment_intent.succeeded",
        "payment_intent.payment_failed",
      ],
      description: "Deal Protocol Production Escrow Webhook",
      api_version: "2025-02-24.acacia",
    });
    console.log(`✅ Stripe Webhook 创建成功！`);
    console.log(`   Endpoint ID: ${created.id}`);
    console.log(`   Webhook Secret: ${created.secret}`);
    console.log(`\n⚠️  请将 STRIPE_WEBHOOK_SECRET 更新到生产环境变量中`);
  }

  const { webhookEndpoints: { list } } = await stripe.webhookEndpoints.list({ limit: 1 });
  console.log(`\n📊 当前账户 Webhooks 总数: ${(await list).data.length}`);
}

main().catch((err) => {
  console.error("❌ 脚本执行失败:", err.message);
  process.exit(1);
});
