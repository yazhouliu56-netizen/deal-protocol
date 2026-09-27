/**
 * 一键重启生产服务（kill pidfile 追踪进程 + 启动 standalone 产服 + 轮询 200）。
 * 用法：node scripts/restart-prod.mjs [port]
 *
 * 关键（2026-08-07 排查出的 Windows 坑）：
 * Start-Process 带 -RedirectStandardOutput/-RedirectStandardError 时，
 * PowerShell 会同步等待目标进程退出 → 外层永久假死。故启动一律но redirect：
 * 本脚本用 spawn(detached + stdio ignore + unref)，双平台同构。
 *
 * 关键（2026-09-08 standalone 收敛）：
 * next.config 已是 output:standalone，`next start` 为官方明示不支持组合；
 * Dockerfile 跑的正是 node server.js。本脚本与之同构：启动
 * .next/standalone/server.js，启动前幂等同步三件套（env、public/、
 * .next/static），本地验的即线上跑的。缺构建产物时直接失败并提示先构建。
 *
 * 关键（2026-09-27 双平台收敛 · CI 血训）：
 * 旧实现调 powershell/taskkill/robocopy，Linux CI 直接暴毙（e2e-verify
 * 自 09-17 起全红，根因与此，与业务代码无关）。本版只用 node 内建能力：
 * 拷贝由 fs.cpSync 代替 robocopy，kill 走 process.kill/taskkill 分支，
 * 启动走 spawn detached。env 解析顺序：进程 env 优先，.env.local 仅补缺
 * （CI 无文件时靠 secrets 进进程 env；缺关键键只警告，由轮询 200 裁决）。
 */
import { execSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = path.join(root, ".runtime");
const pidFile = path.join(runtimeDir, "prod-pid.txt");
const port = process.argv[2] || "3000";

// 1. kill pidfile 追踪到的旧进程（平台分支； hygiene 永不抛错）。
try {
  if (existsSync(pidFile)) {
    const pid = parseInt(readFileSync(pidFile, "utf8").trim(), 10);
    if (Number.isFinite(pid) && pid > 0 && pid !== process.pid) {
      try {
        if (process.platform === "win32") {
          execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
        } else {
          process.kill(pid, "SIGKILL");
        }
        console.log(`[restart] killed tracked (pid ${pid})`);
      } catch {
        /* already gone */
      }
    }
    rmSync(pidFile, { force: true });
  }
} catch {
  /* hygiene 不阻断启动 */
}

await new Promise((r) => setTimeout(r, 1500));

// 2. standalone 三件套同步（幂等：与 Dockerfile 同构）。
// 缺构建产物直接失败，避免拉起一个半残服务污染 e2e。
const standaloneServer = path.join(root, ".next", "standalone", "server.js");
if (!existsSync(standaloneServer)) {
  console.error("[restart] MISSING .next/standalone/server.js — 先跑 npm run build");
  process.exit(1);
}
for (const [src, dest] of [
  [path.join(root, "public"), path.join(root, ".next", "standalone", "public")],
  [path.join(root, ".next", "static"), path.join(root, ".next", "standalone", ".next", "static")],
]) {
  try {
    cpSync(src, dest, { recursive: true, force: true });
  } catch (e) {
    console.error(`[restart] copy FAILED: ${src} -> ${dest}: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

// 3. env：进程 env 优先，.env.local 仅补缺（值永不落地日志）。
const env = { ...process.env };
const envLocal = path.join(root, ".env.local");
if (existsSync(envLocal)) {
  let filled = 0;
  for (const line of readFileSync(envLocal, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) continue;
    if (k in env) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
    filled += 1;
  }
  console.log(`[restart] env supplemented from .env.local (${filled} keys, values hidden)`);
} else {
  console.log("[restart] no .env.local — using process env only");
}
if (!env.NEXT_PUBLIC_SUPABASE_URL) {
  console.warn("[restart] WARN: no Supabase URL in env — server will run degraded (API routes needing DB will fail)");
}

// 4. start — detached + stdio ignore + unref（见文件头 08-07 注释），
//    ws 逃生舱 + PORT/HOSTNAME 经 env 注入（子进程自动继承）。
mkdirSync(runtimeDir, { recursive: true });
const child = spawn(process.execPath, [standaloneServer], {
  cwd: root,
  // 全平台 detached：父进程（含 CI 步骤/工具沙箱）退出时不被连带回收；
  // stdio ignore + unref 避开 08-07 redirect 假死坑。
  detached: true,
  stdio: "ignore",
  env: {
    ...env,
    WS_NO_BUFFER_UTIL: "1",
    WS_NO_UTF_8_VALIDATE: "1",
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
  },
});
child.unref();
if (child.pid == null) {
  console.error("[restart] FAILED to spawn server process");
  process.exit(1);
}
writeFileSync(pidFile, String(child.pid), "utf8");
console.log(`[restart] started (pid ${child.pid})`);

// 5. poll until HTTP 200（半残服务由本步裁决；端口被占会在此超时并提示查 pidfile 之外进程）。
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
  console.error(
    `[restart] NOT READY after 30s on :${port} (check for processes outside pidfile holding the port)`
  );
  process.exitCode = 1;
}
