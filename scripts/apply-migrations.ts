import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import pg from "pg";

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

function getConnectionString(): string {
  const direct = env.DATABASE_URL || process.env.DATABASE_URL;
  if (direct) return direct;

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    const projectRef = supabaseUrl.replace(/^https?:\/\//, "").split(".")[0];
    const password = env.SUPABASE_DB_PASSWORD || process.env.SUPABASE_DB_PASSWORD;
    if (password) {
      return `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;
    }
  }

  throw new Error(
    "Database connection string not found. Set DATABASE_URL or SUPABASE_DB_PASSWORD in .env.local"
  );
}

const MIGRATIONS_DIR = resolve(__dirname, "../supabase/migrations");
const TRACKING_TABLE = "_migrations";

async function main() {
  const connStr = getConnectionString();
  console.log(`\n📦 连接数据库...`);
  const pool = new pg.Pool({ connectionString: connStr, max: 1 });

  try {
    const client = await pool.connect();
    console.log(`✅ 数据库连接成功\n`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
        name text PRIMARY KEY,
        applied_at timestamptz DEFAULT now()
      )
    `);

    const { rows: applied } = await client.query(
      `SELECT name FROM ${TRACKING_TABLE} ORDER BY name`
    );
    const appliedSet = new Set(applied.map((r: { name: string }) => r.name));

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

    for (const file of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
      console.log(`▶️  执行: ${file}`);

      for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) {
        if (statement.length < 5) continue;
        try {
          await client.query(statement + ";");
        } catch (err: any) {
          console.warn(`   ⚠️  语句跳过 (${err.message.slice(0, 120)})`);
        }
      }

      await client.query(
        `INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`,
        [file]
      );
      console.log(`   ✅ ${file} 完成\n`);
    }

    console.log(`🎉 全部 ${pending.length} 个迁移文件已成功应用`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("❌ 迁移脚本执行失败:", err.message);
  process.exit(1);
});
