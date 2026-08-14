/**
 * 一次性：经 Supabase Management API 应用新迁移 SQL（push_subscriptions 表）。
 * 用法：node scripts/apply-push-migration.mjs
 * 读 root/.env.local 的 SUPABASE_MANAGEMENT_TOKEN 与 NEXT_PUBLIC_SUPABASE_URL。
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envText = readFileSync(resolve("..", ".env.local"), "utf-8");
const get = (k) => envText.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim() ?? "";
const token = get("SUPABASE_MANAGEMENT_TOKEN");
const url = get("NEXT_PUBLIC_SUPABASE_URL");
const ref = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!token || !ref) {
  console.error("missing token/ref");
  process.exit(1);
}

const sql = readFileSync(resolve("..", "supabase", "migrations", "20260814_push_subscriptions.sql"), "utf-8");
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});
console.log("status:", res.status);
console.log((await res.text()).slice(0, 300));
