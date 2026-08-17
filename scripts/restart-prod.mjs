/**
 * 一键重启生产服务（kill 3000 占用 + 启动 next start + 轮询 200）。
 * 用法：node scripts/restart-prod.mjs
 *
 * 关键（2026-08-07 排查出的 Windows 坑）：
 * Start-Process 带 -RedirectStandardOutput/-RedirectStandardError 时，
 * PowerShell 会同步等待目标进程退出 → 外层 bash/opencode 工具永久假死，
 * 每次重启只能手动打断。不带 redirect 时 Start-Process 立即返回，后台
 * 服务进程完全脱离调用者句柄，工具正常结束。故本脚本不重定向日志。
 */
import { execSync } from "node:child_process";
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

// 3. start — Start-Process 无 redirect（见文件头注释；日志进 NUL/隐藏窗口）
const nodeExe = process.execPath;
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next").replace(/\\/g, "/");
const ps = [
  `$p = Start-Process -FilePath '${nodeExe}'`,
  ` -ArgumentList @('${nextBin}','start','-p','${port}')`,
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