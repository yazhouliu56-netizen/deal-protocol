/**
 * Step 2 · 作用域 E2E：只跑与本次改动相关的链路（替代 13 全量）。
 * 用法：
 *   node scripts/verify-scoped.mjs --only=e2e-match.mjs[,e2e-app.mjs]
 *   node scripts/verify-scoped.mjs --files=<f1,f2,...>   (check --full 调用：映射命中，无命中→smoke 退化)
 *   node scripts/verify-scoped.mjs --smoke
 *   [--dev-server] 复用 :3000 现有服务；[ --port=N ]；[--dry-run] 只打印决议；[--list]
 * 服务策略：探活 → 能复用则复用；needsProd 命中但服务非自有 prod，或无服务 → restart-prod 接管。
 * 执行策略：fail-fast（scoped 的意义就是快信号，与 verify-prod 的全量 fail-soft 互补）。
 */
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SMOKE, NEEDS_PROD, KNOWN, matchE2E } from "./e2e-map.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const opt = { only: null, files: null, smoke: false, devServer: false, port: "3000", dryRun: false, list: false };
for (const a of args) {
  if (a.startsWith("--only=")) opt.only = a.slice(7).split(",").map((s) => s.trim()).filter(Boolean);
  else if (a.startsWith("--files=")) opt.files = a.slice(8).split(",").map((s) => s.trim()).filter(Boolean);
  else if (a === "--smoke") opt.smoke = true;
  else if (a === "--dev-server") opt.devServer = true;
  else if (a.startsWith("--port=")) opt.port = a.slice(7);
  else if (a === "--dry-run") opt.dryRun = true;
  else if (a === "--list") opt.list = true;
  else { console.error(`[verify-scoped] unknown arg: ${a}`); process.exit(2); }
}
if (opt.list) {
  console.log(`[verify-scoped] smoke: ${SMOKE.join(", ")}`);
  console.log(`[verify-scoped] needsProd: ${[...NEEDS_PROD].join(", ")}`);
  process.exit(0);
}

let set = [];
let via = "";
if (opt.only) {
  for (const s of opt.only) {
    if (!KNOWN.has(s)) { console.error(`[verify-scoped] unknown script: ${s} (see --list / e2e-map.mjs)`); process.exit(2); }
  }
  set = opt.only; via = "--only";
} else if (opt.files) {
  set = matchE2E(opt.files);
  if (set.length === 0) {
    set = [...SMOKE];
    via = "smoke-fallback(no map hit)";
    console.warn(`[verify-scoped] WARN: ${opt.files.length} files matched nothing → degrade to smoke (${SMOKE.join(", ")})`);
  } else via = `--files(${opt.files.length} files)`;
} else if (opt.smoke) {
  set = [...SMOKE]; via = "--smoke";
} else {
  console.error("[verify-scoped] need one of --only / --files / --smoke / --list");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe() {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(`http://127.0.0.1:${opt.port}/`, { signal: ctl.signal });
    clearTimeout(t);
    return r.ok || r.status < 500;
  } catch { return false; }
}

/** 三元组确认自有 prod：pid 存活 + 进程名 node + 端口属主 == pid。任一不符即未确认。 */
function confirmOwnProd() {
  try {
    const pidFile = path.join(root, ".opencode", "prod-pid.txt");
    if (!existsSync(pidFile)) return { ok: false, why: "no pid file" };
    const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
    if (!Number.isFinite(pid)) return { ok: false, why: "bad pid file" };
    const tl = execFileSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8" });
    if (!/node(\.exe)?/i.test(tl)) return { ok: false, why: `pid ${pid} not node (stale/recycled)` };
    const owner = execFileSync(
      "powershell",
      ["-NoProfile", "-Command", `Get-NetTCPConnection -LocalPort ${opt.port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`],
      { encoding: "utf8" },
    ).trim();
    if (parseInt(owner, 10) !== pid) return { ok: false, why: `port owner ${owner || "none"} != prod pid ${pid}` };
    return { ok: true, why: `pid ${pid} owns :${opt.port}` };
  } catch (e) {
    return { ok: false, why: `probe-error ${String(e).split("\n")[0]}` };
  }
}

function restartProd() {
  console.log("[verify-scoped] taking over via restart-prod.mjs ...");
  const r = spawnSync(process.execPath, ["scripts/restart-prod.mjs", opt.port], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { console.error("[verify-scoped] restart-prod FAILED"); process.exit(1); }
}

console.log(`[verify-scoped] set(${via}): ${set.join(", ")}`);
const needsProd = set.some((s) => NEEDS_PROD.has(s));
if (opt.dryRun) {
  console.log(`[verify-scoped] dry-run: needsProd=${needsProd}`);
  process.exit(0);
}

let up = await probe();
const prod = up ? confirmOwnProd() : { ok: false, why: "no server" };
console.log(`[verify-scoped] server up=${up} ownProd=${prod.ok} (${prod.why})`);
if (!up || (needsProd && !prod.ok)) {
  // needsProd 链不将就：非自有 prod（dev-server 复用态语义漂移）直接接管。
  restartProd();
  await sleep(3000);
  up = await probe();
  if (!up) { console.error(`[verify-scoped] server still down on :${opt.port}`); process.exit(1); }
  console.log("[verify-scoped] server READY (own prod)");
} else if (opt.devServer || up) {
  console.log(`[verify-scoped] reusing existing server on :${opt.port}`);
}

let failed = null;
for (const script of set) {
  console.log(`\n=== ${script} ===`);
  const r = spawnSync(process.execPath, [`scripts/${script}`], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) { failed = script; console.error(`✗ ${script} FAILED (fail-fast)`); break; }
  console.log(`✓ ${script} PASS`);
  await sleep(1000);
}
if (failed) process.exit(1);
console.log(`\nverify-scoped: ${set.length} scoped e2e PASS ✓`);
