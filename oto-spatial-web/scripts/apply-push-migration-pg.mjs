/**
 * 一次性：pg 直连 Supabase 应用 push_subscriptions 迁移。
 * 用法：node scripts/apply-push-migration-pg.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "C:/Users/ADMINI~1/AppData/Local/Temp/pg-run/node_modules/pg/lib/index.js";

const envText = readFileSync(resolve("..", ".env.local"), "utf-8");
const get = (k) => envText.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim() ?? "";
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const pass = get("SUPABASE_DB_PASSWORD");
if (!ref || !pass) {
  console.error("missing ref/password");
  process.exit(1);
}

const client = new pg.Client({
  host: `db.${ref}.pooler.supabase.com`,
  port: 5432,
  user: "postgres",
  password: pass,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const sql = readFileSync(resolve("..", "supabase", "migrations", "20260814_push_subscriptions.sql"), "utf-8");
const res = await client.query(sql);
console.log("applied, rows:", res.length);
await client.end();
