import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";

const PROJECT_REF = "eixqnwaxcnwtxiizmdfs"
const API_BASE = "https://api.supabase.com/v1/projects/" + PROJECT_REF

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

function getToken(): string {
  const fromEnv = env.SUPABASE_MANAGEMENT_TOKEN
  if (fromEnv) return fromEnv
  throw new Error("SUPABASE_MANAGEMENT_TOKEN not found in .env.local")
}

const MIGRATIONS_DIR = resolve(__dirname, "../supabase/migrations");
const TRACKING_TABLE = "_migrations";

async function sql(query: string, token: string): Promise<any[]> {
  const res = await fetch(API_BASE + "/database/query", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SQL error (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  const token = getToken();
  console.log(`\n📦 连接 Supabase 管理 API...`);

  // Verify connection
  const info = await sql("SELECT current_database(), version()", token);
  const dbName = info[0]?.current_database ?? "?";
  const ver = (info[0]?.version ?? "").split(",")[0];
  console.log(`✅ 已连接: ${dbName} — ${ver}\n`);

  // Reset tracking if --reset flag given
  const args = process.argv.slice(2)
  if (args.includes('--reset')) {
    await sql(`DROP TABLE IF EXISTS ${TRACKING_TABLE} CASCADE`, token)
    console.log(`🗑️  追踪表已重置\n`)
  }

  // Ensure tracking table
  await sql(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      name text PRIMARY KEY,
      applied_at timestamptz DEFAULT now()
    )
  `, token);
  console.log(`✅ 迁移追踪表就绪\n`);

  const applied = await sql(
    `SELECT name FROM ${TRACKING_TABLE} ORDER BY name`, token
  );
  const appliedSet = new Set(applied.map((r: any) => r.name));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const pending = files.filter((f) => !appliedSet.has(f));

  if (pending.length === 0) {
    console.log(`✅ 所有 ${files.length} 个迁移文件已应用，无需更新\n`);
    return;
  }

  console.log(`📊 总计迁移: ${files.length}`);
  console.log(`  已应用: ${files.length - pending.length}`);
  console.log(`  待应用: ${pending.length}\n`);

function splitTopLevel(raw: string): string[] {
  const results: string[] = []
  let current = ""
  let i = 0
  while (i < raw.length) {
    if (raw.startsWith("$$", i)) {
      const end = raw.indexOf("$$", i + 2)
      if (end === -1) { current += raw.slice(i); break }
      current += raw.slice(i, end + 2)
      i = end + 2
    } else if (raw[i] === "'") {
      const end = raw.indexOf("'", i + 1)
      if (end === -1) { current += raw.slice(i); break }
      current += raw.slice(i, end + 1)
      i = end + 1
    } else if (raw.startsWith("--", i)) {
      const nl = raw.indexOf("\n", i)
      if (nl === -1) break
      current += raw.slice(i, nl + 1)
      i = nl + 1
    } else if (raw[i] === ";") {
      const trimmed = current.trim()
      if (trimmed) results.push(trimmed)
      current = ""
      i++
    } else {
      current += raw[i]
      i++
    }
  }
  const trimmed = current.trim()
  if (trimmed) results.push(trimmed)
  return results
}

  for (const file of pending) {
    const raw = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    console.log(`▶️  执行: ${file}`);

    const statements = splitTopLevel(raw);

    let ok = 0, skip = 0;
    for (const stmt of statements) {
      try {
        await sql(stmt + ";", token);
        ok++;
      } catch (err: any) {
        console.warn(`   ⚠️  语句跳过 (${err.message.slice(0, 120)})`);
        skip++;
      }
    }

    await sql(
      `INSERT INTO ${TRACKING_TABLE} (name) VALUES ('${file.replace(/'/g, "''")}') ON CONFLICT DO NOTHING`,
      token
    );
    console.log(`   ✅ ${file} — ${ok} 条成功, ${skip} 条跳过\n`);
  }

  console.log(`🎉 全部 ${pending.length} 个迁移文件已成功应用`);
}

main().catch((err) => {
  console.error("❌ 迁移脚本执行失败:", err.message);
  process.exit(1);
});
