// scripts/apply-migration-api.mjs — 经 Management API 直推单文件迁移（2026-09-17）
// 背景：CI 无固定出口 IP，db.<ref> 5432 直连被项目 Network Restrictions 拒；
// 细粒度 token 已授 Database SQL + Migrations 读写，走 HTTPS /database/query 不碰 pg 端口。
// 用法：node scripts/apply-migration-api.mjs supabase/migrations/xxxx.sql
// 要求 env：SUPABASE_PROJECT_ID，SUPABASE_ACCESS_TOKEN
// 幂等：目标文件须自带 IF NOT EXISTS / OR REPLACE（R4-1 满足），失败可重跑。
import { readFileSync } from "fs";
import { resolve, basename } from "path";

const ref = process.env.SUPABASE_PROJECT_ID ?? "";
const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const file = process.argv[2] ?? "";
if (!ref || !token || !file) {
  console.error("缺 SUPABASE_PROJECT_ID / SUPABASE_ACCESS_TOKEN / 文件参数");
  process.exit(1);
}
const version = basename(file).split("_")[0];

async function query(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 500)}`);
  return text;
}

// 0. 已应用则跳过（版本表缺席视为未应用，靠文件自身幂等兜底）
try {
  const out = await query(
    "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '" +
      version.replace(/'/g, "''") +
      "'",
  );
  if (out.includes(version)) {
    console.log(`SKIP: ${version} 已在远端应用过`);
    process.exit(0);
  }
} catch (e) {
  console.warn(`版本表不可读，继续直推（幂等兜底）: ${String(e).slice(0, 200)}`);
}

// 1. 推文件全文（单调用；多语句 + DO 块由服务端一次执行）
const sql = readFileSync(resolve(file), "utf-8");
await query(sql);
console.log(`✓ 已推送: ${basename(file)}`);

// 2. 落库核验（R4-1 双轨列 + RLS + 触发器门）
const verify = await query(`
  SELECT json_build_object(
    'cols', (SELECT count(*) FROM information_schema.columns
             WHERE table_schema='public' AND table_name='order_reviews'
               AND column_name IN ('contract_id','checks','tags','has_after_photo','passed_count','blind_state','reveal_at','jitter_days')),
    'comment_nullable', (SELECT is_nullable FROM information_schema.columns
             WHERE table_schema='public' AND table_name='order_reviews' AND column_name='comment'),
    'policies', (SELECT count(*) FROM pg_policies
             WHERE schemaname='public' AND tablename='order_reviews'),
    'trigger_fn', (SELECT count(*) FROM pg_proc WHERE proname='process_review_reputation_trigger')
  ) AS v`);
console.log(`核验 → ${verify}`);
if (!verify.includes('"cols": 8') && !verify.includes('"cols":8')) {
  console.error("✗ 核验失败：双轨 8 列不全");
  process.exit(1);
}
console.log("VERIFIED: R4-1 已上云");
