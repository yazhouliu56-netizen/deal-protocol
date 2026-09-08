/**
 * 一键重启生产服务（kill 3000 占用 + 启动 standalone 产服 + 轮询 200）。
 * 用法：node scripts/restart-prod.mjs [port]
 *
 * 关键（2026-08-07 排查出的 Windows 坑）：
 * Start-Process 带 -RedirectStandardOutput/-RedirectStandardError 时，
 * PowerShell 会同步等待目标进程退出 → 外层 bash/opencode 工具永久假死，
 * 每次重启只能手动打断。不带 redirect 时 Start-Process 立即返回，后台
 * 服务进程完全脱离调用者句柄，工具正常结束。故本脚本不重定向日志。
 *
 * 关键（2026-09-08 standalone 收敛）：
 * next.config 已是 output:standalone，`next start` 为官方明示不支持组合
 *（能跑全靠兼容余量）；Dockerfile 跑的正是 node server.js。本脚本与之
 * 同构：启动 .next/standalone/server.js，启动前幂等同步三件套
 *（.env.local→进程 env、public/→standalone、.next/static→standalone），
 * 本地验的即线上跑的。缺构建产物时直接失败并提示先 npm run build。
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pidFile = path.join(root, ".opencode", "prod-pid.txt");
const port = process.argv[2] || "3000";

function kill(desc, pid) {
  if (!pid) return;
  try {
    // Windows: /T kills the whole tree
    execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    console.log(`[restart] killed ${desc} (pid ${pid})`);
  } catch {
    /* already gone */
  }
}

// 1. kill tracked process
if (existsSync(pidFile)) {
  const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
  kill("tracked", pid);
}

// 2. free port
try {
  const out = execSync(
    `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess"`,
    { encoding: "utf8" }
  ).trim();
  if (out) kill("port-owner", parseInt(out, 10));
} catch {
  /* no listener */
}

await new Promise((r) => setTimeout(r, 1500));

// 2.5 standalone 三件套同步（幂等：与 Dockerfile 26/28 行同构）。
// 缺构建产物直接失败，避免拉起一个半残服务污染 e2e。
const standaloneServer = path.join(root, ".next", "standalone", "server.js");
if (!existsSync(standaloneServer)) {
  console.error("[restart] MISSING .next/standalone/server.js — 先跑 npm run build");
  process.exit(1);
}
const envLocal = path.join(root, ".env.local");
if (!existsSync(envLocal)) {
  console.error("[restart] MISSING .env.local — standalone 不自带 env，拒绝裸起");
  process.exit(1);
}
// 公共静态资源 + 构建静态产物同步进 standalone（官方要求手动补，Dockerfile 同款）。
for (const [src, dest] of [
  [path.join(root, "public"), path.join(root, ".next", "standalone", "public")],
  [path.join(root, ".next", "static"), path.join(root, ".next", "standalone", ".next", "static")],
]) {
  const r = spawnSync("robocopy", [src, dest, "/E", "/NFL", "/NDL", "/NJH", "/NJS"], { stdio: "ignore" });
  // robocopy exit 0-7 均为成功（含仅复制/增量一致），≥8 才是失败
  if (r.status !== null && r.status >= 8) {
    console.error(`[restart] robocopy FAILED: ${src} -> ${dest} (code ${r.status})`);
    process.exit(1);
  }
}
// .env.local 解析为 $env: 注入（只打键名日志，值永不落地日志；单引号转义防 PS 断句）。
const envAssign = [];
for (const line of readFileSync(envLocal, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq <= 0) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  envAssign.push(`$env:${k}='${v.replace(/'/g, "''")}';`);
}
if (envAssign.length === 0) {
  console.error("[restart] .env.local 无有效键值 — 拒绝裸起");
  process.exit(1);
}
console.log(`[restart] env injected (${envAssign.length} keys, values hidden)`);

// 3. start — Start-Process 无 redirect（见文件头注释；日志进 NUL/隐藏窗口）
//    ws 逃生舱：WS_NO_BUFFER_UTIL / WS_NO_UTF_8_VALIDATE（PS 5.1 Start-Process
//    无 -Environment，故经 $env: 前缀注入，子进程自动继承）。
//    serverExternalPackages 已让 ws 不被打包（运行时 require 失败→ws 内置
//    try/catch→纯 JS 回退），此处 env 为第二道保险，双重防护 bufferutil 空桩。
const nodeExe = process.execPath;
const ps = [
  `$env:WS_NO_BUFFER_UTIL='1'; $env:WS_NO_UTF_8_VALIDATE='1';`,
  `$env:PORT='${port}'; $env:HOSTNAME='0.0.0.0';`,
  ...envAssign,
  `$p = Start-Process -FilePath '${nodeExe}'`,
  ` -ArgumentList @('${standaloneServer.replace(/\\/g, "/")}')`,
  ` -WorkingDirectory '${root}' -WindowStyle Hidden -PassThru;`,
  `Set-Content -LiteralPath '${pidFile}' -Value $p.Id -Encoding Ascii`,
].join("");
try {
  execSync(`powershell -NoProfile -Command "& { ${ps} }"`, { stdio: "ignore" });
  console.log(`[restart] started (pid ${existsSync(pidFile) ? readFileSync(pidFile, "utf8").trim() : "?"})`);
} catch (e) {
  console.error("[restart] FAILED to start:", e.message);
  process.exitCode = 1;
  throw e;
}

// 4. poll until HTTP 200
let ready = false;
for (let i = 0; i < 30 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try {
    const res = await fetch(`http://localhost:${port}`);
    if (res.ok) ready = true;
  } catch {
    /* not up yet */
  }
}
if (ready) {
  console.log(`[restart] SERVER READY ✓ (http://localhost:${port})`);
} else {
  console.error(`[restart] NOT READY after 30s on :${port}`);
  process.exitCode = 1;
}