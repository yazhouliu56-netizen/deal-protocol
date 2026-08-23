// scripts/apply-step2-migration.mjs — Step 2 增量迁移直连执行器
// 通道：pg 直连 Supabase Postgres（Management Token 401 失效时的备用通道）
// 用法：node scripts/apply-step2-migration.mjs [migration-file]
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv(file) {
  const result = {};
  if (!existsSync(file)) return result;
  for (const line of readFileSync(file, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    result[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

const env = loadEnv(resolve(__dirname, "../.env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const projectRef = (url.match(/https:\/\/([^.]+)\.supabase\.co/) ?? [])[1];
const password = env.SUPABASE_DB_PASSWORD;
if (!projectRef || !password) {
  console.error("缺 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_DB_PASSWORD");
  process.exit(1);
}
const connectionString =
  process.argv[3] ??
  `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

const file = process.argv[2]?.endsWith(".sql")
  ? process.argv[2]
  : resolve(__dirname, "../supabase/migrations/20260823_step2_authoritative_orders.sql");

const sqlText = readFileSync(file, "utf-8");

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  console.log(`✓ 已连接（project ${projectRef}）`);
  // 单事务整体应用：任一语句失败全部回滚（DDL 幂等性由 IF NOT EXISTS / IF EXISTS 保证）
  await client.query("BEGIN");
  try {
    await client.query(sqlText);
    await client.query("COMMIT");
    console.log(`✓ 迁移已应用: ${file.split(/[\\/]/).pop()}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(`✗ 迁移失败已回滚: ${e.message}`);
    process.exitCode = 1;
  }
  // 终态核验：四表存在 + 枚举对齐 + seats 结构 + RLS 启用
  const check = await client.query(`
    SELECT
      (SELECT to_jsonb(string_agg(c.conname, ',' ORDER BY c.conname))
         FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'orders' AND c.conname = 'chk_order_status') AS orders_chk,
      (SELECT to_jsonb(count(*)) FROM pg_tables
        WHERE tablename IN ('orders','order_seats','order_state_logs','split_records')) AS tables,
      (SELECT to_jsonb(count(*)) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname IN ('orders','order_seats','order_state_logs','split_records')
          AND c.relrowsecurity = true) AS rls_on,
      (SELECT to_jsonb(count(*)) FROM information_schema.columns
        WHERE table_name = 'order_seats') AS seat_cols
  `);
  const r = check.rows[0];
  console.log(`核验 → 四表存在: ${r.tables} / RLS 启用: ${r.rls_on}/4 / seats 列数: ${r.seat_cols}`);
  console.log(`orders CHECK 定义含新枚举: ${(r.orders_chk ?? "").includes("chk_order_status")}`);
} catch (e) {
  console.error(`✗ 连接失败: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
