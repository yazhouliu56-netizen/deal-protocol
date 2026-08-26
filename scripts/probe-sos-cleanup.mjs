#!/usr/bin/env node
/**
 * SOS 云端探针数据清理器（P0 双清零战役 · 闭环 probe-sos-cloud 探针生命周期）。
 *
 * 影响面严格限定前缀 `TEST-PROBE-SOS-%`（probe-sos-cloud.mjs 专属命名空间，
 * 绝不触碰业务数据）：只读盘点 → 前缀限定删除（先子表 order_state_logs 后父表
 * orders）→ 复验归零。默认真实执行；传 --dry-run 仅盘点不删除。
 *
 * 用法：node scripts/probe-sos-cleanup.mjs [--dry-run]
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const LIKE = "TEST-PROBE-SOS-%";
const dryRun = process.argv.includes("--dry-run");
/** 审计面：子表 → 父表 → 归档表（2026-08-24 封账战役 orders→orders_legacy 迁移，
 *  早期探针行可能随归档驻留 legacy 表，一并纳入前缀审计）。 */
const TABLES = ["order_state_logs", "orders", "orders_legacy"];

function loadEnvFile(p) {
  if (!existsSync(p)) return;
  const text = readFileSync(p, "utf8");
  for (const m of text.matchAll(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/gm)) {
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(resolve(process.cwd(), ".env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("💥 缺少 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 凭证");
  process.exit(1);
}
const supa = createClient(url, key, { auth: { persistSession: false } });

async function countOf(table) {
  const { count, error } = await supa
    .from(table)
    .select("*", { count: "exact", head: true })
    .like("order_no", LIKE);
  if (error) {
    const sig = `${error.message} ${error.code ?? ""} ${error.details ?? ""}`.trim();
    // 表不存在 / API 缺席（如部分环境无归档表，supabase-js 返回空 message）：按已净处理
    if (!sig || /does not exist|schema cache|relation|PGRST205|404/i.test(sig)) return null;
    throw new Error(`${table} 盘点失败: ${sig}`);
  }
  return count ?? 0;
}

function fmt(n) {
  return n === null ? "表不存在" : `${n} 行`;
}

const beforeLogs = await countOf("order_state_logs");
const beforeOrders = await countOf("orders");
const beforeLegacy = await countOf("orders_legacy");
console.log(
  `📋 盘点（前缀 ${LIKE}）：order_state_logs=${fmt(beforeLogs)} · orders=${fmt(beforeOrders)} · orders_legacy=${fmt(beforeLegacy)}`
);

if ((beforeLogs ?? 0) === 0 && (beforeOrders ?? 0) === 0 && (beforeLegacy ?? 0) === 0) {
  console.log("✅ 无探针残留，生命周期已闭环（无需删除）");
  process.exit(0);
}

if (dryRun) {
  console.log("🟡 --dry-run：仅盘点不删除");
  process.exit(0);
}

// 先子表后父表/归档表（外键依赖序）；缺表跳过
for (const table of TABLES) {
  const { error } = await supa.from(table).delete().like("order_no", LIKE);
  if (error) {
    if (!error.message?.trim() || /does not exist|schema cache|relation|PGRST205|404/i.test(error.message)) {
      console.log(`⚪️ ${table} 不存在（跳过）`);
      continue;
    }
    console.error(`💥 删除 ${table} 失败: ${error.message}`);
    process.exit(1);
  }
  console.log(`🗑️  ${table} 前缀行已删除`);
}

const after = {
  logs: await countOf("order_state_logs"),
  orders: await countOf("orders"),
  legacy: await countOf("orders_legacy"),
};
console.log(
  `🔍 复验：order_state_logs=${fmt(after.logs)} · orders=${fmt(after.orders)} · orders_legacy=${fmt(after.legacy)}`
);
if ((after.logs ?? 0) !== 0 || (after.orders ?? 0) !== 0 || (after.legacy ?? 0) !== 0) {
  console.error("💥 复验非零，清理未闭环");
  process.exit(1);
}
console.log("✅ 探针数据清零，生命周期闭环");
