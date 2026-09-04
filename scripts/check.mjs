/**
 * Step 2 · 统一调度入口（Agent/人只记这一句）：
 *   npm run check          默认 ~70s：tsc + lint:changed + npm test（日常自检核心入口）
 *   npm run check --quick  ~25s：tsc + lint:changed（pre-commit 专用）
 *   npm run check --full   按 Tier 跑满：T1 +build，T2 +verify-scoped（本地预演 pre-push）
 *   npm run check --only=e2e-match.mjs  静态门禁 + 指定 e2e（逃生舱）
 * 行为铁律：永远先打印 Tier/Reason 头再执行；fail-fast；秒级分段计时收尾。
 * Win32：node 直调 tsc/eslint（npx shim 已坏）；npm 经 npm.cmd。
 */
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rawArgs = process.argv.slice(2);
const mode = rawArgs.includes("--full") ? "full" : rawArgs.includes("--quick") ? "quick" : "default";
const onlyArg = rawArgs.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean) : null;
const tierFlag = rawArgs.find((a) => ["--staged", "--worktree"].includes(a))
  || rawArgs.find((a) => a.startsWith("--base=")) || "--worktree";
const ORDER = ["CLEAN", "T-Doc", "T0", "T1", "T2", "T3"];
const atLeast = (tier, min) => ORDER.indexOf(tier) >= ORDER.indexOf(min);

/** npm 经 shell 字符串调用：win32 直 spawn npm.cmd 报 EINVAL，shell:true 全平台通吃。 */
function runNpm(argStr, stepName) {
  const r = spawnSync(`npm ${argStr}`, { cwd: root, stdio: "inherit", shell: true });
  if (r.status !== 0) {
    if (r.error) console.error(`[check] spawn error: ${String(r.error).split("\n")[0]}`);
    fail(stepName);
  }
}

const timed = {};
function step(name, fn) {
  const t0 = Date.now();
  console.log(`\n--- [check] ${name} ---`);
  fn();
  timed[name] = ((Date.now() - t0) / 1000).toFixed(1) + "s";
}
function fail(name, hint) {
  console.error(`\n[check] ✗ ${name} FAILED${hint ? " — " + hint : ""}`);
  summary();
  process.exit(1);
}
function summary() {
  console.log("\n[check] timing: " + Object.entries(timed).map(([k, v]) => `${k} ${v}`).join(" | "));
}

// 1. 定级（永远先打印）。
const det = spawnSync(process.execPath, ["scripts/detect-tier.mjs", tierFlag], { cwd: root, encoding: "utf8" });
if (det.status !== 0) { console.error(det.stderr); process.exit(det.status); }
const lines = det.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
const tierLine = lines.find((l) => l.startsWith("TIER="));
const tier = tierLine ? tierLine.slice(5) : "CLEAN";
const reasons = lines.filter((l) => l.startsWith("REASON:"));
const e2es = lines.filter((l) => l.startsWith("E2E:")).map((l) => l.slice(4));
const files = lines.filter((l) => l.startsWith("FILE:")).map((l) => {
  const body = l.slice(5);
  const tab = body.indexOf("\t");
  return tab < 0 ? { status: "?", path: body } : { status: body.slice(0, tab), path: body.slice(tab + 1) };
});
console.log(`[check] mode=${mode}${only ? ` only=${only.join(",")}` : ""} tierFlag=${tierFlag}`);
console.log(`[check] ${tierLine}`);
for (const r of reasons) console.log(`[check] ${r}`);
if (e2es.length) console.log(`[check] matched e2e: ${e2es.join(", ")}`);

if (tier === "CLEAN") { console.log("[check] CLEAN — nothing to gate ✓"); process.exit(0); }
if (tier === "T-Doc") { console.log("[check] T-Doc — docs only, gates skipped ✓"); process.exit(0); }

// 2. 锁文件同步前置：package.json 动而 lock 不动，且动到依赖段 → 硬拦截（本地永不 auto-ci）。
{
  const changed = new Set(files.map((f) => f.path));
  if (changed.has("package.json") && !changed.has("package-lock.json")) {
    const range = tierFlag === "--staged" ? "--cached" : tierFlag.startsWith("--base=") ? `${tierFlag.slice(7)}...HEAD` : "HEAD";
    try {
      const d = execFileSync("git", ["diff", range, "--", "package.json"], { cwd: root, encoding: "utf8" });
      if (/^[+-]\s*"(dependencies|devDependencies|peerDependencies|overrides)"\s*:/m.test(d)) {
        fail("deps-sync", "package.json 依赖段变更但 lockfile 未同步：请先 npm install 再重跑（本地绝不自动 ci）");
      }
    } catch { /* diff 失败不阻断，继续 */ }
  }
}

// 3. tsc（node 直调）。
step("tsc --noEmit", () => {
  const r = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit"], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) fail("tsc");
});

// 4. lint:changed（删文件过滤 + 空参短路 + 扩展名过滤，三重前置）。
step("lint:changed", () => {
  const lintable = files
    .filter((f) => f.status !== "D" && /\.(ts|tsx|js|mjs|cjs)$/.test(f.path))
    .map((f) => f.path)
    .filter((p) => existsSync(path.join(root, p)));
  if (lintable.length === 0) { console.log("[check] no lintable files → skip ✓"); return; }
  console.log(`[check] eslint on ${lintable.length} files`);
  const r = spawnSync(process.execPath, ["node_modules/eslint/bin/eslint.js", ...lintable], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) fail("eslint");
});

if (mode === "quick") {
  console.log("\n[check] QUICK PASS ✓ (tsc + lint)");
  summary();
  process.exit(0);
}

// 5. npm test（双跑道单入口）。
step("npm test", () => runNpm("test", "npm test"));

if (mode === "default" && !only) {
  console.log("\n[check] PASS ✓ (tsc + lint + test)");
  summary();
  process.exit(0);
}

// 6. --full / --only：T1 +build；T2 或 E2E 命中则 scoped-e2e（无命中→smoke 退化在 verify-scoped 内）。
if (atLeast(tier, "T1")) {
  step("npm run build", () => runNpm("run build", "build"));
}
if (only || atLeast(tier, "T2") || e2es.length > 0) {
  step("verify-scoped", () => {
    const vArgs = only ? [`--only=${only.join(",")}`]
      : e2es.length > 0 ? [`--only=${e2es.join(",")}`]
        : [`--files=${files.map((f) => f.path).join(",")}`];
    const r = spawnSync(process.execPath, ["scripts/verify-scoped.mjs", ...vArgs], { cwd: root, stdio: "inherit" });
    if (r.status !== 0) fail("verify-scoped");
  });
} else {
  console.log("[check] no e2e matched and tier < T2 → scoped e2e skipped");
}
console.log(`\n[check] FULL PASS ✓ (tier ${tier})`);
summary();
