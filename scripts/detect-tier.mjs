/**
 * Step 2 · 变更定级器：git diff → Tier（机治替代人治）。
 * 用法：
 *   node scripts/detect-tier.mjs [--staged|--worktree|--base=<ref>]
 * 输出契约（dispatcher/hook 共用）：
 *   首行 TIER=<CLEAN|T-Doc|T0|T1|T2|T3>，随后 REASON:/E2E:/FILE: 行。
 *   永远 exit 0（定级是数据，不是门禁成败）。
 * Win32：纯 node spawn git，-z 按 \0 切分，UTF-8 解码，零 bash 依赖。
 */
import { execFileSync } from "node:child_process";

const ORDER = ["CLEAN", "T-Doc", "T0", "T1", "T2", "T3"];
const rank = (t) => ORDER.indexOf(t);

function usage() {
  console.log(`usage: node scripts/detect-tier.mjs [--staged|--worktree|--base=<ref>]
  --staged    仅已暂存（hook 场景；未 add 的不审判）
  --worktree  HEAD 对工作区 + 未跟踪文件（默认，agent/本地自检）
  --base=REF  REF...HEAD 三点式（CI 场景，防 base 超前污染）`);
}

let mode = "worktree";
let base = null;
for (const a of process.argv.slice(2)) {
  if (a === "--staged") mode = "staged";
  else if (a === "--worktree") mode = "worktree";
  else if (a.startsWith("--base=")) { mode = "base"; base = a.slice("--base=".length); }
  else if (a === "--help" || a === "-h") { usage(); process.exit(0); }
  else { console.error(`[detect-tier] unknown arg: ${a}`); usage(); process.exit(2); }
}
if (mode === "base" && !base) { console.error("[detect-tier] --base requires a ref"); process.exit(2); }

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

/**
 * -z --name-status 解析：普通条目占 1 路径（M\0path\0），
 * R/C（R100/R095/C100…）占 2 路径（R100\0old\0new\0）。游标必须按状态
 * 吞相应数量，否则后续全错位。末尾 \0 切出的空 token 直接丢弃。
 */
function parseNameStatusZ(out) {
  const toks = out.split("\0");
  const entries = [];
  for (let i = 0; i < toks.length;) {
    const t = toks[i++];
    if (!t) continue;
    const code = t[0];
    if (code === "R" || code === "C") {
      const from = toks[i++] ?? "";
      const to = toks[i++] ?? "";
      if (to) entries.push({ status: code, path: to, from });
    } else {
      const p = toks[i++] ?? "";
      if (p) entries.push({ status: code, path: p });
    }
  }
  return entries;
}

function collect() {
  let entries = [];
  if (mode === "staged") {
    entries = parseNameStatusZ(git(["diff", "--cached", "--name-status", "-M", "-z"]));
  } else if (mode === "base") {
    entries = parseNameStatusZ(git(["diff", "--name-status", "-M", "-z", `${base}...HEAD`]));
  } else {
    entries = parseNameStatusZ(git(["diff", "--name-status", "-M", "-z", "HEAD"]));
    // worktree 必须并入未跟踪新文件（--exclude-standard 自动尊 .gitignore），记 A。
    const untracked = git(["ls-files", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean);
    for (const p of untracked) entries.push({ status: "A", path: p, untracked: true });
  }
  return entries;
}

/** T3 契约文件：改即结构变更（宪法收敛对象）。 */
const CONTRACT_FILES = new Set([
  "src/types/ammo-schema.ts",
  "src/types/fuze-policy.ts",
  "src/ammo/registry.ts",
  "src/ammo/factory.ts",
  "src/base/order/wave.ts",
]);

/** 契约级文档：不算 T-Doc，按 T1 定级（ prose 无门禁可验，T1 纯为可见性）。 */
const GOV_DOCS = new Set([
  "docs/DESIGN_CONSTITUTION.md",
  "docs/ARCHITECTURE_TAXONOMY.md",
  "PLATFORM_WHITE_PAPER.md",
]);

/** T2 关键链路目录：订单/资金/派发/安全/风控/信任/API 路由/p2p 通道。 */
const T2_DIRS = [
  "src/app/api/",
  "src/base/order/",
  "src/base/money/",
  "src/base/dispatch/",
  "src/base/safe/",
  "src/base/risk/",
  "src/base/trust/",
  "src/base/platform/p2p/",
];

/** T2 测试基建脚本。 */
const T2_SCRIPTS = new Set([
  "scripts/run-oto-units.mjs",
  "scripts/verify-first-principle.mjs",
  "scripts/verify-prod.mjs",
  "scripts/verify-scoped.mjs",
  "scripts/detect-tier.mjs",
  "scripts/e2e-map.mjs",
  "scripts/check.mjs",
]);

/** 根配置：改即最低 T1（影响全域构建，绝不当 T0）。 */
const ROOT_CONFIG = new Set([
  "package.json", "package-lock.json",
  "tsconfig.json", "next.config.ts", "next.config.mjs",
  "vitest.config.ts", "eslint.config.mjs", "postcss.config.mjs",
  "components.json", "vercel.json", "Dockerfile", "docker-compose.yml",
  "nginx.conf", ".env.example", "playwright.config.ts",
]);

function startsWithAny(p, list) { return list.some((d) => p.startsWith(d)); }
function isE2EScript(p) { return p.startsWith("scripts/e2e-") && p.endsWith(".mjs"); }

function classify(e) {
  const p = e.path;
  // R/C：任何重命名/复制 = 结构变更，直接 T3（状态机最高优先）。
  if (e.status === "R" || e.status === "C") return ["T3", `${e.status === "R" ? "rename" : "copy"} ${e.from} -> ${p}`];
  if (CONTRACT_FILES.has(p)) return ["T3", `contract ${p}`];
  if (p.endsWith(".md")) {
    if (GOV_DOCS.has(p)) return ["T1", `governance-doc ${p}`];
    return ["T-Doc", `doc ${p}`];
  }
  if (isE2EScript(p) || T2_SCRIPTS.has(p)) return ["T2", `test-infra ${p}`];
  if (startsWithAny(p, T2_DIRS)) return ["T2", `critical-lane ${p}`];
  if (ROOT_CONFIG.has(p) || p.startsWith("supabase/") || p === ".gitattributes" || p.startsWith("scripts/hooks/")) {
    return ["T1", `root-config/infra ${p}`];
  }
  if (p.startsWith("scripts/")) return ["T1", `tooling ${p}`];
  if (p.startsWith("src/components/") || p.startsWith("src/app/") || p.startsWith("src/store/")
    || p === "src/app/sw.ts" || p.endsWith("globals.css") || p.startsWith("src/types/")
    || p.startsWith("src/lib/") || p.startsWith("src/modules/") || p.startsWith("mobile/")) {
    return ["T1", `view/build-surface ${p}`];
  }
  if (p.endsWith(".test.ts") || p.endsWith(".test.tsx") || p.endsWith(".spec.ts")
    || p.startsWith("src/base/") || p.startsWith("src/adapters/") || p.startsWith("src/ammo/")
    || p.startsWith("tests/")) {
    return ["T0", `pure-logic/test ${p}`];
  }
  // 未知文件保底：宁可误升 T2，不可漏放 T0。
  return ["T2", `unknown-fallback ${p}`];
}

const entries = collect();
if (entries.length === 0) {
  console.log("TIER=CLEAN");
  console.log("REASON:empty diff, nothing to gate");
  process.exit(0);
}

let top = "T-Doc";
const reasons = [];
for (const e of entries) {
  const [t, why] = classify(e);
  reasons.push(`REASON:${t} ${e.status}${e.untracked ? "(untracked)" : ""} ${why}`);
  if (rank(t) > rank(top)) top = t;
}

console.log(`TIER=${top}`);
for (const r of reasons) console.log(r);

// E2E= 行：供 check --full / verify-scoped 消费（有匹配才输出，无则静默）。
try {
  const { matchE2E } = await import("./e2e-map.mjs");
  const matched = matchE2E(entries.map((e) => e.path));
  for (const m of matched) console.log(`E2E:${m}`);
} catch {
  /* 映射表缺失不阻断定级 */
}
// FILE: 行：供 lint:changed 等消费（status + 路径，\t 分隔；路径含制表符为已知不支持）。
for (const e of entries) console.log(`FILE:${e.status}\t${e.path}`);
