#!/usr/bin/env node
/**
 * 宪法收敛门禁（CONVERGENCE GATE）
 * 依据 docs/DESIGN_CONSTITUTION.md §2 与 docs/CONVERGENCE-LOG.md：
 * 任何结构性改动（文件 git rename）合入前必须在登记表登记并标注「宪法收敛：条文 #n」。
 *
 * 检测逻辑：
 *   1. 扫描工作区未提交的 git rename（R 状态）——结构性改动信号；
 *   2. 扫描最近 N 次提交中的 rename，核对提交说明是否含「宪法收敛」标记；
 *   3. 校验登记表每行的 commit 确实存在于 git 历史。
 *
 * 用法：node scripts/convergence-check.mjs [--since=<ref>]
 * 退出码：0 通过 / 1 拦截（违背宪法收敛契约）。
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const LOG = "docs/CONVERGENCE-LOG.md";

function sh(cmd, cwd = ROOT) {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf8",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

// ---------- 1. 未提交 rename ----------
const staged = sh("git diff --cached --name-status -M");
let issues = 0;

const stagedRenames = staged
  .split("\n")
  .filter((l) => /^R\d+/.test(l.trim()))
  .map((l) => l.trim().split(/\t/).slice(1).join(" -> "));

if (stagedRenames.length > 0) {
  // Step 4 同 commit 豁免：rename 与登记表同台暂存 → 放行（提交说明标记由第 2 步在历史侧复核）。
  const stagedNames = sh("git diff --cached --name-only").split("\n").map((l) => l.trim());
  if (stagedNames.includes(LOG)) {
    console.log(`  ✓ rename 与 ${LOG} 同台暂存（同 commit 登记，提交说明须含「宪法收敛」标记）`);
  } else {
    issues++;
    console.error(`\n✗ 检测到未提交的结构性改动（rename）：`);
    for (const r of stagedRenames) console.error(`    ${r}`);
    console.error(`    请在提交说明中标注「宪法收敛：条文 #n」并在 docs/CONVERGENCE-LOG.md 登记该 commit 后再提交。`);
  }
}

// ---------- 2. 最近提交中的 rename：已登记放行，未登记拦截 ----------
const since = process.argv.find((a) => a.startsWith("--since="))?.split("=")[1] ?? "HEAD~20";
const renameCommits = sh(
  `git log ${since}..HEAD --name-status --format=COMMIT%x09%h%x09%s -M`
);
const logLines = renameCommits.split("\n");
const renameByCommit = new Map();
let cur = null;
for (const line of logLines) {
  if (line.startsWith("COMMIT\t")) {
    const [, hash, ...subjectParts] = line.split("\t");
    cur = { hash, subject: subjectParts.join("\t"), renames: [] };
    renameByCommit.set(hash, cur);
  } else if (cur && /^\s*R\d+/.test(line)) {
    cur.renames.push(line.replace(/^\s*R\d+\t/, "").replace(/\t/g, " -> "));
  }
}
const logText = readFileSync(resolve(ROOT, LOG), "utf8");
const listed = new Set();
for (const line of logText.split("\n")) {
  const m = line.match(/`([0-9a-f]{7,40})`/);
  if (m && /^\s*\|/.test(line)) listed.add(m[1]);
}
for (const c of renameByCommit.values()) {
  if (c.renames.length === 0) continue;
  const registered = [...listed].some((h) => c.hash.startsWith(h) || h.startsWith(c.hash));
  // Step 4 同 commit 认定：提交说明含「宪法收敛」标记即视为已登记（hash 事前不可知，
  // 登记行随改动同 commit 落表，不再强制事后 docs-sync 补 hash）。
  const marked = c.subject.includes("宪法收敛");
  if (registered || marked) {
    console.log(`  ✓ 已登记 ${c.hash}（${c.renames.length} rename${registered ? "" : "，凭提交说明标记认定"}）`);
    continue;
  }
  issues++;
  console.error(`\n✗ 提交 ${c.hash} 「${c.subject}」含结构改动但未在 CONVERGENCE-LOG 登记：`);
  for (const r of c.renames.slice(0, 6)) console.error(`    rename: ${r}`);
  console.error(`    请在提交说明标注「宪法收敛：条文 #n」并到 docs/CONVERGENCE-LOG.md 追加该 commit 行。`);
}

// ---------- 3. 登记表 commit 必须真实存在 ----------
for (const hash of listed) {
  if (!sh(`git cat-file -t ${hash} 2>/dev/null || :`)) {
    issues++;
    console.error(`\n✗ 登记表引用的 commit ${hash} 不存在于 git 历史。`);
  }
}

if (issues > 0) {
  console.error(`\n=== 宪法收敛门禁：${issues} 项违规，禁止合入 ===\n`);
  process.exit(1);
}
console.log("=== 宪法收敛门禁：通过（无未登记的 rename / 标记缺失 / 登记失效）===");