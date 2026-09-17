/**
 * 野表门禁（R8 · 用户裁决 2026-09-18）：
 * 代码 `.from('X')` 的表必须在 supabase/migrations 里有 CREATE TABLE/VIEW 记录，
 * 否则 fail（contract_events 三断血训：schema 错位＋RLS 零策略＋零版本）。
 * 运行：node scripts/check-wild-tables.mjs（check.mjs quick 相内置，毫秒级纯静态）。
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 已知债（R9 批次收编；新增野表一律拦截，不许再往此表加行）。
const ALLOWLIST = new Map([
  ["evidence_chain", "guarded legacy reads（try/catch），读 evidence_log 为准"],
  ["protocol_versions", "guarded legacy read（order-read try/catch）"],
  ["transactions", "R9：refund  live 写，表亡"],
  ["finance_transactions", "R9：finance 路由 live 读，表亡"],
  ["emergency_contacts", "R9：SOS live 读，表亡"],
  ["withdrawals", "R9：名实错位（云端只有 withdrawal_requests），withdraw 路由写亡"],
  ["view_admin_stats", "R9：admin dashboard 读，非表非视图"],
]);

const CODE_EXT = /\.(ts|tsx|mjs|js|cjs)$/;
// storage.from("bucket") 是 Storage 桶非数据表（允许 storage 与 .from 间换行，见 upload.ts）。
const FROM_RE = /(?:(storage)\s*)?\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/gs;
const CREATE_RE = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW)\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi;

const used = new Set();
(function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!CODE_EXT.test(e.name) || /\.test\./.test(e.name)) continue;
    const s = readFileSync(p, "utf8");
    for (const m of s.matchAll(FROM_RE)) {
      if (m[1] === "storage") continue;
      used.add(m[2]);
    }
  }
})(path.join(root, "src"));

const created = new Set();
for (const f of readdirSync(path.join(root, "supabase", "migrations"))) {
  if (!f.endsWith(".sql")) continue;
  const s = readFileSync(path.join(root, "supabase", "migrations", f), "utf8");
  for (const m of s.matchAll(CREATE_RE)) created.add(m[1].toLowerCase());
}

const wild = [...used].filter((t) => !created.has(t) && !ALLOWLIST.has(t));
if (wild.length > 0) {
  console.error(`[wild-tables] ✗ 新增野表 ${wild.length} 个（代码用但迁移无建表记录）：${wild.join(", ")}`);
  console.error("[wild-tables] 先补 CREATE TABLE/VIEW 迁移再合入（R8 contract_events 血训）。");
  process.exit(1);
}
const known = [...used].filter((t) => !created.has(t));
console.log(`[wild-tables] PASS（已知债 ${known.length} 个已登记 R9，无新增野表）`);
