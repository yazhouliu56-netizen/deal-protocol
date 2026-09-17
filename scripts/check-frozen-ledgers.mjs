/**
 * 冻结账本门禁（P9 · 用户裁决 2026-09-18）。
 * profiles.balance / pending_withdrawal 已停写（R11 冻结）；
 * wallet_logs/transactions 的 platform_fee 类型已统一为 quality_forfeit 系。
 * 任一新增写入即 fail。node scripts/check-frozen-ledgers.mjs（check.mjs quick 内调用）。
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CODE_EXT = /\.(ts|tsx|mjs|js|cjs)$/;
const SKIP = [/\.test\./, /database\.types\.ts$/, /useIdentityStore\.tsx?$/, /[/\\]deposit\.ts$/];

const violations = [];
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!CODE_EXT.test(e.name)) continue;
    if (SKIP.some((re) => re.test(p))) continue;
    const s = readFileSync(p, "utf8");
    // 规则 1：profiles.update({ ...balance/pending_withdrawal... }) 字面写入。
    // 表作用域判定：取每个 .from('profiles') 到下一个 .from( 之间的链段，
    // 段内出现 .update( 且载荷含 balance/pending_withdrawal 即违规
    // （读＋别表写在同一文件不算；变量间接写由 code review 覆盖）。
    const fromRe = /\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/g;
    const spans = [];
    let m;
    while ((m = fromRe.exec(s)) !== null) spans.push({ table: m[1], index: m.index });
    for (let i = 0; i < spans.length; i++) {
      if (spans[i].table !== "profiles") continue;
      const end = i + 1 < spans.length ? spans[i + 1].index : spans[i].index + 800;
      const seg = s.slice(spans[i].index, end);
      if (/\.update\(\s*\{[^}]*?(balance|pending_withdrawal)/.test(seg)) {
        violations.push(`${path.relative(root, p)}: profiles frozen-ledger write`);
        break;
      }
    }
    // 规则 2：platform_fee 类型写入（历史行保留，新写必须用 quality_forfeit 系）。
    if (/type\s*:\s*['"]platform_fee['"]/.test(s)) {
      violations.push(`${path.relative(root, p)}: platform_fee type write (use quality_forfeit)`);
    }
  }
}
walk(path.join(root, "src"));

if (violations.length > 0) {
  console.error("[frozen-ledgers] FAIL（已知 0 处冻结违规，新增未登记）：");
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log("[frozen-ledgers] PASS（冻结账本零新增写入）");
