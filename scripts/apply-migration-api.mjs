// scripts/apply-migration-api.mjs — 经 Management API 直推迁移（2026-09-17）
// 背景：CI 无固定出口 IP，db.<ref> 5432 直连被项目 Network Restrictions 拒；
// 细粒度 token 已授 Database SQL + Migrations 读写，走 HTTPS /database/query 不碰 pg 端口。
// 用法：node scripts/apply-migration-api.mjs <file...> [--check <sql> --expect <substr>]
// 要求 env：SUPABASE_PROJECT_ID，SUPABASE_ACCESS_TOKEN
// 幂等：目标文件须自带 IF NOT EXISTS / OR REPLACE（R4-1/R5 满足），失败可重跑。
//
// 2026-09-26 诊断纪律（血训）：
// - 本地 .env.local 的 SUPABASE_MANAGEMENT_TOKEN 与 CI 的 SUPABASE_ACCESS_TOKEN
//   是两个不同的 token，前者 401 不能推出后者坏。判 CI 健康的唯一依据：
//   GitHub Actions 的 Database Migration 运行结论（runs API 可查，仓库 public
//   免鉴权）＋云端列探针（service 直查 information_schema 等价物）。
// - 实证：CI token 自 09-17 起全绿（含 09-26 c506937 推送全量 7 文件）；
//   本地 MANAGEMENT_TOKEN 持续 401，仅代表它自己缺权，别再拿它说事。
import { readFileSync } from "fs";
import { resolve, basename } from "path";

const ref = process.env.SUPABASE_PROJECT_ID ?? "";
const token = process.env.SUPABASE_ACCESS_TOKEN ?? "";
const argv = process.argv.slice(2);
const files = [];
let checkSql = "";
let expectSub = "";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--check") {
    const parts = [];
    while (i + 1 < argv.length && argv[i + 1] !== "--expect") parts.push(argv[++i]);
    checkSql = parts.join(" ");
  } else if (argv[i] === "--expect") {
    const parts = [];
    while (i + 1 < argv.length && argv[i + 1] !== "--check") parts.push(argv[++i]);
    expectSub = parts.join(" ");
  } else if (!argv[i].startsWith("--")) {
    files.push(argv[i]);
  }
}
if (!ref || !token || files.length === 0) {
  console.error("缺 SUPABASE_PROJECT_ID / SUPABASE_ACCESS_TOKEN / 文件参数");
  process.exit(1);
}

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

for (const file of files) {
  const version = basename(file).split("_")[0];
  // 0. 已应用则跳过（版本表缺席视为未应用，靠文件自身幂等兜底）
  try {
    const out = await query(
      "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '" +
        version.replace(/'/g, "''") +
        "'",
    );
    if (out.includes(version)) {
      console.log(`SKIP: ${version} 已在远端应用过`);
      continue;
    }
  } catch (e) {
    console.warn(`版本表不可读，继续直推（幂等兜底）: ${String(e).slice(0, 200)}`);
  }

  // 1. 推文件全文（单调用；多语句 + DO 块由服务端一次执行）
  const sql = readFileSync(resolve(file), "utf-8");
  await query(sql);
  console.log(`✓ 已推送: ${basename(file)}`);
}

// 2. 落库核验（可选：--check <sql> --expect <substr>，空白归一后包含即过）
if (checkSql) {
  const verify = await query(checkSql);
  console.log(`核验 → ${verify.slice(0, 3000)}`);
  const flat = verify.replace(/\s/g, "");
  if (!expectSub || !flat.includes(expectSub.replace(/\s/g, ""))) {
    console.error(`✗ 核验失败：缺期望 ${expectSub}`);
    process.exit(1);
  }
  console.log("VERIFIED: 迁移已上云");
}
